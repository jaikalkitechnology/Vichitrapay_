import { useState } from "react";
import { LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

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
}

// Topbar: h-[52px], solid background, no blur (admin_panel_design.md → Topbar)
export default function Navbar({
  theme,
  toggleTheme,
  setMobileOpen,
  logout,
  userName,
  userRole,
  searchItems,
  onSearchSelect,
}: NavbarProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q ? searchItems.filter((i) => i.label.toLowerCase().includes(q)) : [];

  const select = (id: string) => {
    onSearchSelect(id);
    setQuery("");
  };

  return (
    <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 md:px-5">
      <button
        onClick={() => setMobileOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2 md:hidden">
        <div className="h-8 w-8 overflow-hidden rounded-md bg-white">
          <img src="/logo.png" alt="Vichitrapay logo" className="h-full w-full scale-[1.3] object-contain" />
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vichitrapay</span>
      </div>

      {/* Page search — jumps to a sidebar page */}
      <div className="relative hidden w-full max-w-[400px] md:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) select(matches[0].id);
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Search pages..."
          className="h-8 w-full rounded-md border border-gray-300 bg-white pl-8 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        {q && (
          <div className="absolute left-0 right-0 top-9 z-50 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-900">
            {matches.length ? (
              matches.map((m) => (
                <button
                  key={m.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(m.id)}
                  className="flex w-full items-center px-3 py-1.5 text-left text-[13px] text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {m.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-1.5 text-[13px] text-gray-400">No matching pages</div>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
              aria-label="Account menu"
            >
              {initials(userName)}
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
  );
}
