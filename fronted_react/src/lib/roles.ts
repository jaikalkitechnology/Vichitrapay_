import { PARTNER_PANEL_ENABLED } from "@/lib/features";

/** Landing path for each user role (1 partner, 2 merchant, 3 admin). */
export const homeForRole = (role?: number | null) => (role === 3 ? "/admin" : role === 1 && PARTNER_PANEL_ENABLED ? "/partner" : role === 2 ? "/merchant" : "/login");
