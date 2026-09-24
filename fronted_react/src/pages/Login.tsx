import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, ArrowRight, Clock, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

const logo = "/logo.png";
const REMEMBER_KEY = "vichitrapay-remember-login";

const formSchema = z.object({
  email: z.string().refine(
    (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[a-zA-Z0-9_.-]{3,30}$/.test(value),
    { message: "Please enter a valid email or username" }
  ),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type FormValues = z.infer<typeof formSchema>;

function readRemembered(): string {
  try {
    return localStorage.getItem(REMEMBER_KEY) || "";
  } catch {
    return "";
  }
}

const inputCls =
  "h-14 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-14 pr-4 text-[15px] text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60";

const features = [
  { icon: ShieldCheck, title: "256-bit", sub: "Encryption", tile: "bg-green-50 border-green-100 text-green-600" },
  { icon: Lock, title: "2FA", sub: "Ready", tile: "bg-sky-50 border-sky-100 text-sky-600" },
  { icon: Clock, title: "24/7", sub: "Monitoring", tile: "bg-orange-50 border-orange-100 text-orange-500" },
];

function DotGrid({ className }: { className: string }) {
  return (
    <div className={`pointer-events-none absolute grid grid-cols-6 gap-4 ${className}`} aria-hidden="true">
      {Array.from({ length: 24 }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-200/70" />
      ))}
    </div>
  );
}

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => readRemembered() !== "");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: readRemembered(), password: "" },
  });

  if (isAuthenticated && user) {
    return <Navigate to={user.role === 3 ? "/admin" : "/merchant"} replace />;
  }

  async function onSubmit(data: FormValues) {
    try {
      setIsLoading(true);
      setApiError(null);
      // "Remember me" keeps the email/username on this device for next time
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, data.email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        // storage unavailable (private mode) — nothing to remember
      }
      const res = await login(data.email, data.password);
      if (!res.success) setApiError(res.message || "Login failed. Please try again.");
    } catch (err) {
      console.error("Login error:", err);
      setApiError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 px-4 py-10">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-indigo-100 to-sky-100/60" aria-hidden="true" />
      <DotGrid className="left-[6%] top-[16%] hidden sm:grid" />
      <DotGrid className="bottom-[24%] right-[4%] hidden sm:grid" />
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] w-full" viewBox="0 0 1440 480" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="wave1" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="wave2" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#60a5fa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <path d="M0 140 C 260 40, 520 60, 760 180 S 1200 300, 1440 160 L1440 480 L0 480 Z" fill="url(#wave1)" />
        <path d="M0 300 C 300 200, 560 260, 820 360 S 1260 420, 1440 300 L1440 480 L0 480 Z" fill="url(#wave2)" />
      </svg>

      {/* Card */}
      <div className="relative w-full max-w-[460px] overflow-hidden rounded-[28px] border border-white bg-white/95 px-7 pb-8 pt-10 shadow-[0_20px_60px_-15px_rgba(79,107,246,0.25)] sm:px-10">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-sky-100 to-indigo-100/70" aria-hidden="true" />

        <div className="relative">
          <div className="mb-8 flex justify-center">
            <img src={logo} alt="Vichitrapay" className="h-36 w-36 scale-125 object-contain" />
          </div>

          {apiError && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="sr-only">Email or Username</FormLabel>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <FormControl>
                        <input
                          {...field}
                          placeholder="Email or username"
                          autoComplete="username"
                          disabled={isLoading}
                          className={inputCls}
                        />
                      </FormControl>
                    </div>
                    <FormMessage className="pl-1 text-[13px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="sr-only">Password</FormLabel>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <FormControl>
                        <input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          autoComplete="current-password"
                          disabled={isLoading}
                          className={`${inputCls} pr-14`}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <FormMessage className="pl-1 text-[13px]" />
                  </FormItem>
                )}
              />

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-500 text-[17px] font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105 disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Signing in...
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-1 text-[14px]">
                <label className="flex cursor-pointer select-none items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-5 w-5 rounded-md border-slate-300 accent-indigo-600"
                  />
                  Remember me
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="font-medium text-sky-600 hover:text-indigo-600 hover:underline">
                      Forgot Password?
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 rounded-xl text-[13px] text-slate-600">
                    <p className="font-semibold text-slate-900">Reset your password</p>
                    <p className="mt-1">
                      Contact your Vichitrapay administrator. Admins can set a new password for your account from the
                      Merchants page.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            </form>
          </Form>

          {/* Secure Access */}
          <div className="relative my-6 flex items-center">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="px-4 text-[14px] text-slate-500">Secure Access</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.title} className="flex flex-col items-center text-center">
                <div className={`mb-2 flex h-12 w-12 items-center justify-center rounded-xl border ${f.tile}`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <div className="text-[15px] font-bold text-slate-900">{f.title}</div>
                <div className="text-[13px] text-slate-500">{f.sub}</div>
              </div>
            ))}
          </div>

          <div className="mt-7 border-t border-slate-200 pt-5 text-center text-[12px] leading-relaxed text-slate-500">
            <span className="font-medium text-indigo-600">© {new Date().getFullYear()} Vichitrapay</span>
            <span className="mx-2">•</span>
            Secure wallet-to-wallet payments
            <br />
            <span className="text-slate-400">All rights reserved.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
