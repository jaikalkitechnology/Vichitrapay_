import React, { useState } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link as LinkIcon, Send, CheckCircle, AlertCircle, ExternalLink, Code2, FileText, Loader2, RefreshCw } from "lucide-react";
import { filterInputCls } from "@/components/admin-part/listUtils";

// Strip the /api/v1 suffix for endpoints mounted at /live (not /api/v1/live)
const API_HOST = BASE_URL.replace(/\/api\/v1\/?$/, "");
const PAYIN_INITIATE_URL = `${API_HOST}/live/payin/initiate`;

/** Colour JSON-ish tokens: "keys": , "strings", numbers/booleans, and the curl command word. */
function highlight(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(-?\d+(?:\.\d+)?|true|false|null)\b|^(\s*)(curl)\b|(-[XHd])\b/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[1]) {
      out.push(
        <span key={i++} className={m[2] ? "text-sky-300" : "text-amber-200"}>
          {m[1]}
        </span>
      );
      if (m[2]) out.push(m[2]);
    } else if (m[3]) {
      out.push(<span key={i++} className="text-violet-300">{m[3]}</span>);
    } else if (m[5]) {
      out.push(m[4], <span key={i++} className="text-pink-300">{m[5]}</span>);
    } else if (m[6]) {
      out.push(<span key={i++} className="text-emerald-300">{m[6]}</span>);
    }
    last = re.lastIndex;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

function CodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0F172A] py-3 font-mono text-[12.5px] leading-6 text-gray-200">
      <table className="min-w-full border-separate border-spacing-0">
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="select-none pl-4 pr-4 text-right align-top text-gray-500">{i + 1}</td>
              <td className="whitespace-pre pr-4">{highlight(l)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type FormState = {
  amount: string;
  merchantOrderId: string;
  channel: "web" | "android" | "ios" | "api";
  purpose: string;
  buyer_name: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
};

function randomOrderId() {
  const hex = Math.random().toString(16).slice(2, 14).toUpperCase();
  return `ORD-${hex}`;
}

export default function PaymentLinkGenerator() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({
    amount: "500",
    merchantOrderId: randomOrderId(),
    channel: "web",
    purpose: "Online Payment",
    buyer_name: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
  });

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Build the request body live from form
  const buildPayload = () => ({
    amount: Number(form.amount) || 0,
    merchantOrderId: form.merchantOrderId,
    channel: form.channel,
    purpose: form.purpose,
    customer: {
      buyer_name: form.buyer_name,
      email: form.email,
      phone: form.phone,
      address1: form.address1 || undefined,
      address2: form.address2 || undefined,
    },
  });

  const curlCommand = `curl -X POST ${PAYIN_INITIATE_URL} \\
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(buildPayload(), null, 2)}'`;

  // Mirrors the real /live/payin/initiate response shape
  const sampleResponse = {
    success: true,
    provider: "<assigned_provider>",
    merchantOrderId: form.merchantOrderId,
    payment_url: "https://…/pay/…",
  };

  const copyToClipboard = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: `${what} copied to clipboard` });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard is not available", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResponse(null);

    // basic validation
    if (!form.amount || Number(form.amount) <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (!form.merchantOrderId || !form.buyer_name || !form.email || !form.phone) {
      setError("Order ID, Buyer Name, Email, and Phone are required");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(PAYIN_INITIATE_URL, buildPayload());
      setResponse(res.data);
      toast({
        title: "✅ Payment Link Generated",
        description: "Share the link with your customer to complete payment",
      });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Request failed";
      setError(detail);
      setResponse(err?.response?.data || { error: detail });
    } finally {
      setLoading(false);
    }
  };

  const regenerateOrderId = () => update("merchantOrderId", randomOrderId());

  const label = "mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300";
  const card = "rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
  const copyBtn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";
  const responseText = JSON.stringify(response ?? sampleResponse, null, 2);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Generate Payment Link</h1>
        <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Fill the form to create a hosted payment link. Copy and send it to your customer.</p>
      </div>

      {/* Endpoint */}
      <div className={`${card} flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 bg-slate-50/70 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/40 sm:flex-1">
          <span className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[13px] font-bold text-white">POST</span>
          <code className="truncate font-mono text-[14px] text-indigo-600 dark:text-indigo-400 md:text-[15px]">{PAYIN_INITIATE_URL}</code>
        </div>
        <button type="button" onClick={() => copyToClipboard(PAYIN_INITIATE_URL, "Endpoint URL")} className={copyBtn}>
          <Copy className="h-4 w-4" /> Copy URL
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Form */}
        <div className={card}>
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <LinkIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Request Parameters</h2>
              <p className="text-[13px] text-gray-500">Fill in the customer and payment details</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Payment Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Amount (INR) *</span>
                <input type="number" step="0.01" min="1" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="500.00" className={filterInputCls} required />
              </label>
              <label className="block">
                <span className={label}>Channel *</span>
                <select value={form.channel} onChange={(e) => update("channel", e.target.value as FormState["channel"])} className={filterInputCls}>
                  <option value="web">Web</option>
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                  <option value="api">API</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className={label}>Merchant Order ID *</span>
              <div className="flex gap-2">
                <input value={form.merchantOrderId} onChange={(e) => update("merchantOrderId", e.target.value)} placeholder="ORD-ABC123" className={filterInputCls} required />
                <button type="button" onClick={regenerateOrderId} className={`${copyBtn} h-11 whitespace-nowrap rounded-xl px-4`}>
                  <RefreshCw className="h-4 w-4" /> Generate
                </button>
              </div>
            </label>
            <label className="block">
              <span className={label}>Purpose</span>
              <input value={form.purpose} onChange={(e) => update("purpose", e.target.value)} placeholder="Online Payment" className={filterInputCls} />
            </label>

            <h3 className="pt-2 text-[15px] font-semibold text-gray-900 dark:text-gray-100">Customer Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Buyer Name *</span>
                <input value={form.buyer_name} onChange={(e) => update("buyer_name", e.target.value)} placeholder="Full name" autoComplete="off" className={filterInputCls} required />
              </label>
              <label className="block">
                <span className={label}>Email *</span>
                <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="customer@example.com" autoComplete="off" className={filterInputCls} required />
              </label>
              <label className="block">
                <span className={label}>Phone *</span>
                <input inputMode="numeric" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="9876543210" minLength={10} maxLength={15} autoComplete="off" className={filterInputCls} required />
              </label>
              <label className="block">
                <span className={label}>Address Line 1</span>
                <input value={form.address1} onChange={(e) => update("address1", e.target.value)} placeholder="Primary address (10–250 chars)" className={filterInputCls} />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Address Line 2</span>
                <input value={form.address2} onChange={(e) => update("address2", e.target.value)} placeholder="Apartment / landmark (optional)" className={filterInputCls} />
              </label>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-[15px] shadow-lg shadow-indigo-600/25">
              {loading ? <Loader2 className="animate-spin" /> : <Send />}
              {loading ? "Generating..." : "Generate Payment Link"}
            </Button>
          </form>
        </div>

        {/* cURL + response */}
        <div className="flex flex-col gap-5">
          <div className={card}>
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                  <Code2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">cURL Request</h2>
                  <p className="text-[13px] text-gray-500">Live preview — updates as you type</p>
                </div>
              </div>
              <button type="button" onClick={() => copyToClipboard(curlCommand, "cURL command")} className={copyBtn}>
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
            <div className="px-5 pb-5">
              <CodeBlock code={curlCommand} />
            </div>
          </div>

          <div className={card}>
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  {response?.success ? <CheckCircle className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </span>
                <div>
                  <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Response</h2>
                  <p className="text-[13px] text-gray-500">{response ? "API response from server" : "Sample response (live response shows after submit)"}</p>
                </div>
              </div>
              <button type="button" onClick={() => copyToClipboard(responseText, "Response")} className={copyBtn}>
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
            <div className="space-y-4 px-5 pb-5">
              {response?.payment_url && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                  <div className="mb-2 text-[13px] font-semibold text-green-700 dark:text-green-400">Payment link ready</div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <code className="flex-1 break-all rounded-lg border border-green-200 bg-white px-3 py-2 font-mono text-[12px] dark:border-green-900 dark:bg-gray-900">{response.payment_url}</code>
                    <Button size="sm" variant="success" onClick={() => copyToClipboard(response.payment_url, "Payment link")}>
                      <Copy /> Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(response.payment_url, "_blank", "noopener")}>
                      <ExternalLink /> Open
                    </Button>
                  </div>
                </div>
              )}
              <CodeBlock code={responseText} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
