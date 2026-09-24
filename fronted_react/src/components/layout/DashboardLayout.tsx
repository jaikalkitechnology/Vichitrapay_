import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  Code,
  FileText,
  BarChart3,
  PiggyBank,
  Shield,
  Link as LinkIcon,
  Lock,
  X,
  LogOut,
  Layers,
  Network,
  ArrowLeftRight,
  Landmark,
  BookOpen,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

type NavTab = { id: string; label: string; icon: LucideIcon };
type NavSection = { label: string; tabs: NavTab[] };

const adminSections: NavSection[] = [
  {
    label: "Main",
    tabs: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "merchants", label: "Merchants", icon: Users },
      { id: "tspMappings", label: "TSP Mappings", icon: Layers },
      { id: "tspProviders", label: "TSP Providers", icon: Network },
    ],
  },
  {
    label: "Finance",
    tabs: [
      { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
      { id: "settlements", label: "Settlements", icon: CreditCard },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "payouts", label: "Payouts", icon: PiggyBank },
    ],
  },
  {
    label: "Operations",
    tabs: [
      { id: "report", label: "Report", icon: FileText },
      { id: "bankApproval", label: "Bank Approval", icon: Shield },
    ],
  },
];

const merchantSections: NavSection[] = [
  {
    label: "Main",
    tabs: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
      { id: "paymentLink", label: "Payment Link", icon: LinkIcon },
    ],
  },
  {
    label: "Finance",
    tabs: [
      { id: "bankAccount", label: "Payout Accounts", icon: Landmark },
      { id: "settlements", label: "Settlements", icon: FileText },
      { id: "merchantsTopup", label: "Top Up", icon: Wallet },
      { id: "passbook", label: "Passbook", icon: BookOpen },
    ],
  },
  {
    label: "Account",
    tabs: [
      { id: "developer", label: "Developer", icon: Code },
      { id: "changePassword", label: "Change Password", icon: Lock },
    ],
  },
];

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

  const isAdmin = user?.role === 3;
  const basePath = isAdmin ? "/admin" : "/merchant";
  const sections = isAdmin ? adminSections : merchantSections;
  const roleLabel = isAdmin ? "Administrator" : "Merchant";

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    const path = tabId === "dashboard" ? basePath : `${basePath}/${tabId}`;
    navigate(path);
    setMobileOpen(false);
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-navy dark:bg-[#0B1929]">
      <div className="relative flex items-center justify-center border-b border-white/[0.08] px-4 py-4">
        <div className="h-20 w-20 overflow-hidden rounded-xl bg-white">
          <img src="/logo.png" alt="Vichitrapay" className="h-full w-full scale-[1.3] object-contain" />
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-white/5 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="vp-sidebar-scroll flex-1 overflow-y-auto py-2">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-4 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              {section.label}
            </div>
            {section.tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 border-l-[3px] px-4 py-2 text-left text-[13px] font-medium transition-colors",
                    active
                      ? "border-indigo-600 bg-indigo-600/10 text-white"
                      : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                  )}
                >
                  <tab.icon className={cn("h-4 w-4 flex-shrink-0", active ? "opacity-100" : "opacity-70")} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-white/[0.08] px-4 py-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/25 text-xs font-semibold text-indigo-400">
          {initials(user?.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-slate-200">{user?.name}</div>
          <div className="text-[11px] text-slate-500">{roleLabel}</div>
        </div>
        <button
          onClick={logout}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-white/5 hover:text-white"
          title="Logout"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120]">
      {/* Sidebar (desktop, fixed full height) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[220px] md:block">{sidebar}</aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden",
          mobileOpen ? "visible opacity-100" : "invisible opacity-0"
        )}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[220px] transform transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </aside>

      <div className="flex min-h-screen flex-col md:ml-[220px]">
        <Navbar
          theme={theme}
          toggleTheme={toggleTheme}
          setMobileOpen={setMobileOpen}
          logout={logout}
          userName={user?.name}
          userRole={roleLabel}
          searchItems={sections.flatMap((s) => s.tabs.map(({ id, label }) => ({ id, label })))}
          onSearchSelect={handleTabClick}
        />
        <main className="min-w-0 flex-1 px-4 py-5 text-gray-700 dark:text-gray-300 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
