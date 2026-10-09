// Admin → System Logs (backend: app/routers/system_logs.py)
import api from "@/api/api";
import { BASE_URL } from "@/config";

const L = `${BASE_URL}/admin/logs`;

export type LogKind = "phonepe" | "deliveries" | "instruments" | "received";

export type LogFilters = {
  search?: string;
  status?: string;
  tsp?: string;
  domain?: string;
  from_date?: string;
  to_date?: string;
  page: number;
  per_page: number;
};

export type PhonePeLog = { id: number; source_ip: string | null; status: string | null; reason: string | null; has_data: boolean; created_at: string | null };
export type DeliveryLog = {
  id: number;
  merchant_id: string | null;
  order_id: string | null;
  url: string | null;
  http_status: number | null;
  status: string | null;
  attempt: number | null;
  error: string | null;
  response_time_ms: number | null;
  created_at: string | null;
};
export type InstrumentLog = {
  id: number;
  merchant_id: string | null;
  order_id: string | null;
  amount: number | null;
  tsp: string | null;
  ip: string | null;
  domain: string | null;
  identity_key: string | null;
  instrument_type: string | null;
  status: string | null;
  created_at: string | null;
};

/** A webhook received at Vichitrapay's own receiver, POST /api/v1/webhook (app/routers/webhook_receiver.py) */
export type ReceivedWebhook = {
  id: number;
  merchant_id: string | null;
  order_id: string | null;
  event: string | null;
  status: string | null;
  amount: number | null;
  settle_amount: number | null;
  utr: string | null;
  source_ip: string | null;
  created_at: string | null;
};

export type LogSummary = { total: number; success: number; failed: number; success_amount: number };

export type LogPage<T> = { items: T[]; total: number; page: number; per_page: number; statuses: string[]; tsps?: string[]; domains?: string[]; summary?: LogSummary };

const LOG_URL: Record<LogKind, string> = {
  phonepe: `${L}/phonepe-webhooks`,
  deliveries: `${L}/webhook-deliveries`,
  instruments: `${L}/instruments`,
  received: `${BASE_URL}/webhook`,
};

/** The receiver's public address — set it as a merchant's Webhook URL. */
export const RECEIVER_URL = `${BASE_URL}/webhook`;

const clean = (p: LogFilters) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== ""));

export async function fetchLogs(kind: "phonepe", f: LogFilters): Promise<LogPage<PhonePeLog>>;
export async function fetchLogs(kind: "deliveries", f: LogFilters): Promise<LogPage<DeliveryLog>>;
export async function fetchLogs(kind: "instruments", f: LogFilters): Promise<LogPage<InstrumentLog>>;
export async function fetchLogs(kind: "received", f: LogFilters): Promise<LogPage<ReceivedWebhook>>;
export async function fetchLogs(kind: LogKind, f: LogFilters) {
  return (await api.get(LOG_URL[kind], { params: clean(f) })).data;
}

export const fetchLogDetail = async (kind: LogKind, id: number): Promise<Record<string, unknown>> =>
  (await api.get(`${LOG_URL[kind]}/${id}`)).data;
