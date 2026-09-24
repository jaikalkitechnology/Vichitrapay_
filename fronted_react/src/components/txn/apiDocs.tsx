import React from "react";
import { AlertCircle, Copy, Download, Globe, Link, FileText, CheckCircle, Lock, Search } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { filterInputCls } from "@/components/admin-part/listUtils";
import ProviderCredentials from "@/components/txn/ProviderCredentials";
import { API_ORIGIN } from "@/config";
// Small helper to render code blocks
function Code({ children, green = false }) {
  return (
    <pre className={`bg-gray-900 ${green ? "text-green-400" : "text-gray-100"} p-3 rounded-md text-xs leading-relaxed overflow-x-auto font-mono border border-gray-800`}>{children}</pre>
  );
}

function CodeInline({ children }) {
  return (
    <code className="bg-gray-100 px-1 md:px-2 py-0.5 md:py-1 rounded text-xs md:text-sm font-mono break-words text-indigo-600 dark:text-indigo-400">{children}</code>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="pb-3 md:pb-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <FileText className="h-4 w-4 md:h-5 md:w-5 text-indigo-600" />
          {title}
        </h3>
        {description && (
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm md:text-base">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export default function ApiDocs() {
  const base = API_ORIGIN;
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  // --- Authentication Examples ------------------------------------------------
  const loginResponseExample = {
    access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    token_type: "bearer",
    role: 2,
    expires_in: 10800,
    expires_at: "2026-03-25T21:00:00+00:00"
  };

  // --- PayIn Examples --------------------------------------------------------
  const payinRequestExample = {
    amount: 500.0,
    merchantOrderId: "ORD-A1B2C3D4E5F6",
    channel: "web",
    purpose: "Online Payment",
    customer: {
      buyer_name: "Amit Kumar",
      email: "amit@example.com",
      phone: "9876543210",
      address1: "221B Baker Street, London",
      address2: "Apartment 2, Near the Museum"
    }
  };

  const payinResponseExample = {
    success: true,
    provider: "gurutvapay",
    merchantOrderId: "ORD-A1B2C3D4E5F6",
    txn_id: 142,
    payment_url: "https://pay.gurutvapay.com/payment?token=pay_..."
  };

  const webhookPayloadExample = {
    event: "payin.completed",
    merchantOrderId: "ORD-A1B2C3D4E5F6",
    txn_id: "1824371673",
    amount: 500.0,
    charges: 10.0,
    gst: 1.8,
    settle_amount: 488.2,
    status: "success",
    description: "PayIn successful",
    balance: 12488.2
  };

  // --- Ticket Sizes Example ---------------------------------------------------
  const ticketSizesResponseExample = {
    provider: "gurutvapay",
    ticket_sizes: [50.0, 100.0, 150.0, 200.0, 300.0, 500.0],
    ticket_size_required: true
  };

  const ticketSizesNotRequiredExample = {
    provider: "gurutvapay",
    ticket_sizes: [],
    ticket_size_required: false,
    message: "This provider does not require ticket sizes — any amount accepted"
  };

  // --- UPI Intent Example ----------------------------------------------------
  const upiIntentResponseExample = {
    success: true,
    provider: "gurutvapay",
    order_id: "ORD-A1B2C3D4E5F6",
    txn_id: 143,
    payment_url: "https://pay.gurutvapay.com/payment?token=pay_...",
    intent_url: "upi://pay?pa=merchant@upi&pn=Vichitrapay&am=500.00&tr=OMO251...",
    qr_data: "upi://pay?pa=merchant@upi&pn=Vichitrapay&am=500.00&tr=OMO251..."
  };

  const txnListResponseExample = {
    total: 1,
    page: 1,
    per_page: 20,
    items: [
      {
        id: 142,
        transaction_type: "PayIn",
        credit_debit: "credit",
        merchantOrderId: "ORD-A1B2C3D4E5F6",
        status: "success",
        amount: 500.0,
        charges: 10.0,
        gst: 1.8,
        settle_amount: 488.2,
        balance_amount: 12488.2,
        txn_id: "1824371673",
        created_at: "2026-03-25T14:20:01"
      }
    ]
  };

  // --- PayIn Status Check Example ---------------------------------------------
  const payinStatusResponseExample = {
    success: true,
    merchantOrderId: "ORD-A1B2C3D4E5F6",
    txn_id: "1824371673",
    utr: "607391717789",
    amount: 500.0,
    charges: 10.0,
    gst: 1.8,
    settle_amount: 488.2,
    status: "success",
    created_at: "2026-07-25T14:20:01"
  };

  // --- PayOut Examples --------------------------------------------------------
  const payoutRequestExample = {
    order_id: "PAYOUT_A1B2C3D4E5",
    amount: "500.00",
    ifsc: "YESB0000080",
    accountno: "008050800000580",
    name: "Rohan Gupta",
    branch: "YES BANK",
    paymode: "IMPS",
    mode: "bank"
  };

  const payoutResponseExample = {
    success: true,
    order_id: "PAYOUT_A1B2C3D4E5",
    debit_amount: "512.98",
    provider: "gurutvapay",
    status: "pending"
  };

  const payoutWebhookExample = {
    event: "payout.completed",
    order_id: "PAYOUT_A1B2C3D4E5",
    txn_id: "W260629152916OYFP",
    utr: "618015115041",
    amount: 500.0,
    charges: 10.0,
    gst: 1.8,
    settle_amount: 511.8,
    status: "success",
    description: "BANK PAYOUT | A/C:008050800000580 | IFSC:YESB0000080 | NAME:Rohan Gupta | MODE:IMPS",
    balance: 4488.2
  };

  const payoutStatusResponseExample = {
    provider: "gurutvapay",
    txn_id: "W260629152916OYFP",
    utr: "618015115041",
    status: "SUCCESS",
    amount: "500.00"
  };

  const copyToClipboard = async (text: string, what = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: what, description: text });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard is not available", variant: "destructive" });
    }
  };

  const endpoints: { method: "GET" | "POST"; path: string; description: string; auth: boolean }[] = [
    { method: "POST", path: "/api/v1/auth/login", description: "Obtain Bearer token (form-urlencoded: username & password)", auth: false },
    { method: "POST", path: "/live/payin/initiate", description: "Initiate PayIn — creates transaction & returns payment_url", auth: true },
    { method: "GET", path: "/live/payin/ticket-sizes", description: "Get available ticket sizes for active provider (if required)", auth: true },
    { method: "POST", path: "/live/payin/upi-intent", description: "UPI Intent PayIn — returns intent_url & qr_data for direct UPI pay", auth: true },
    { method: "GET", path: "/live/payin/txns/status", description: "Check PayIn status by order_id or merchantOrderId", auth: true },
    { method: "GET", path: "/api/v1/merchant/wallet-transactions", description: "Paginated wallet transactions with charges, GST, settle_amount", auth: true },
    { method: "POST", path: "/live/payout/initiate", description: "Initiate payout to bank (IMPS/NEFT/RTGS) with charges + GST", auth: true },
    { method: "POST", path: "/live/payout/txns/status", description: "Check payout status by order_id (auto-detects provider)", auth: true },
  ];
  const q = search.trim().toLowerCase();
  const shown = endpoints.filter((e) => !q || `${e.method} ${e.path} ${e.description}`.toLowerCase().includes(q));

  const card = "rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
  const copyBtn =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";
  const quick = [
    { title: "Authentication", sub: "Get your Bearer token for API access", icon: Lock, tone: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400", wrap: "", label: "Copy Login URL", url: `${base}/api/v1/auth/login` },
    { title: "PayIn (Initiate)", sub: "Accept customer payments via payment link", icon: Link, tone: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400", wrap: "bg-violet-50/40 dark:bg-violet-950/10", label: "Copy PayIn URL", url: `${base}/live/payin/initiate` },
    { title: "Payouts (PayOut)", sub: "Send money to bank accounts", icon: Download, tone: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", wrap: "bg-amber-50/40 dark:bg-amber-950/10", label: "Copy Payout URL", url: `${base}/live/payout/initiate` },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">API Documentation</h1>
        <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Integration guides and endpoints for Vichitrapay merchant APIs</p>
      </div>

      <ProviderCredentials />

      {/* Base URL */}
      <div className={`${card} flex flex-col gap-4 p-5 sm:flex-row sm:items-start`}>
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <Globe className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Base URL</h2>
          <p className="text-[13px] text-gray-500">All API endpoints are relative to this base URL</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <code className="flex-1 break-all rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 font-mono text-[15px] text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300">{base}</code>
            <button type="button" onClick={() => copyToClipboard(base, "Base URL copied")} className={`${copyBtn} h-11 px-4`}>
              <Copy className="h-4 w-4" /> Copy
            </button>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {quick.map((c) => (
          <div key={c.title} className={`${card} ${c.wrap} p-5`}>
            <div className="mb-4 flex items-start gap-3">
              <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${c.tone}`}>
                <c.icon className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">{c.title}</h3>
                <p className="text-[13px] text-gray-500">{c.sub}</p>
              </div>
            </div>
            <button type="button" onClick={() => copyToClipboard(c.url, `${c.title} URL copied`)} className={`${copyBtn} h-10 w-full`}>
              <Copy className="h-4 w-4" /> {c.label}
            </button>
          </div>
        ))}
      </div>

      {/* Endpoints overview */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <FileText className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">API Endpoints Overview</h2>
              <p className="text-[13px] text-gray-500">List of available API endpoints for integration</p>
            </div>
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search endpoints..." className={`${filterInputCls} pl-10`} aria-label="Search endpoints" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr className="whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-3 pl-5 pr-3">Method</th>
                <th className="px-3 py-3">Endpoint</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Auth</th>
                <th className="py-3 pl-3 pr-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {shown.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500">No endpoints match "{search}"</td></tr>
              ) : (
                shown.map((e) => (
                  <tr key={e.path} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2.5 pl-5 pr-3">
                      <span
                        className={`inline-flex w-16 justify-center rounded-md border py-1 text-[12px] font-bold ${
                          e.method === "GET"
                            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400"
                            : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
                        }`}
                      >
                        {e.method}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[13.5px] text-blue-700 dark:text-blue-300">{e.path}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{e.description}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {e.auth ? (
                        <span className="rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[11.5px] font-semibold text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400">Bearer Token</span>
                      ) : (
                        <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11.5px] font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">No Auth</span>
                      )}
                    </td>
                    <td className="py-2 pl-3 pr-5 text-right">
                      <button type="button" onClick={() => copyToClipboard(`${base}${e.path}`, "Endpoint copied")} className={`${copyBtn} h-8`}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Authentication Section */}
      <Section
        title="1. Authentication"
        description="Obtain Bearer token via OAuth2 password flow. Token expires in 180 minutes (10800 seconds)."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">POST /api/v1/auth/login</h4>
            <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
              <div className="text-xs md:text-sm font-medium mb-2">Content-Type: <CodeInline>application/x-www-form-urlencoded</CodeInline></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">username</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Your merchant username (required)</div>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">password</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Your merchant password (required)</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">cURL Example</h4>
            <Code>{`curl -X POST ${base}/api/v1/auth/login \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "username=your_username&password=your_password"`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response (200 OK)</h4>
            <Code>{JSON.stringify(loginResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "access_token", desc: "JWT token for Authorization header" },
                { field: "token_type", desc: "Always \"bearer\"" },
                { field: "role", desc: "User role (2 = merchant)" },
                { field: "expires_in", desc: "Token lifetime in seconds (10800)" },
                { field: "expires_at", desc: "ISO 8601 UTC expiry timestamp" },
              ].map((item) => (
                <div key={item.field} className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
                  <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-green-600 dark:text-green-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Usage</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  Send the token in all subsequent requests: <CodeInline>Authorization: Bearer {"<access_token>"}</CodeInline>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-red-600 dark:text-red-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-red-600 dark:text-red-400">Error (401)</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  <CodeInline>{`{"detail": "Invalid username or password"}`}</CodeInline>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* PayIn Initiate Section */}
      <Section
        title="2. Initiate PayIn"
        description="Creates a pending wallet transaction, connects to payment provider, and returns a payment_url for the customer."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">POST /live/payin/initiate</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline> &bull; KYC must be verified &bull; Active PayIn provider required
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Request Body (JSON)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
              {[
                { field: "amount", type: "float", req: "Yes", desc: "Payment amount in INR" },
                { field: "merchantOrderId", type: "string", req: "Yes", desc: "Your unique order ID" },
                { field: "channel", type: "string", req: "Yes", desc: "web | android | ios | api" },
                { field: "purpose", type: "string", req: "No", desc: "Default: \"Online Payment\"" },
                { field: "customer.buyer_name", type: "string", req: "Yes", desc: "Customer full name" },
                { field: "customer.email", type: "string", req: "Yes", desc: "Customer email" },
                { field: "customer.phone", type: "string", req: "Yes", desc: "10-15 digit phone number" },
                { field: "customer.address1", type: "string", req: "No", desc: "Primary address (10-250 chars)" },
                { field: "customer.address2", type: "string", req: "No", desc: "Secondary address" },
              ].map((item) => (
                <div key={item.field} className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{item.field}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.type}</span>
                    {item.req === "Yes" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500">required</span>}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Request Example</h4>
            <Code>{JSON.stringify(payinRequestExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">cURL Example</h4>
            <Code>{`curl -X POST ${base}/live/payin/initiate \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payinRequestExample)}'`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response (200 OK)</h4>
            <Code>{JSON.stringify(payinResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "success", desc: "true if payment initiated" },
                { field: "provider", desc: "Active payment gateway used" },
                { field: "order_id", desc: "Your merchantOrderId echoed back" },
                { field: "txn_id", desc: "Internal wallet transaction ID" },
                { field: "payment_url", desc: "Redirect customer to this URL to pay" },
              ].map((item) => (
                <div key={item.field} className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
                  <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Errors</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div><CodeInline>403</CodeInline> — KYC not completed</div>
                  <div><CodeInline>400</CodeInline> — No active PayIn provider</div>
                  <div><CodeInline>500</CodeInline> — PayIn initiation failed (check provider)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Ticket Sizes Section */}
      <Section
        title="3. Get Ticket Sizes"
        description="Fetch available payment amounts from the active provider. Some providers require the amount to match a ticket size; others accept any amount."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">GET /live/payin/ticket-sizes</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">cURL Example</h4>
            <Code>{`curl -X GET ${base}/live/payin/ticket-sizes \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response — ticket sizes required</h4>
            <Code>{JSON.stringify(ticketSizesResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response — ticket sizes NOT required</h4>
            <Code>{JSON.stringify(ticketSizesNotRequiredExample, null, 2)}</Code>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Note</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  When <CodeInline>ticket_size_required</CodeInline> is <CodeInline>true</CodeInline>, the payment amount must match
                  one of the returned values. If your amount doesn't match, the system auto-adjusts to the nearest valid ticket size.
                  When <CodeInline>false</CodeInline>, any positive amount is accepted.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* UPI Intent Section */}
      <Section
        title="4. UPI Intent PayIn"
        description="Create a UPI intent payment — returns an intent_url for deep-linking into UPI apps and qr_data for QR code display. Same request body as /initiate."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">POST /live/payin/upi-intent</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline> &bull; KYC verified &bull; Same request body as <CodeInline>/live/payin/initiate</CodeInline>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">cURL Example</h4>
            <Code>{`curl -X POST ${base}/live/payin/upi-intent \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payinRequestExample)}'`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response (200 OK)</h4>
            <Code>{JSON.stringify(upiIntentResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "success", desc: "true if UPI intent created" },
                { field: "provider", desc: "Active provider used" },
                { field: "order_id", desc: "Your merchantOrderId" },
                { field: "txn_id", desc: "Internal wallet transaction ID" },
                { field: "intent_url", desc: "UPI deep-link URL (open in UPI app)" },
                { field: "qr_data", desc: "UPI string for QR code generation" },
                { field: "payment_url", desc: "Fallback redirect payment URL" },
              ].map((item) => (
                <div key={item.field} className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
                  <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-green-600 dark:text-green-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Usage</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  Use <CodeInline>intent_url</CodeInline> to open the customer's UPI app directly.
                  Use <CodeInline>qr_data</CodeInline> to render a scannable QR code.
                  Webhooks are delivered the same way as standard PayIn.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Webhook Section */}
      <Section
        title="5. Webhook (Merchant Callback)"
        description="After payment completes, we POST the result to your configured webhook URL. Configure it in Settings."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Webhook Payload (sent to your URL)</h4>
            <Code>{JSON.stringify(webhookPayloadExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Payload Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "event", desc: "payin.completed or payin.failed" },
                { field: "order_id", desc: "Your merchantOrderId" },
                { field: "txn_id", desc: "Provider transaction ID" },
                { field: "amount", desc: "Original payment amount (INR)" },
                { field: "charges", desc: "Platform fee (payInCharges %)" },
                { field: "gst", desc: "18% GST on charges" },
                { field: "settle_amount", desc: "amount - charges - gst (credited to wallet)" },
                { field: "status", desc: "success or failed" },
                { field: "balance", desc: "Your wallet balance after this transaction" },
              ].map((item) => (
                <div key={item.field} className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
                  <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-green-600 dark:text-green-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Fee Calculation</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div><CodeInline>charges</CodeInline> = amount x payInCharges%</div>
                  <div><CodeInline>gst</CodeInline> = charges x 18%</div>
                  <div><CodeInline>settle_amount</CodeInline> = amount - charges - gst</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Important</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  Your webhook endpoint must return HTTP 2xx. We retry up to 3 times (delays: 0s, 2s, 5s).
                  Implement idempotent handling using <CodeInline>order_id</CodeInline> to avoid duplicate processing.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* PayIn Status Check Section */}
      <Section
        title="6. PayIn Status Check"
        description="Check the current status of a PayIn transaction by order ID."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">GET /live/payin/txns/status?order_id={"<ORDER_ID>"}</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline>. Also accepts <CodeInline>merchantOrderId</CodeInline> as query param.
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">cURL Example</h4>
            <Code>{`curl -X GET '${base}/live/payin/txns/status?order_id=ORD-A1B2C3D4E5F6' \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response (200 OK)</h4>
            <Code>{JSON.stringify(payinStatusResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "merchantOrderId", desc: "Your order ID" },
                { field: "txn_id", desc: "Provider transaction ID" },
                { field: "utr", desc: "UTR / bank reference (if available)" },
                { field: "amount", desc: "Original payment amount" },
                { field: "charges", desc: "Platform fee deducted" },
                { field: "gst", desc: "GST on charges" },
                { field: "settle_amount", desc: "Amount credited to wallet" },
                { field: "status", desc: "success | failed | pending" },
              ].map((item) => (
                <div key={item.field} className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
                  <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Transactions Section */}
      <Section
        title="7. Wallet Transactions"
        description="Fetch paginated list of all PayIn & PayOut transactions with fee breakdown."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">GET /api/v1/merchant/wallet-transactions</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">cURL Example</h4>
            <Code>{`curl -X GET "${base}/api/v1/merchant/wallet-transactions?page=1&per_page=20" \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response</h4>
            <Code>{JSON.stringify(txnListResponseExample, null, 2)}</Code>
          </div>
        </div>
      </Section>

      {/* Payout Initiate Section */}
      <Section
        title="8. Initiate Payout"
        description="Send money to a bank account via IMPS/NEFT/RTGS. Amount + charges + GST debited from payout wallet."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">POST /live/payout/initiate</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline> &bull; IP whitelist checked if configured
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Request Body (JSON)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
              {[
                { field: "order_id", type: "string", req: "Yes", desc: "Unique order ID (6-50 chars)" },
                { field: "amount", type: "string", req: "Yes", desc: "Decimal string e.g. \"500.00\"" },
                { field: "ifsc", type: "string", req: "Yes", desc: "IFSC code (11 chars)" },
                { field: "accountno", type: "string", req: "Yes", desc: "Bank account number (6-30 digits)" },
                { field: "name", type: "string", req: "Yes", desc: "Beneficiary name (2-100 chars)" },
                { field: "branch", type: "string", req: "No", desc: "Bank name / branch" },
                { field: "paymode", type: "string", req: "Yes", desc: "IMPS | NEFT | RTGS" },
                { field: "mode", type: "string", req: "No", desc: "Always \"bank\"" },
              ].map((item) => (
                <div key={item.field} className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{item.field}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.type}</span>
                    {item.req === "Yes" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500">required</span>}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Request Example</h4>
            <Code>{JSON.stringify(payoutRequestExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">cURL Example</h4>
            <Code>{`curl -X POST ${base}/live/payout/initiate \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payoutRequestExample)}'`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response (200 OK)</h4>
            <Code>{JSON.stringify(payoutResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "success", desc: "true if payout initiated" },
                { field: "order_id", desc: "Your order ID echoed back" },
                { field: "debit_amount", desc: "Total debited = amount + charges + GST" },
                { field: "provider", desc: "Payout provider used" },
                { field: "status", desc: "\"pending\" — final status arrives via webhook" },
              ].map((item) => (
                <div key={item.field} className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
                  <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-green-600 dark:text-green-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Fee Calculation</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>Amount &le; ₹1000 → flat charge (payOutChargesFlat)</div>
                  <div>Amount &gt; ₹1000 → percentage charge (payOutCharges%)</div>
                  <div><CodeInline>GST</CodeInline> = charges × 18%</div>
                  <div><CodeInline>debit_amount</CodeInline> = amount + charges + GST</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Errors</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div><CodeInline>400</CodeInline> — Merchant settings not configured</div>
                  <div><CodeInline>400</CodeInline> — Insufficient payout wallet balance</div>
                  <div><CodeInline>403</CodeInline> — IP not whitelisted</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Payout Webhook Section */}
      <Section
        title="9. Payout Webhook (Callback)"
        description="After payout completes/fails, we POST the result to your configured webhook_payout URL."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Webhook Payload (sent to your URL)</h4>
            <Code>{JSON.stringify(payoutWebhookExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Payload Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "event", desc: "payout.completed or payout.failed" },
                { field: "order_id", desc: "Your order_id" },
                { field: "txn_id", desc: "Provider transaction ID" },
                { field: "utr", desc: "UTR / bank reference number" },
                { field: "amount", desc: "Payout amount (INR)" },
                { field: "charges", desc: "Platform fee deducted" },
                { field: "gst", desc: "18% GST on charges" },
                { field: "settle_amount", desc: "Total debited from wallet" },
                { field: "status", desc: "success or failed" },
                { field: "balance", desc: "Payout wallet balance after txn" },
              ].map((item) => (
                <div key={item.field} className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
                  <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Important</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  Configure your <CodeInline>PayOut Webhook URL</CodeInline> in merchant settings.
                  On failure, the debit amount is automatically refunded to your payout wallet.
                  We retry up to 3 times. Implement idempotent handling using <CodeInline>order_id</CodeInline>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Payout Status Check Section */}
      <Section
        title="10. Payout Status Check"
        description="Check payout status by order ID. Auto-detects provider and updates the transaction."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">POST /live/payout/txns/status?order_id={"<ORDER_ID>"}</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline>. Accepts order_id, txn_id, or reference_id.
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">cURL Example</h4>
            <Code>{`curl -X POST '${base}/live/payout/txns/status?order_id=PAYOUT_A1B2C3D4E5' \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base text-gray-900 dark:text-gray-100">Response</h4>
            <Code>{JSON.stringify(payoutStatusResponseExample, null, 2)}</Code>
          </div>

          <div className="p-3 md:p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5 text-green-600 dark:text-green-400" />
              <div>
                <div className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Auto-Update</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  If the upstream provider reports SUCCESS or FAILED, the transaction status
                  is automatically updated. Failed payouts are refunded to your payout wallet.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Footer Note */}
      <div className="p-3 md:p-4 rounded-lg border text-center border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="h-4 md:h-5 w-4 md:w-5 text-green-600 dark:text-green-400" />
          <span className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Every endpoint except login requires a Bearer token (Authorization: Bearer &lt;access_token&gt;)</span>
        </div>
      </div>
    </div>
  );
}