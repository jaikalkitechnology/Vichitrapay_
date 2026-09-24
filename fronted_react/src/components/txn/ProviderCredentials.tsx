import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { fetchMerchantCredentials } from "@/api/apiHelper";
import { useToast } from "@/hooks/use-toast";
import { errorText } from "@/components/admin-part/listUtils";
import { cn } from "@/lib/utils";

type Credential = {
  provider_id: number;
  provider_name: string;
  direction: "payin" | "payout";
  client_id: string | null;
  secret_key: string | null;
  salt_key1: string | null;
  salt_key2: string | null;
  salt_key3: string | null;
  mid: string | null;
  is_active: boolean;
};

const MASK = "••••••••••••";

export default function ProviderCredentials() {
  const { toast } = useToast();
  const [data, setData] = useState<{ merchant_id: string; credentials: Credential[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    fetchMerchantCredentials()
      .then(setData)
      .catch((e) => setError(errorText(e, "Failed to load credentials")))
      .finally(() => setLoading(false));
  }, []);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard is not available", variant: "destructive" });
    }
  };

  const creds = data?.credentials ?? [];
  const c = creds[Math.min(active, creds.length - 1)];

  const fields: { label: string; value: string | null; secret?: boolean }[] = c
    ? [
        { label: "Merchant ID", value: data?.merchant_id ?? null },
        { label: "Client ID", value: c.client_id },
        { label: "Secret Key", value: c.secret_key, secret: true },
        { label: "Salt Key 1", value: c.salt_key1, secret: true },
        { label: "Salt Key 2", value: c.salt_key2, secret: true },
        ...(c.salt_key3 ? [{ label: "Salt Key 3", value: c.salt_key3, secret: true }] : []),
      ]
    : [];

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Provider Credentials</h2>
            <p className="text-[13px] text-gray-500">Use these credentials to authenticate your API requests.</p>
          </div>
        </div>
        {c && (
          <div className="flex items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {reveal ? "Hide keys" : "Show keys"}
            </button>
            <span
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide",
                c.is_active
                  ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
              )}
            >
              {c.is_active ? "ACTIVE" : "INACTIVE"}
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading credentials…
          </div>
        ) : error ? (
          <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
        ) : !c ? (
          <p className="text-[13px] text-gray-500">
            No provider credentials are active for your account yet. Contact support to have them assigned.
          </p>
        ) : (
          <>
            {creds.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {creds.map((x, i) => (
                  <button
                    key={`${x.provider_id}-${x.direction}`}
                    type="button"
                    onClick={() => setActive(i)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[12px] font-medium",
                      i === active
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800",
                    )}
                  >
                    {x.provider_name} · {x.direction === "payin" ? "PayIn" : "PayOut"}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {fields.map((f) => (
                <div key={f.label} className="min-w-0 rounded-xl border border-gray-200/80 px-3.5 py-3 dark:border-gray-800">
                  <div className="text-[12px] text-gray-500">{f.label}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                      {!f.value ? "—" : f.secret && !reveal ? MASK : f.value}
                    </span>
                    {f.value && (
                      <button
                        type="button"
                        aria-label={`Copy ${f.label}`}
                        onClick={() => copy(f.label, f.value!)}
                        className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {c.mid && (
              <p className="mt-3 text-[12px] text-gray-500">
                {c.provider_name} {c.direction === "payin" ? "PayIn" : "PayOut"} MID: <span className="font-mono">{c.mid}</span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
