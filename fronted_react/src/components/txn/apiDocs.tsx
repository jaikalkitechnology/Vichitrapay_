import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ChevronRight, Key, Link, FileText, CheckCircle, AlertCircle } from "lucide-react";
import ProviderCredentials from "@/components/txn/ProviderCredentials";
// Small helper to render code blocks
function Code({ children }) {
  return (
    <pre className="bg-gray-900 text-gray-100 p-3 md:p-4 rounded-lg text-xs md:text-sm overflow-x-auto font-mono border" style={{ borderColor: '#00ADEF' }}>{children}</pre>
  );
}

function CodeInline({ children }) {
  return (
    <code className="bg-gray-100 px-1 md:px-2 py-0.5 md:py-1 rounded text-xs md:text-sm font-mono break-words" style={{ color: '#3871C2' }}>{children}</code>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="space-y-4 p-4 md:p-6 rounded-xl border border-[#00ADEF]/30 bg-[#F0F9FF] dark:bg-gray-800/50 mb-4 md:mb-6">
      <div className="pb-3 md:pb-4 border-b border-[#00ADEF]/20 dark:border-gray-700">
        <h3 className="text-lg md:text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <FileText className="h-4 w-4 md:h-5 md:w-5 text-[#3871C2]" />
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

function EndpointCard({ method, path, description, color = '#3871C2' }) {
  const methodColor = method === 'GET' ? '#41B93D' : 
                     method === 'POST' ? '#3871C2' : 
                     method === 'PUT' ? '#F68713' : 
                     method === 'DELETE' ? '#DC2626' : '#6B7280';
  
  return (
    <div className="flex items-start gap-3 md:gap-4 p-3 md:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="px-2 md:px-3 py-1 rounded-md font-bold text-white text-xs md:text-sm" style={{ backgroundColor: methodColor }}>
        {method}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs md:text-sm break-words text-[#3871C2]">{path}</div>
        <div className="text-gray-600 dark:text-gray-400 text-xs md:text-sm mt-1">{description}</div>
      </div>
    </div>
  );
}

export default function ApiDocs() {
  const base = "http://127.0.0.1:8000";

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

  const walletTransactionsResponseExample = {
    items: [
      {
        id: 55,
        user_id: "MER-6377A5C9",
        transaction_type: "PayOut",
        credit_debit: "debit",
        order_id: "ORD1234568",
        order_token: null,
        payIn_mode: null,
        status: "InProgress",
        customer_id: null,
        amount: 10,
        settle_amount: 10.24,
        balance_amount: 74.26,
        charges: 0.2,
        gst: 0.04,
        reference_id: null,
        txn_id: "557179688",
        description: "Saving transfer test ₹10",
        instrument_mode: "IMPS",
        api_name: "universepay.direct",
        created_at: "2025-11-05T20:12:50",
        refund_id: null
      }
    ],
    meta: { page: 1, per_page: 20, total: 17, total_pages: 1 }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
        <div className="space-y-6">
      {/* other sections */}
      <ProviderCredentials />
    </div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">API Documentation</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Integration guides and endpoints for RootPay merchant APIs</p>
        <div className="mt-4 p-3 md:p-4 rounded-lg border border-[#00ADEF]/30 bg-[#F0F9FF] dark:bg-gray-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-4 md:h-5 w-4 md:w-5" style={{ color: '#3871C2' }} />
            <span className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Base URL</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <code className="text-sm md:text-lg font-mono break-all" style={{ color: '#3871C2' }}>{base}</code>
            <Button
              onClick={() => copyToClipboard(base)}
              size="sm"
              variant="outline"
              className="self-start sm:self-center"
              style={{ borderColor: '#00ADEF', color: '#3871C2' }}
            >
              <Copy className="h-3 w-3 md:h-4 md:w-4 mr-2" />
              Copy
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="p-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-md bg-[#41B93D]/10">
              <Key className="h-4 md:h-5 w-4 md:w-5 text-[#41B93D]" />
            </div>
            <h3 className="font-bold text-sm md:text-base text-gray-900 dark:text-gray-100">Authentication</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400 mb-3">Get your Bearer token for API access</p>
          <Button
            onClick={() => copyToClipboard(`${base}/api/v1/auth/login`)}
            size="sm"
            variant="outline"
            className="w-full text-xs md:text-sm"
            style={{ borderColor: '#00ADEF', color: '#3871C2' }}
          >
            <Copy className="h-3 w-3 mr-1 md:mr-2" />
            Copy Login URL
          </Button>
        </div>

        <div className="p-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-md bg-[#3871C2]/10">
              <Link className="h-4 md:h-5 w-4 md:w-5 text-[#3871C2]" />
            </div>
            <h3 className="font-bold text-sm md:text-base text-gray-900 dark:text-gray-100">PayIn (Initiate)</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400 mb-3">Accept customer payments via payment link</p>
          <Button
            onClick={() => copyToClipboard(`${base}/live/payin/initiate`)}
            size="sm"
            variant="outline"
            className="w-full text-xs md:text-sm"
            style={{ borderColor: '#00ADEF', color: '#3871C2' }}
          >
            <Copy className="h-3 w-3 mr-1 md:mr-2" />
            Copy PayIn URL
          </Button>
        </div>

        <div className="p-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-md bg-[#F68713]/10">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 text-[#F68713]" />
            </div>
            <h3 className="font-bold text-sm md:text-base text-gray-900 dark:text-gray-100">Payouts (PayOut)</h3>
          </div>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400 mb-3">Send money to bank accounts</p>
          <Button
            onClick={() => copyToClipboard(`${base}/live/payout/initiate`)}
            size="sm"
            variant="outline"
            className="w-full text-xs md:text-sm"
            style={{ borderColor: '#00ADEF', color: '#3871C2' }}
          >
            <Copy className="h-3 w-3 mr-1 md:mr-2" />
            Copy Payout URL
          </Button>
        </div>
      </div>

      {/* All Endpoints Overview */}
      <Section title="API Endpoints Overview">
        <div className="space-y-3">
          <EndpointCard
            method="POST"
            path="/api/v1/auth/login"
            description="Obtain Bearer token (form-urlencoded: username & password)"
          />
          <EndpointCard
            method="POST"
            path="/live/payin/initiate"
            description="Initiate PayIn — creates transaction & returns payment_url"
          />
          <EndpointCard
            method="GET"
            path="/live/payin/ticket-sizes"
            description="Get available ticket sizes for active provider (if required)"
          />
          <EndpointCard
            method="POST"
            path="/live/payin/upi-intent"
            description="UPI Intent PayIn — returns intent_url & qr_data for direct UPI pay"
          />
          <EndpointCard
            method="GET"
            path="/live/payin/txns/status"
            description="Check PayIn status by order_id or merchantOrderId"
          />
          <EndpointCard
            method="GET"
            path="/api/v1/merchant/wallet-transactions"
            description="Paginated wallet transactions with charges, GST, settle_amount"
          />
          <EndpointCard
            method="POST"
            path="/live/payout/initiate"
            description="Initiate payout to bank (IMPS/NEFT/RTGS) with charges + GST"
          />
          <EndpointCard
            method="POST"
            path="/live/payout/txns/status"
            description="Check payout status by order_id (auto-detects provider)"
          />
        </div>
      </Section>

      {/* Authentication Section */}
      <Section
        title="1. Authentication"
        description="Obtain Bearer token via OAuth2 password flow. Token expires in 180 minutes (10800 seconds)."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>POST /api/v1/auth/login</h4>
            <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border" style={{ borderColor: '#00ADEF' }}>
              <div className="text-xs md:text-sm font-medium mb-2">Content-Type: <CodeInline>application/x-www-form-urlencoded</CodeInline></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>username</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Your merchant username (required)</div>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>password</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Your merchant password (required)</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>cURL Example</h4>
            <Code>{`curl -X POST ${base}/api/v1/auth/login \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "username=your_username&password=your_password"`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response (200 OK)</h4>
            <Code>{JSON.stringify(loginResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "access_token", desc: "JWT token for Authorization header" },
                { field: "token_type", desc: "Always \"bearer\"" },
                { field: "role", desc: "User role (2 = merchant)" },
                { field: "expires_in", desc: "Token lifetime in seconds (10800)" },
                { field: "expires_at", desc: "ISO 8601 UTC expiry timestamp" },
              ].map((item) => (
                <div key={item.field} className="p-2 bg-white dark:bg-gray-800 rounded-lg border" style={{ borderColor: '#00ADEF' }}>
                  <div className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#41B93D', backgroundColor: '#F0FDF4' }}>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#41B93D' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Usage</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  Send the token in all subsequent requests: <CodeInline>Authorization: Bearer {"<access_token>"}</CodeInline>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#DC2626', backgroundColor: '#FEF2F2' }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#DC2626' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#DC2626' }}>Error (401)</div>
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
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>POST /live/payin/initiate</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline> &bull; KYC must be verified &bull; Active PayIn provider required
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Request Body (JSON)</h4>
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
                <div key={item.field} className="p-3 bg-white dark:bg-gray-800 rounded-lg border" style={{ borderColor: '#00ADEF' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>{item.field}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.type}</span>
                    {item.req === "Yes" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500">required</span>}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Request Example</h4>
            <Code>{JSON.stringify(payinRequestExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>cURL Example</h4>
            <Code>{`curl -X POST ${base}/live/payin/initiate \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payinRequestExample)}'`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response (200 OK)</h4>
            <Code>{JSON.stringify(payinResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "success", desc: "true if payment initiated" },
                { field: "provider", desc: "Active payment gateway used" },
                { field: "order_id", desc: "Your merchantOrderId echoed back" },
                { field: "txn_id", desc: "Internal wallet transaction ID" },
                { field: "payment_url", desc: "Redirect customer to this URL to pay" },
              ].map((item) => (
                <div key={item.field} className="p-2 bg-white dark:bg-gray-800 rounded-lg border" style={{ borderColor: '#00ADEF' }}>
                  <div className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#F68713', backgroundColor: '#FEF6EC' }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#F68713' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Errors</div>
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
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>GET /live/payin/ticket-sizes</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>cURL Example</h4>
            <Code>{`curl -X GET ${base}/live/payin/ticket-sizes \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response — ticket sizes required</h4>
            <Code>{JSON.stringify(ticketSizesResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response — ticket sizes NOT required</h4>
            <Code>{JSON.stringify(ticketSizesNotRequiredExample, null, 2)}</Code>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#F68713', backgroundColor: '#FEF6EC' }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#F68713' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Note</div>
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
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>POST /live/payin/upi-intent</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline> &bull; KYC verified &bull; Same request body as <CodeInline>/live/payin/initiate</CodeInline>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>cURL Example</h4>
            <Code>{`curl -X POST ${base}/live/payin/upi-intent \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payinRequestExample)}'`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response (200 OK)</h4>
            <Code>{JSON.stringify(upiIntentResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response Fields</h4>
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
                <div key={item.field} className="p-2 bg-white dark:bg-gray-800 rounded-lg border" style={{ borderColor: '#00ADEF' }}>
                  <div className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#41B93D', backgroundColor: '#F0FDF4' }}>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#41B93D' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Usage</div>
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
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Webhook Payload (sent to your URL)</h4>
            <Code>{JSON.stringify(webhookPayloadExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Payload Fields</h4>
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
                <div key={item.field} className="p-2 bg-white dark:bg-gray-800 rounded-lg border" style={{ borderColor: '#00ADEF' }}>
                  <div className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#41B93D', backgroundColor: '#F0FDF4' }}>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#41B93D' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Fee Calculation</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div><CodeInline>charges</CodeInline> = amount x payInCharges%</div>
                  <div><CodeInline>gst</CodeInline> = charges x 18%</div>
                  <div><CodeInline>settle_amount</CodeInline> = amount - charges - gst</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#F68713', backgroundColor: '#FEF6EC' }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#F68713' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Important</div>
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
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>GET /live/payin/txns/status?order_id={"<ORDER_ID>"}</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline>. Also accepts <CodeInline>merchantOrderId</CodeInline> as query param.
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>cURL Example</h4>
            <Code>{`curl -X GET '${base}/live/payin/txns/status?order_id=ORD-A1B2C3D4E5F6' \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response (200 OK)</h4>
            <Code>{JSON.stringify(payinStatusResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response Fields</h4>
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
                <div key={item.field} className="p-2 bg-white dark:bg-gray-800 rounded-lg border" style={{ borderColor: '#00ADEF' }}>
                  <div className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>{item.field}</div>
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
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>GET /api/v1/merchant/wallet-transactions</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>cURL Example</h4>
            <Code>{`curl -X GET "${base}/api/v1/merchant/wallet-transactions?page=1&per_page=20" \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response</h4>
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
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>POST /live/payout/initiate</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline> &bull; IP whitelist checked if configured
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Request Body (JSON)</h4>
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
                <div key={item.field} className="p-3 bg-white dark:bg-gray-800 rounded-lg border" style={{ borderColor: '#00ADEF' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>{item.field}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.type}</span>
                    {item.req === "Yes" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500">required</span>}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Request Example</h4>
            <Code>{JSON.stringify(payoutRequestExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>cURL Example</h4>
            <Code>{`curl -X POST ${base}/live/payout/initiate \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payoutRequestExample)}'`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response (200 OK)</h4>
            <Code>{JSON.stringify(payoutResponseExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "success", desc: "true if payout initiated" },
                { field: "order_id", desc: "Your order ID echoed back" },
                { field: "debit_amount", desc: "Total debited = amount + charges + GST" },
                { field: "provider", desc: "Payout provider used" },
                { field: "status", desc: "\"pending\" — final status arrives via webhook" },
              ].map((item) => (
                <div key={item.field} className="p-2 bg-white dark:bg-gray-800 rounded-lg border" style={{ borderColor: '#00ADEF' }}>
                  <div className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#41B93D', backgroundColor: '#F0FDF4' }}>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#41B93D' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Fee Calculation</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>Amount &le; ₹1000 → flat charge (payOutChargesFlat)</div>
                  <div>Amount &gt; ₹1000 → percentage charge (payOutCharges%)</div>
                  <div><CodeInline>GST</CodeInline> = charges × 18%</div>
                  <div><CodeInline>debit_amount</CodeInline> = amount + charges + GST</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#F68713', backgroundColor: '#FEF6EC' }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#F68713' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Errors</div>
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
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Webhook Payload (sent to your URL)</h4>
            <Code>{JSON.stringify(payoutWebhookExample, null, 2)}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Payload Fields</h4>
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
                <div key={item.field} className="p-2 bg-white dark:bg-gray-800 rounded-lg border" style={{ borderColor: '#00ADEF' }}>
                  <div className="font-mono text-xs font-bold" style={{ color: '#3871C2' }}>{item.field}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#F68713', backgroundColor: '#FEF6EC' }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#F68713' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Important</div>
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
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>POST /live/payout/txns/status?order_id={"<ORDER_ID>"}</h4>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Requires <CodeInline>Authorization: Bearer {"<token>"}</CodeInline>. Accepts order_id, txn_id, or reference_id.
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>cURL Example</h4>
            <Code>{`curl -X POST '${base}/live/payout/txns/status?order_id=PAYOUT_A1B2C3D4E5' \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`}</Code>
          </div>

          <div>
            <h4 className="font-bold mb-2 text-sm md:text-base" style={{ color: '#3871C2' }}>Response</h4>
            <Code>{JSON.stringify(payoutStatusResponseExample, null, 2)}</Code>
          </div>

          <div className="p-3 md:p-4 rounded-lg border" style={{ borderColor: '#41B93D', backgroundColor: '#F0FDF4' }}>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 md:h-5 w-4 md:w-5 mt-0.5" style={{ color: '#41B93D' }} />
              <div>
                <div className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>Auto-Update</div>
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  If the upstream provider reports SUCCESS or FAILED, the transaction status
                  is automatically updated. Failed payouts are refunded to your payout wallet.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Quick Copy Buttons */}
      <div className="p-4 md:p-6 rounded-xl border border-[#00ADEF]/30 bg-[#F0F9FF] dark:bg-gray-800/50">
        <h3 className="text-lg font-semibold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">Quick Copy URLs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
          {[
            { label: 'Login', url: `${base}/api/v1/auth/login` },
            { label: 'PayIn Initiate', url: `${base}/live/payin/initiate` },
            { label: 'Ticket Sizes', url: `${base}/live/payin/ticket-sizes` },
            { label: 'UPI Intent', url: `${base}/live/payin/upi-intent` },
            { label: 'Wallet Transactions', url: `${base}/api/v1/merchant/wallet-transactions` },
            { label: 'PayIn Status', url: `${base}/live/payin/txns/status?order_id=<ORDER_ID>` },
            { label: 'Payout Initiate', url: `${base}/live/payout/initiate` },
            { label: 'Payout Status', url: `${base}/live/payout/txns/status?order_id=<ORDER_ID>` },
          ].map((item) => (
            <Button
              key={item.label}
              onClick={() => copyToClipboard(item.url)}
              variant="outline"
              className="justify-start text-xs md:text-sm"
              style={{ borderColor: '#00ADEF', color: '#3871C2' }}
            >
              <Copy className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Footer Note */}
      <div className="p-3 md:p-4 rounded-lg border text-center" style={{ borderColor: '#41B93D', backgroundColor: '#F0FDF4' }}>
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="h-4 md:h-5 w-4 md:w-5" style={{ color: '#41B93D' }} />
          <span className="font-medium text-sm md:text-base" style={{ color: '#3871C2' }}>All endpoints require Bearer token authentication</span>
        </div>
      </div>
    </div>
  );
}