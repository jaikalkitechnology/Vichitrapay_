import React, { useState } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { errorText } from "@/components/admin-part/listUtils";
import { Shield, CheckCircle, AlertCircle, Eye, EyeOff, Lock } from "lucide-react";

// Defined outside ChangePassword so the inputs keep focus between keystrokes
function PwdField({
  id, label, value, onChange, show, setShow, placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (b: boolean) => void;
  placeholder: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{label}</Label>
      <div className="relative mt-1">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePassword({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setOldPwd("");
    setNewPwd("");
    setConfirmPwd("");
  };

  // score 0-4 drives the strength meter (merchant_panel_design.md → Change Password)
  const passwordStrength = (pwd: string) => {
    if (pwd.length === 0) return { label: "", color: "", bar: "", score: 0 };
    if (pwd.length < 6) return { label: "Too short", color: "text-red-600", bar: "bg-red-500", score: 1 };
    if (pwd.length < 8) return { label: "Weak", color: "text-amber-600", bar: "bg-amber-500", score: 1 };
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    const score = [hasLetter, hasNumber, hasSpecial].filter(Boolean).length;
    if (score === 3 && pwd.length >= 10) return { label: "Strong", color: "text-green-600", bar: "bg-green-500", score: 4 };
    if (score >= 2) return { label: "Good", color: "text-indigo-600", bar: "bg-indigo-600", score: 3 };
    return { label: "Fair", color: "text-amber-600", bar: "bg-amber-500", score: 2 };
  };

  const strength = passwordStrength(newPwd);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!oldPwd) return setError("Current password is required");
    if (newPwd.length < 6) return setError("New password must be at least 6 characters");
    if (newPwd !== confirmPwd) return setError("New password and confirmation do not match");
    if (oldPwd === newPwd) return setError("New password must differ from current password");

    setLoading(true);
    try {
      await api.post(`${BASE_URL}/merchant/change-password`, {
        old_password: oldPwd,
        new_password: newPwd,
      });
      setSuccess(true);
      toast({
        title: "✅ Password Updated",
        description: "Your password has been changed successfully.",
      });
      reset();
    } catch (err) {
      const detail = errorText(err, "Request failed");
      setError(detail);
      toast({ title: "Failed", description: detail, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={embedded ? "space-y-5" : "mx-auto max-w-2xl space-y-5 p-4"}>
      {/* Header */}
      {!embedded && <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Change Password
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Update your account password. You will not be logged out after changing.
        </p>
      </div>}

      {/* Security Tips */}
      <div className="p-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 flex items-start gap-3">
        <Shield className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-[13px] text-gray-700 dark:text-gray-300">
          <div className="font-semibold mb-1 text-gray-900 dark:text-gray-100">Password Tips</div>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>Use at least 8 characters with letters, numbers, and special characters</li>
            <li>Avoid reusing passwords from other services</li>
            <li>Do not share your password with anyone</li>
          </ul>
        </div>
      </div>

      {/* Form Card */}
      <Card className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        <CardHeader className="border-b border-gray-200 dark:border-gray-800">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Lock className="h-5 w-5 text-indigo-600" />
            Update Password
          </CardTitle>
          <CardDescription className="text-sm text-gray-500 dark:text-gray-400">Enter your current password and choose a new one</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <PwdField
              id="old_pwd"
              label="Current Password *"
              value={oldPwd}
              onChange={setOldPwd}
              show={showOld}
              setShow={setShowOld}
              placeholder="Enter current password"
            />

            <PwdField
              id="new_pwd"
              label="New Password *"
              value={newPwd}
              onChange={setNewPwd}
              show={showNew}
              setShow={setShowNew}
              placeholder="At least 6 characters"
            />
            {newPwd && (
              <div className="-mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-full rounded-full transition-all ${strength.bar}`} style={{ width: `${strength.score * 25}%` }} />
                </div>
                <div className="mt-1 text-[12px] text-gray-500">
                  Strength: <span className={`font-medium ${strength.color}`}>{strength.label}</span>
                </div>
              </div>
            )}

            <PwdField
              id="confirm_pwd"
              label="Confirm New Password *"
              value={confirmPwd}
              onChange={setConfirmPwd}
              show={showConfirm}
              setShow={setShowConfirm}
              placeholder="Re-enter new password"
            />
            {confirmPwd && newPwd && confirmPwd !== newPwd && (
              <div className="text-xs -mt-2 text-red-500">Passwords do not match</div>
            )}

            {error && (
              <div className="p-3 rounded-lg border flex items-start gap-2 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
               >
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg border flex items-start gap-2 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
               >
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                <div className="text-sm text-green-600 dark:text-green-400">
                  Password updated successfully.
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="submit"
                disabled={loading || !oldPwd || !newPwd || !confirmPwd}
                className="flex-1 text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
               
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Update Password
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                disabled={loading}
               
              >
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
