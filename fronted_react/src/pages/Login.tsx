import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";

const logo = "/logo.png";

export default function Login() {
  const { login, isAuthenticated, user, isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const formSchema = z.object({
    email: z.string().refine((value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const usernameRegex = /^[a-zA-Z0-9_.-]{3,30}$/;
      return emailRegex.test(value) || usernameRegex.test(value);
    }, {
      message: "Please enter a valid email or username",
    }),
    password: z.string().min(6, {
      message: "Password must be at least 6 characters.",
    }),
  });

  type FormValues = z.infer<typeof formSchema>;

  if (isAuthenticated && user) {
    const destination = user.role === 3 ? "/admin" : "/merchant";
    navigate(destination, { replace: true });
    return null;
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: FormValues) {
    try {
      setIsLoading(true);
      setApiError(null);
      
      const loginResponse = await login(data.email, data.password);
      
      if (!loginResponse.success) {
        setApiError(loginResponse.message || "Login failed. Please try again.");
        return;
      }
    } catch (err) {
      console.error("Login error:", err);
      setApiError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#3871C2]/10 via-white to-[#00ADEF]/10 p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src={logo} alt="Vichitrapay Logo" className="w-[20%]" />
          </div>
          <h1 className="text-[26px] font-bold tracking-tight bg-gradient-to-r from-[#3871C2] to-[#00ADEF] bg-clip-text text-transparent">Welcome Back</h1>
          <p className="mt-2 text-gray-600">
            Sign in to your Vichitrapay account
          </p>
      
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-[#F68713]/10 to-transparent rounded-full -translate-x-12 -translate-y-12" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-[#00ADEF]/10 to-transparent rounded-full translate-x-8 translate-y-8" />
          
          <div className="relative">
            {apiError && (
              <Alert variant="destructive" className="mb-6 border-[#F68713] bg-[#F68713]/10">
                <ExclamationTriangleIcon className="h-4 w-4 text-[#F68713]" />
                <AlertDescription className="text-[#F68713]">{apiError}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Email Field */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#3871C2] font-semibold">Email or Username</FormLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-[#3871C2]" />
                        </div>
                        <FormControl>
                          <Input
                            placeholder="your@email.com or username"
                            className="pl-10 h-12 rounded-lg border-[#3871C2]/30 focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-[#F68713] text-sm font-medium" />
                    </FormItem>
                  )}
                />

                {/* Password Field */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#3871C2] font-semibold">Password</FormLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-[#3871C2]" />
                        </div>
                        <FormControl>
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className="pl-10 pr-10 h-12 rounded-lg border-[#3871C2]/30 focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5 text-[#3871C2] hover:text-[#00ADEF]" />
                          ) : (
                            <Eye className="h-5 w-5 text-[#3871C2] hover:text-[#00ADEF]" />
                          )}
                        </button>
                      </div>
                      <FormMessage className="text-[#F68713] text-sm font-medium" />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-12 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #3871C2, #00ADEF)' }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>Sign In</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  )}
                </Button>
              </form>
            </Form>

            {/* Divider */}
            <div className="my-6 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#3871C2]/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white dark:bg-gray-800 text-[#3871C2] font-medium">Secure Access</span>
              </div>
            </div>

            {/* Security Features */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-[#41B93D]/5 rounded-lg border border-[#41B93D]/20">
                <div className="text-[#41B93D] font-bold text-lg">256-bit</div>
                <div className="text-xs text-gray-600">Encryption</div>
              </div>
              <div className="text-center p-3 bg-[#00ADEF]/5 rounded-lg border border-[#00ADEF]/20">
                <div className="text-[#00ADEF] font-bold text-lg">2FA</div>
                <div className="text-xs text-gray-600">Ready</div>
              </div>
              <div className="text-center p-3 bg-[#F68713]/5 rounded-lg border border-[#F68713]/20">
                <div className="text-[#F68713] font-bold text-lg">24/7</div>
                <div className="text-xs text-gray-600">Monitoring</div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-[#3871C2]/20 text-center">
              <p className="text-xs text-gray-500">
                <span className="text-[#3871C2] font-semibold">© 2026 Vichitrapay</span> • Secure wallet-to-wallet payments<br/> 
                <span className="text-[#41B93D]">All rights reserved.</span>
              </p>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Need assistance? Contact our support team
          </p>
          <div className="mt-2 flex justify-center gap-4">
            <a href="#" className="text-xs text-[#00ADEF] hover:text-[#3871C2] font-medium">
              Privacy Policy
            </a>
            <span className="text-gray-300">•</span>
            <a href="#" className="text-xs text-[#00ADEF] hover:text-[#3871C2] font-medium">
              Terms of Service
            </a>
            <span className="text-gray-300">•</span>
            <a href="#" className="text-xs text-[#00ADEF] hover:text-[#3871C2] font-medium">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}