// Shown to partners while the partner panel is switched off (see lib/features.ts)
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function PartnerPanelHidden() {
  const { logout } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <img src="/logo.png" alt="Vichitrapay" className="mx-auto h-20 w-20 object-contain" />
        <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
          <Clock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-[20px] font-semibold text-gray-900 dark:text-gray-100">Partner panel coming soon</h1>
        <p className="mt-2 text-[14px] text-gray-500 dark:text-gray-400">
          The partner panel is not available yet. Please contact your Vichitrapay account manager for help.
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-[14px] font-medium text-white hover:bg-indigo-700"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </div>
  );
}
