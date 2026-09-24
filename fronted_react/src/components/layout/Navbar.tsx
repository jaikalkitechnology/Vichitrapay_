import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initials } from "@/lib/utils";
import type { NavNotification } from "@/components/layout/useNotifications";

export interface NavSearchItem {
  id: string;
  label: string;
}

interface NavbarProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  setMobileOpen: (open: boolean) => void;
  logout: () => void;
  userName?: string;
  userRole?: string;
  /** Pages the search box can jump to. */
  searchItems: NavSearchItem[];
  onSearchSelect: (id: string) => void;
  notifications: NavNotification[];
  notificationCount: number;
  onNotificationSelect: (tab: string) => void;
}

const TONE_DOT: Record<NavNotification["tone"], string> = {
  amber: "bg-amber-500",
  indigo: "bg-indigo-500",
  red: "bg-red-500",
  green: "bg-green-500",
};

const iconBtn =
  "flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";

export default function Navbar({
  theme,
  toggleTheme,
  setMobileOpen,
  logout,
  userName,
  userRole,
  searchItems,
  onSearchSelect,
  notifications,
  notificationCount,
  onNotificationSelect,
}: NavbarProps) {
  const [query, setQuery] = useState("");
  const [isMac] = useState(() => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform));
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const matches = q ? searchItems.filter((i) => i.label.toLowerCase().includes(q)) : [];

  // Ctrl/Cmd + K focuses the page search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const select = (id: string) => {
    onSearchSelect(id);
    setQuery("");
    inputRef.current?.blur();
  };

  const badge = notificationCount > 99 ? "99+" : String(notificationCount);

  return (
    <div className="sticky top-0 z-30 bg-gray-50/90 px-3 pt-3 backdrop-blur-sm dark:bg-[#0B1120]/90 md:px-6">
      <header className="flex h-16 items-center gap-3 rounded-2xl border border-gray-200/80 bg-white px-3 shadow-[0_8px_24px_-12px_rgba(79,107,246,0.18)] dark:border-gray-800 dark:bg-gray-900 md:px-5">
        <button onClick={() => setMobileOpen(true)} className={cn(iconBtn, "md:hidden")} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 md:hidden">
          <div className="h-9 w-9 overflow-hidden rounded-lg bg-white">
            <img src="/logo.png" alt="Vichitrapay logo" className="h-full w-full scale-[1.3] object-contain" />
          </div>
        </div>

        {/* Page search — jumps to a sidebar page */}
        <div className="relative hidden w-full max-w-[640px] md:block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) select(matches[0].id);
              if (e.key === "Escape") {
                setQuery("");
                inputRef.current?.blur();
              }
            }}
            placeholder="Search pages..."
            aria-label="Search pages"
            className="h-11 w-full rounded-xl border border-gray-200 bg-slate-50 pl-11 pr-24 text-[14px] text-gray-900 placeholder:text-gray-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100 dark:focus:bg-gray-900"
          />
          <div className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 gap-1" aria-hidden="true">
            <kbd className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[12px] text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              {isMac ? "⌘" : "Ctrl"}
            </kbd>
            <kbd className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[12px] text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              K
            </kbd>
          </div>
          {q && (
            <div className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-900">
              {matches.length ? (
                matches.map((m) => (
                  <button
                    key={m.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(m.id)}
                    className="flex w-full items-center px-4 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {m.label}
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-[13px] text-gray-400">No matching pages</div>
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <button
            onClick={toggleTheme}
            className={iconBtn}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          <div className="hidden h-7 w-px bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden="true" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(iconBtn, "relative")} aria-label={`Notifications${notificationCount ? ` (${notificationCount})` : ""}`}>
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-600 px-1 text-[11px] font-semibold leading-none text-white dark:border-gray-900">
                    {badge}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-0">
              <div className="border-b border-gray-100 px-4 py-2.5 text-[13px] font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
                Notifications
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px] text-gray-400">You're all caught up</div>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem key={n.id} onClick={() => onNotificationSelect(n.tab)} className="items-start gap-3 px-4 py-2.5">
                    <span className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", TONE_DOT[n.tone])} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-gray-900 dark:text-gray-100">{n.title}</span>
                      <span className="block text-[12px] text-gray-500">{n.description}</span>
                    </span>
                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {n.count}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 rounded-full bg-gray-100/80 p-1 pr-2.5 transition hover:bg-gray-100 dark:bg-gray-800/70 dark:hover:bg-gray-800"
                aria-label="Account menu"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-[14px] font-semibold text-white">
                  {initials(userName)}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="px-3 py-1.5">
                <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{userName || "User"}</div>
                {userRole && <div className="text-[11px] font-normal text-gray-500">{userRole}</div>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/40">
                <LogOut /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </div>
  );
}
