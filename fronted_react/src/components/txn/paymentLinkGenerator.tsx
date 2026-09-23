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

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-900 text-gray-100 p-3 md:p-4 rounded-lg text-xs md:text-sm overflow-x-auto font-mono border" style={{ borderColor: '#00ADEF' }}>
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
          Generate Payment Link
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Fill the form to create a hosted payment link. Copy and send it to your customer.
        </p>
      </div>

      {/* Endpoint banner */}
      <div className="p-3 md:p-4 rounded-lg border border-[#00ADEF] bg-[#F0F9FF] dark:bg-gray-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-md font-bold text-white text-xs" style={{ backgroundColor: "#3871C2" }}>POST</span>
          <code className="font-mono text-sm md:text-base" style={{ color: "#3871C2" }}>
            {PAYIN_INITIATE_URL}
          </code>
        </div>
        <Button size="sm" variant="outline" onClick={() => copyToClipboard(PAYIN_INITIATE_URL, "Endpoint URL")}
          style={{ borderColor: "#00ADEF", color: "#3871C2" }}>
          <Copy className="h-3 w-3 mr-2" /> Copy URL
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Form */}
        <Card className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <LinkIcon className="h-5 w-5 text-[#3871C2]" />
              Request Parameters
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400">Fill in the customer and payment details</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
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
                    className="mt-1 w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-[#3871C2] focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20"
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
                <h3 className="font-semibold mb-3" style={{ color: "#3871C2" }}>Customer Details</h3>
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
                <div className="p-3 rounded-lg border flex items-start gap-2"
                     style={{ borderColor: "#DC2626", backgroundColor: "#FEF2F2" }}>
                  <AlertCircle className="h-4 w-4 mt-0.5" style={{ color: "#DC2626" }} />
                  <div className="text-sm" style={{ color: "#DC2626" }}>{error}</div>
                </div>
              )}

              <Button type="submit" disabled={loading}
                className="w-full text-white rounded-lg"
                style={{ background: "linear-gradient(135deg, #3871C2, #00ADEF)" }}>
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
        <div className="space-y-6">
          {/* Live cURL */}
          <Card className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <CardHeader className="border-b border-gray-100 dark:border-gray-700 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">cURL Request</CardTitle>
                <CardDescription className="text-sm text-gray-500 dark:text-gray-400">Live preview — updates as you type</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(curlCommand, "cURL command")}
                style={{ borderColor: "#00ADEF", color: "#3871C2" }}>
                <Copy className="h-3 w-3 mr-2" /> Copy
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <Code>{curlCommand}</Code>
            </CardContent>
          </Card>

          {/* Response */}
          <Card className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <CardHeader className="border-b border-gray-100 dark:border-gray-700">
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                {response?.success ? (
                  <CheckCircle className="h-5 w-5" style={{ color: "#41B93D" }} />
                ) : (
                  <LinkIcon className="h-5 w-5 text-[#3871C2]" />
                )}
                Response
              </CardTitle>
              <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                {response ? "API response from server" : "Sample response (live response shows after submit)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {response?.payment_url && (
                <div className="p-4 rounded-lg border"
                     style={{ borderColor: "#41B93D", backgroundColor: "#F0FDF4" }}>
                  <div className="text-sm font-medium mb-2" style={{ color: "#41B93D" }}>
                    Payment Link Ready
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <code className="flex-1 font-mono text-xs bg-white dark:bg-gray-800 px-3 py-2 rounded border break-all">
                      {response.payment_url}
                    </code>
                    <Button size="sm"
                      onClick={() => copyToClipboard(response.payment_url, "Payment link")}
                      style={{ backgroundColor: "#41B93D" }}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => window.open(response.payment_url, "_blank")}
                      style={{ borderColor: "#41B93D", color: "#41B93D" }}>
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
