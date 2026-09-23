import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import Index from "./pages/Index";
import Login from "./pages/Login";
import MerchantDashboard from "./pages/MerchantDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// ProtectedRoute component
const ProtectedRoute = ({
  element,
  allowedRoles,
}: {
  element: React.ReactNode;
  allowedRoles: Array<"admin" | "merchant" | "partner">;
}) => {
  const { user, isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const roleString =
    user?.role === 3
      ? "admin"
      : user?.role === 2
      ? "merchant"
      : user?.role === 1
      ? "partner"
      : null;

  if (!roleString || !allowedRoles.includes(roleString)) {
    // Redirect to proper dashboard if role is not allowed
    return <Navigate to={roleString === "admin" ? "/admin" : "/merchant"} replace />;
  }

  return <>{element}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Protected Routes */}
      <Route
        path="/admin/*"
        element={<ProtectedRoute element={<AdminDashboard />} allowedRoles={["admin"]} />}
      />
      <Route
        path="/merchant/*"
        element={<ProtectedRoute element={<MerchantDashboard />} allowedRoles={["merchant"]} />}
      />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
