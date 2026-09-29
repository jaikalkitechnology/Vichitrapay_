// Admin → System Logs (backend: app/routers/system_logs.py)
import api from "@/api/api";
import { BASE_URL } from "@/config";

const L = `${BASE_URL}/admin/logs`;

export type LogKind = "phonepe" | "deliveries" | "instruments";

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

export type LogPage<T> = { items: T[]; total: number; page: number; per_page: number; statuses: string[]; tsps?: string[]; domains?: string[] };

const PATH: Record<LogKind, string> = { phonepe: "phonepe-webhooks", deliveries: "webhook-deliveries", instruments: "instruments" };

const clean = (p: LogFilters) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== ""));

export async function fetchLogs(kind: "phonepe", f: LogFilters): Promise<LogPage<PhonePeLog>>;
export async function fetchLogs(kind: "deliveries", f: LogFilters): Promise<LogPage<DeliveryLog>>;
export async function fetchLogs(kind: "instruments", f: LogFilters): Promise<LogPage<InstrumentLog>>;
export async function fetchLogs(kind: LogKind, f: LogFilters) {
  return (await api.get(`${L}/${PATH[kind]}`, { params: clean(f) })).data;
}

export const fetchLogDetail = async (kind: LogKind, id: number): Promise<Record<string, unknown>> =>
  (await api.get(`${L}/${PATH[kind]}/${id}`)).data;
