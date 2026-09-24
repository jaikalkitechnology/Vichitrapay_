import api from "@/api/api";
import { BASE_URL } from "@/config";

/** Download /admin/report/download (CSV, max 10,000 rows) for the given filters. */
export async function downloadReportCsv(params: {
  merchant_id?: string;
  transaction_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
  const res = await api.get(`${BASE_URL}/admin/report/download`, { params: clean, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  const tag = [params.date_from, params.date_to].filter(Boolean).join("_to_") || new Date().toISOString().slice(0, 10);
  link.setAttribute("download", `vichitrapay_report_${tag}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
