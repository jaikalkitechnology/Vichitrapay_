import React, { useState } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link as LinkIcon, Send, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

// Strip the /api/v1 suffix for endpoints mounted at /live (not /api/v1/live)
const API_HOST = BASE_URL.replace(/\/api\/v1\/?$/, "");
const PAYIN_INITIATE_URL = `${API_HOST}/live/payin/initiate`;

function Code({ children, green = false }: { children: React.ReactNode; green?: boolean }) {
  return (
    <pre className={`bg-gray-900 ${green ? "text-green-400" : "text-gray-100"} p-3 rounded-md text-xs leading-relaxed overflow-x-auto font-mono border border-gray-800`}>
      {children}
    </pre>
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

  const sampleResponse = {
    success: true,
    provider: "templamart",
    order_id: form.merchantOrderId,
    txn_id: 142,
    payment_url: "https://pay.templamart.com/...",
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
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

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Generate Payment Link
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Fill the form to create a hosted payment link. Copy and send it to your customer.
        </p>
      </div>

      {/* Endpoint banner */}
      <div className="p-3 md:p-4 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-md font-bold text-white text-xs" style={{ backgroundColor: "#4F6BF6" }}>POST</span>
          <code className="font-mono text-sm md:text-base text-indigo-600 dark:text-indigo-400">
            {PAYIN_INITIATE_URL}
          </code>
        </div>
        <Button size="sm" variant="outline" onClick={() => copyToClipboard(PAYIN_INITIATE_URL, "Endpoint URL")}
          className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200">
          <Copy className="h-3 w-3 mr-2" /> Copy URL
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Form */}
        <Card className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="border-b border-gray-200 dark:border-gray-800">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <LinkIcon className="h-5 w-5 text-indigo-600" />
              Request Parameters
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400">Fill in the customer and payment details</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount" className="text-sm font-medium">Amount (INR) *</Label>
                  <Input id="amount" type="number" step="0.01" min="1"
                    value={form.amount}
                    onChange={(e) => update("amount", e.target.value)}
                    placeholder="500.00" className="mt-1" required />
                </div>
                <div>
                  <Label htmlFor="channel" className="text-sm font-medium">Channel *</Label>
                  <select id="channel"
                    value={form.channel}
                    onChange={(e) => update("channel", e.target.value)}
                    className="mt-1 w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="web">web</option>
                    <option value="android">android</option>
                    <option value="ios">ios</option>
                    <option value="api">api</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="merchantOrderId" className="text-sm font-medium">Merchant Order ID *</Label>
                <div className="flex gap-2 mt-1">
                  <Input id="merchantOrderId"
                    value={form.merchantOrderId}
                    onChange={(e) => update("merchantOrderId", e.target.value)}
                    placeholder="ORD-ABC123" required />
                  <Button type="button" variant="outline" onClick={regenerateOrderId} className="whitespace-nowrap">
                    Regenerate
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="purpose" className="text-sm font-medium">Purpose</Label>
                <Input id="purpose" value={form.purpose}
                  onChange={(e) => update("purpose", e.target.value)}
                  placeholder="Online Payment" className="mt-1" />
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Customer Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="buyer_name" className="text-sm font-medium">Buyer Name *</Label>
                    <Input id="buyer_name" value={form.buyer_name}
                      onChange={(e) => update("buyer_name", e.target.value)}
                      placeholder="Full name" className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
                    <Input id="email" type="email" value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="customer@example.com" className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium">Phone *</Label>
                    <Input id="phone" value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder="9876543210" minLength={10} maxLength={15}
                      className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="address1" className="text-sm font-medium">Address Line 1</Label>
                    <Input id="address1" value={form.address1}
                      onChange={(e) => update("address1", e.target.value)}
                      placeholder="Primary address (10-250 chars)" className="mt-1" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="address2" className="text-sm font-medium">Address Line 2</Label>
                    <Input id="address2" value={form.address2}
                      onChange={(e) => update("address2", e.target.value)}
                      placeholder="Apartment / landmark" className="mt-1" />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg border flex items-start gap-2 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                    >
                  <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400" />
                  <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                </div>
              )}

              <Button type="submit" disabled={loading}
                className="w-full text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
               >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Generate Payment Link
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* RIGHT — Curl preview + Response */}
        <div className="space-y-5">
          {/* Live cURL */}
          <Card className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <CardHeader className="border-b border-gray-200 dark:border-gray-800 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">cURL Request</CardTitle>
                <CardDescription className="text-sm text-gray-500 dark:text-gray-400">Live preview — updates as you type</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(curlCommand, "cURL command")}
                className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200">
                <Copy className="h-3 w-3 mr-2" /> Copy
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <Code green>{curlCommand}</Code>
            </CardContent>
          </Card>

          {/* Response */}
          <Card className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <CardHeader className="border-b border-gray-200 dark:border-gray-800">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                {response?.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <LinkIcon className="h-5 w-5 text-indigo-600" />
                )}
                Response
              </CardTitle>
              <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                {response ? "API response from server" : "Sample response (live response shows after submit)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {response?.payment_url && (
                <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                    >
                  <div className="text-sm font-medium mb-2 text-green-600 dark:text-green-400">
                    Payment Link Ready
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <code className="flex-1 font-mono text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border break-all">
                      {response.payment_url}
                    </code>
                    <Button size="sm"
                      onClick={() => copyToClipboard(response.payment_url, "Payment link")}
                      style={{ backgroundColor: "#16A34A" }}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => window.open(response.payment_url, "_blank")}
                      style={{ borderColor: "#16A34A", color: "#16A34A" }}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Open
                    </Button>
                  </div>
                </div>
              )}
              <Code>{JSON.stringify(response ?? sampleResponse, null, 2)}</Code>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
