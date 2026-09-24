import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import useNotifications from "@/components/layout/useNotifications";
import useTheme from "@/hooks/useTheme";
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
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

type NavTab = { id: string; label: string; icon: LucideIcon; color: string };
type NavSection = { label: string; tabs: NavTab[] };

const adminSections: NavSection[] = [
  {
    label: "Main",
    tabs: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-indigo-400" },
      { id: "merchants", label: "Merchants", icon: Users, color: "text-blue-400" },
      { id: "tspMappings", label: "TSP Mappings", icon: Layers, color: "text-violet-400" },
      { id: "tspProviders", label: "TSP Providers", icon: Network, color: "text-orange-400" },
    ],
  },
  {
    label: "Finance",
    tabs: [
      { id: "transactions", label: "Transactions", icon: ArrowLeftRight, color: "text-emerald-400" },
      { id: "settlements", label: "Settlements", icon: CreditCard, color: "text-indigo-400" },
      { id: "analytics", label: "Analytics", icon: BarChart3, color: "text-pink-400" },
      { id: "payouts", label: "Payouts", icon: PiggyBank, color: "text-amber-400" },
    ],
  },
  {
    label: "Operations",
    tabs: [
      { id: "report", label: "Report", icon: FileText, color: "text-sky-400" },
      { id: "bankApproval", label: "Bank Approval", icon: Shield, color: "text-green-400" },
    ],
  },
];

const merchantSections: NavSection[] = [
  {
    label: "Main",
    tabs: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-indigo-400" },
      { id: "transactions", label: "Transactions", icon: ArrowLeftRight, color: "text-emerald-400" },
      { id: "paymentLink", label: "Payment Link", icon: LinkIcon, color: "text-cyan-400" },
    ],
  },
  {
    label: "Finance",
    tabs: [
      { id: "bankAccount", label: "Payout Accounts", icon: Landmark, color: "text-blue-400" },
      { id: "settlements", label: "Settlements", icon: FileText, color: "text-violet-400" },
      { id: "merchantsTopup", label: "Top Up", icon: Wallet, color: "text-amber-400" },
      { id: "passbook", label: "Passbook", icon: BookOpen, color: "text-pink-400" },
    ],
  },
  {
    label: "Account",
    tabs: [
      { id: "developer", label: "Developer", icon: Code, color: "text-sky-400" },
      { id: "changePassword", label: "Change Password", icon: Lock, color: "text-rose-400" },
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

  const { theme, toggleTheme } = useTheme();

  const isAdmin = user?.role === 3;
  const basePath = isAdmin ? "/admin" : "/merchant";
  const sections = isAdmin ? adminSections : merchantSections;
  const roleLabel = isAdmin ? "Administrator" : "Merchant";
  const notifications = useNotifications(isAdmin);

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

      <nav className="vp-sidebar-scroll flex-1 overflow-y-auto px-3 pb-3">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-2 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {section.label}
            </div>
            <div className="flex flex-col gap-1">
              {section.tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium transition-all",
                      active
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                        : "text-slate-200 hover:bg-white/[0.06] hover:text-white"
                    )}
                  >
                    <tab.icon className={cn("h-[18px] w-[18px] flex-shrink-0", active ? "text-white" : tab.color)} />
                    <span className="flex-1 truncate">{tab.label}</span>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5",
                        active ? "text-white" : "text-slate-500"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.08] p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.05] p-3">
          <div className="relative flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white">
              {initials(user?.name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-navy bg-green-500 dark:border-[#0B1929]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-white">{user?.name}</div>
            <div className="text-[12px] text-slate-400">{roleLabel}</div>
          </div>
          <button
            onClick={logout}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120]">
      {/* Sidebar (desktop, fixed full height) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] md:block">{sidebar}</aside>

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
          "fixed inset-y-0 left-0 z-50 w-[248px] transform transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </aside>

      <div className="flex min-h-screen flex-col md:ml-[248px]">
        <Navbar
          theme={theme}
          toggleTheme={toggleTheme}
          setMobileOpen={setMobileOpen}
          logout={logout}
          userName={user?.name}
          userRole={roleLabel}
          searchItems={sections.flatMap((s) => s.tabs.map(({ id, label }) => ({ id, label })))}
          onSearchSelect={handleTabClick}
          notifications={notifications.items}
          notificationCount={notifications.total}
          onNotificationSelect={handleTabClick}
        />
        <main className="min-w-0 flex-1 px-4 pb-5 pt-4 text-gray-700 dark:text-gray-300 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
