import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import {BASE_URL} from "@/config"
import { THEME_KEY } from "@/hooks/useTheme";
// Define role types
type UserRole = 2 | 3 | 1 | null; // 2 = merchant, 3 = admin
type StringRole = "merchant" | "admin" | "partner" | null; // For display purposes

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  merchantId?: string;
  accessToken?: string;
}
interface LoginResponse {
  success: boolean;
  message?: string;
}
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  getRoleName: () => StringRole;
  isAuthLoading: boolean; // <-- Add this
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true); // <-- Add this

  // Convert numeric role to string for display/logic
  const getRoleName = (): StringRole => {
    if (!user) return null;
    switch (user.role) {
      case 2: return "merchant";
      case 3: return "admin";
      case 1: return "partner";
      default: return null;
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: email,
          password: password,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, message: errorData.detail || "Login failed" };
      }
  
      const { access_token, role } = await response.json();
      
      // Validate role is expected value
      if (role !== 2 && role !== 3 && role !== 1) {
        return { success: false, message: "Invalid user role" };
      }
  
      const newUser: User = {
        id: email,
        name: email.split('@')[0],
        email,
        role,
        accessToken: access_token,
        ...(role === 2 ? { merchantId: "merchant-1" } : {}),
      };
      
      setUser(newUser);
      localStorage.setItem("gurutvapay-user", JSON.stringify(newUser));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // const logout = () => {
  //   setUser(null);
  //   localStorage.removeItem("gurutvapay-user");
  // };
  const logout = async () => {
  try {
    // 1. Clear React state
    setUser(null);

    // 2. Clear localStorage + sessionStorage (keeping the light/dark preference)
    const theme = localStorage.getItem(THEME_KEY);
    localStorage.removeItem("gurutvapay-user");
    localStorage.clear();
    if (theme) localStorage.setItem(THEME_KEY, theme);
    sessionStorage.clear();

    // 3. Clear cookies (non-HttpOnly)
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    });

    // 4. Clear browser caches
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    // 5. Unregister service workers (optional, for PWA cache clearing)
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
    // 6. Redirect to login or refresh
    window.location.href = "/login";
  } catch (error) {
    //console.error("Error during logout:", error);
    // Optionally show a toast or alert to the user
  }
};

  // Initialize from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("gurutvapay-user");
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Validate the stored user has a valid role
        if (parsedUser.role === 2 || parsedUser.role === 3 || parsedUser.role === 1) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem("gurutvapay-user");
        }
      } catch {
        localStorage.removeItem("gurutvapay-user");
      }
    }
    setIsAuthLoading(false); // <-- Set to false after checking localStorage
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        loading,
        error,
        getRoleName,
        isAuthLoading, // <-- Provide this
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}