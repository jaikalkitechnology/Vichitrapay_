import { Button } from "@/components/ui/button";
import { LogOut, Menu, X, Moon, Sun } from "lucide-react";

const logo = "/logo.png";

interface NavbarProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  logout: () => void;
}

export default function Navbar({ theme, toggleTheme, mobileOpen, setMobileOpen, logout }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/60 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={logo} alt="Vichitrapay Logo" className="h-8 w-auto" />
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center justify-center h-8 w-8 rounded-lg" style={{ background: 'linear-gradient(135deg, #00ADEF, #41B93D)' }}>
              <span className="text-white font-bold text-xs">V</span>
            </div>
            <div className="hidden md:block">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vichitrapay</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">Secure Payment Solutions</div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-[#00ADEF] hover:bg-[#00ADEF]/5 transition-colors"
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4 text-gray-500" />
              ) : (
                <Sun className="h-4 w-4 text-yellow-400" />
              )}
            </button>

            <Button
              onClick={() => setMobileOpen(!mobileOpen)}
              variant="outline"
              size="sm"
              className="md:hidden h-9 rounded-lg border-gray-200 dark:border-gray-600"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>

            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="hidden md:flex h-9 rounded-lg border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-600 dark:hover:border-red-400 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
