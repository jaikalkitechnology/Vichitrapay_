import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/layout/Navbar";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  Code,
  FileText,
  BarChart3,
  PiggyBank,
  ChevronRight,
  User,
  Mail,
  Shield,
  Link as LinkIcon,
  Lock,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/../public/logo.png";

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function DashboardLayout({
  children,
  activeTab,
  onTabChange,
}: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Theme toggle
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return (localStorage.getItem("vichitrapay-theme") as "light" | "dark") || "light";
    } catch { return "light"; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("vichitrapay-theme", theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");

  const basePath = user?.role === 3 ? "/admin" : "/merchant";

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    const path = tabId === "dashboard" ? basePath : `${basePath}/${tabId}`;
    navigate(path);
  };

  const merchantTabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "transactions", label: "Transactions", icon: CreditCard },
    { id: "paymentLink", label: "Payment Link", icon: LinkIcon },
    { id: "bankAccount", label: "Payout Accounts", icon: PiggyBank },
    { id: "settlements", label: "Settlements", icon: FileText },
    { id: "merchantsTopup", label: "Top Up", icon: Users },
    { id: "passbook", label: "Passbook", icon: CreditCard },
    { id: "developer", label: "Developer", icon: Code },
    { id: "changePassword", label: "Change Password", icon: Lock },
  ];

  const adminTabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "merchants", label: "Merchants", icon: Users },
    { id: "tspMappings", label: "TSP Mappings", icon: Code },
    { id: "tspProviders", label: "TSP Providers", icon: Code },
    { id: "transactions", label: "Transactions", icon: CreditCard },
    { id: "settlements", label: "Settlements", icon: FileText },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "payouts", label: "Payout Management", icon: PiggyBank },
    { id: "report", label: "Report", icon: FileText },
    { id: "bankApproval", label: "Bank Approval", icon: Shield },
  ];

  const tabs = user?.role === 3 ? adminTabs : merchantTabs;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F9FF] via-[#F0FDF4] to-[#FEF6EC] dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        logout={logout}
      />

      <div className="flex">
        {/* Sidebar (desktop fixed) */}
        <aside
          className={cn(
            "hidden md:block fixed top-16 left-0 h-[calc(100vh-1rem)] w-64 flex-shrink-0 z-40"
          )}
        >
          <div className="h-full overflow-y-auto px-3" style={{ background: 'linear-gradient(180deg, #2C5FA8, #1e3a6e)' }}>
            <nav className="space-y-1 mt-[50px]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={cn(
                    "w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 group",
                    activeTab === tab.id
                      ? "bg-white dark:bg-gray-800 shadow-sm"
                      : "text-white hover:bg-white dark:bg-gray-800/10"
                  )}
                >
                  <tab.icon className={cn(
                    "h-5 w-5 mr-3 transition-colors",
                    activeTab === tab.id ? "text-[#3871C2]" : "text-white"
                  )} />
                  <span className={cn(
                    "font-medium transition-colors",
                    activeTab === tab.id ? "text-[#3871C2]" : "text-white"
                  )}>
                    {tab.label}
                  </span>
                  {activeTab === tab.id && (
                    <ChevronRight className="ml-auto h-4 w-4" style={{ color: '#3871C2' }} />
                  )}
                </button>
              ))}
            </nav>

            {/* User Info Sidebar (Desktop) */}
            <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full" style={{ backgroundColor: 'white' }}>
                  <User className="h-5 w-5" style={{ color: '#3871C2' }} />
                </div>
                <div>
                  <div className="font-semibold text-white">{user?.name}</div>
                  <div className="text-xs text-white/80 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {user?.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center text-xs text-white/80 gap-1">
                <Shield className="h-3 w-3" />
                <span>{user?.role === 3 ? "Administrator" : "Merchant"}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        <div
          className={cn(
            "fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300",
            mobileOpen ? "opacity-100 visible" : "opacity-0 invisible"
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            "fixed inset-y-0 left-0 w-72 z-50 transform transition-transform duration-300 ease-in-out md:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ background: 'linear-gradient(180deg, #2C5FA8, #1e3a6e)' }}
        >
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg" style={{background:'linear-gradient(135deg, #00ADEF, #41B93D)'}}>
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <img
                src={logo}
                alt="Vichitrapay Logo"
                className="h-8 w-auto"
              />
              <h2 className="font-semibold text-white">Menu</h2>
            </div>
            <Button 
              onClick={() => setMobileOpen(false)} 
              variant="ghost" 
              size="sm"
              className="text-white hover:bg-white dark:bg-gray-800/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* User Info Mobile */}
          <div className="p-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-12 rounded-full" style={{ backgroundColor: 'white' }}>
                <User className="h-6 w-6" style={{ color: '#3871C2' }} />
              </div>
              <div>
                <div className="font-semibold text-white">{user?.name}</div>
                <div className="text-sm text-white/80">{user?.email}</div>
                <div className="text-xs text-white/60 mt-1">
                  {user?.role === 3 ? "Admin Portal" : "Merchant Portal"}
                </div>
              </div>
            </div>
          </div>
          
          <nav className="p-3 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  handleTabClick(tab.id);
                  setMobileOpen(false);
                }}
                className={cn(
                  "w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 group",
                  activeTab === tab.id
                    ? "bg-white dark:bg-gray-800 shadow-sm"
                    : "text-white hover:bg-white dark:bg-gray-800/10"
                )}
              >
                <tab.icon className={cn(
                  "h-5 w-5 mr-3 transition-colors",
                  activeTab === tab.id ? "text-[#3871C2]" : "text-white"
                )} />
                <span className={cn(
                  "font-medium transition-colors",
                  activeTab === tab.id ? "text-[#3871C2]" : "text-white"
                )}>
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <ChevronRight className="ml-auto h-4 w-4" style={{ color: '#3871C2' }} />
                )}
              </button>
            ))}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <Button
              onClick={logout}
              className="w-full"
              style={{ 
                backgroundColor: '#F68713',
                color: 'white'
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 ml-0 md:ml-64 min-h-[calc(100vh-4rem)] p-4 md:p-6 overflow-y-auto dark:text-gray-100">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}