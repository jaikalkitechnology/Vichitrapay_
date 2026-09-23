import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Eye, EyeOff, Key } from "lucide-react";
import { fetchMerchantCredentials } from "@/api/apiHelper";

type Credential = {
  provider_id: number;
  provider_name: string;
  direction: "payin" | "payout";
  client_id: string;
  secret_key: string;
  salt_key1: string;
  salt_key2: string;
  salt_key3: string;
  mid: string;
  is_active: boolean;
};

export default function ProviderCredentials() {
  const [data, setData] = useState<{ merchant_id: string; credentials: Credential[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchMerchantCredentials()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: number) =>
    setShowSecrets((p) => ({ ...p, [id]: !p[id] }));

  const copy = (text: string) => navigator.clipboard.writeText(text);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading credentials…</div>;
  }

  if (!data) {
    return <div className="text-sm text-red-500">Failed to load credentials</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
          <Key className="h-5 w-5" />
          Provider Credentials
        </CardTitle>
        <p className="text-xs text-gray-500">
          Merchant ID: <span className="font-mono">{data.merchant_id}</span>
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {(data.credentials ?? []).map((c) => {
          const visible = showSecrets[c.provider_id];
          return (
            <div
              key={c.provider_id}
              className="rounded-lg border p-4 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700"
             
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-indigo-600">
                    {c.provider_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.direction.toUpperCase()} • MID: {c.mid}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      c.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {c.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>

                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => toggle(c.provider_id)}
                  >
                    {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
              </div>

              {/* Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  ["Client ID", c.client_id],
                  ["Secret Key", c.secret_key],
                  ["Salt Key 1", c.salt_key1],
                  ["Salt Key 2", c.salt_key2],
                  ["Salt Key 3", c.salt_key3],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-gray-500">{label}</div>
                      <div className="font-mono break-all">
                        {visible ? value : "••••••••••••••••"}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copy(value)}
                    >
                      <Copy size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
