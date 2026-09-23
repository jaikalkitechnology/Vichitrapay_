// src/utils/errors.ts
export type FieldErrors = Record<string, string[]> | undefined;

function normalizeToString(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  // Common shapes: { msg: "..."} or { message: "..." }
  if (typeof val === "object") {
    if (typeof val.msg === "string") return val.msg;
    if (typeof val.message === "string") return val.message;
    // arrays -> join members
    if (Array.isArray(val)) return val.map(normalizeToString).filter(Boolean).join("; ");
  }
  try {
    return JSON.stringify(val);
  } catch {
    try { return String(val); } catch { return ""; }
  }
}

/**
 * Extract a safe string message and optional fieldErrors from many common error shapes
 * (fetch/axios, FastAPI 422, our own API helper, Error objects, plain strings, etc).
 */
export function extractErrorMessage(err: any): { message: string; fieldErrors?: FieldErrors } {
  let message = "An error occurred";
  let fieldErrors: FieldErrors = undefined;

  try {
    if (!err) return { message, fieldErrors };

    // If error is a plain string
    if (typeof err === "string") {
      return { message: err, fieldErrors };
    }

    // If already normalized shape (we might throw these from api helper)
    if (err && typeof err === "object" && typeof err.message === "string" && (err.fieldErrors || err.payload || err.response || err.message)) {
      // ensure message is string
      message = normalizeToString(err.message);
      if (err.fieldErrors && typeof err.fieldErrors === "object") fieldErrors = err.fieldErrors;
      return { message, fieldErrors };
    }

    // Common: err.fieldErrors (structured)
    if (err.fieldErrors && typeof err.fieldErrors === "object") {
      fieldErrors = err.fieldErrors;
      const firstField = Object.keys(fieldErrors)[0];
      const firstMsg = fieldErrors[firstField]?.[0];
      message = firstMsg ? `${firstField}: ${normalizeToString(firstMsg)}` : normalizeToString(err.fieldErrors);
      return { message, fieldErrors };
    }

    // Look for payloads from fetch/axios or server:
    const payload = err?.payload ?? err?.response?.data ?? err?.response ?? err;

    // FastAPI / pydantic validation: payload.detail is an array of { loc, msg, type }
    if (payload) {
      const detail = payload.detail ?? payload.error ?? payload.errors ?? null;

      if (Array.isArray(detail)) {
        // build messages
        const msgs = detail
          .map((d: any) => {
            if (!d) return "";
            if (typeof d.msg === "string") return d.msg;
            if (typeof d.message === "string") return d.message;
            // fallback to the whole object
            return normalizeToString(d);
          })
          .filter(Boolean);
        if (msgs.length) message = msgs.join("; ");
        // build fieldErrors map if possible
        const map: Record<string, string[]> = {};
        for (const it of detail) {
          try {
            const loc = Array.isArray(it.loc) ? it.loc.slice(1).join(".") : String(it.loc ?? "");
            const m = typeof it.msg === "string" ? it.msg : typeof it.message === "string" ? it.message : normalizeToString(it);
            if (!map[loc]) map[loc] = [];
            map[loc].push(m);
          } catch {
            // ignore
          }
        }
        if (Object.keys(map).length) fieldErrors = map;
        // If we found fieldErrors, prefer returning them
        return { message: normalizeToString(message), fieldErrors };
      }

      // payload.detail could be a simple string
      if (typeof payload.detail === "string") {
        return { message: normalizeToString(payload.detail), fieldErrors };
      }

      // other common shapes
      if (typeof payload.message === "string") return { message: normalizeToString(payload.message), fieldErrors };
      if (typeof payload.error === "string") return { message: normalizeToString(payload.error), fieldErrors };
    }

    // Common Error object: err.message or err.msg
    if (typeof err.message === "string") {
      message = normalizeToString(err.message);
      return { message, fieldErrors };
    }
    if (typeof err.msg === "string") {
      message = normalizeToString(err.msg);
      return { message, fieldErrors };
    }

    // As a last resort, stringify the error
    message = normalizeToString(err);
    return { message, fieldErrors };
  } catch (e) {
    // If extraction fails for any reason, fallback to a safe message
    return { message: "An error occurred", fieldErrors: undefined };
  }
}

/**
 * Optional helper: safe toLowerCase which never throws.
 * Use this when you must call toLowerCase on an unknown value.
 */
export function safeToLower(val: any): string {
  const s = normalizeToString(val);
  return s.toLowerCase();
}
