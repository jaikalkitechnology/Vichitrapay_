// // api.ts
// import axios from 'axios';
// import { BASE_URL } from '@/config';

// const api = axios.create({
//   baseURL: BASE_URL,
// });

// // Request interceptor
// api.interceptors.request.use(
//   (config) => {
//     const storedUser = localStorage.getItem('gurutvapay-user');
//     if (storedUser) {
//       const user = JSON.parse(storedUser);
//       if (user?.accessToken) {
//         config.headers.Authorization = `Bearer ${user.accessToken}`;
//       }
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// // Response interceptor
// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     const response = error.response;

//     if (response) {
//       // Check for 401 status or token expired message
//       const msg = response?.data?.detail || '';
//       const tokenExpired = response.status === 401 || msg.toLowerCase().includes('token expired');

//       if (tokenExpired) {
//         localStorage.removeItem('gurutvapay-user'); // Clear user from local storage
//         window.location.href = '/login'; // Redirect to login
//         return Promise.reject(new Error('Session expired. Please log in again.'));
//       }
//     }

//     return Promise.reject(error);
//   }
// );

// export default api;


// api.ts
import axios, { AxiosError } from 'axios';
import { BASE_URL } from '@/config';

const api = axios.create({
  baseURL: BASE_URL,
});

// --- helpers ----------------------------------------------------

function stringifyUnknown(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;

  // FastAPI validation errors: {detail: [{loc:..., msg: '...', type: '...'}]}
  if (Array.isArray(val)) {
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  if (typeof val === 'object') {
    // Some backends send Blob for HTML error pages, ignore content
    if (typeof (val as any).text === 'function' || typeof (val as any).arrayBuffer === 'function') {
      return '';
    }
    try { return JSON.stringify(val as Record<string, unknown>); } catch { return String(val); }
  }
  return String(val);
}

function extractErrorMessage(data: any): string {
  // prefer typical keys; fall back to whole payload
  const candidates = [
    data?.detail,
    data?.message,
    data?.error,
    data?.errors,
    data?.msg,
    data?.reason,
  ];
  const first = candidates.find(v => v !== undefined && v !== null);
  if (typeof first === 'string') return first;

  // FastAPI validation: detail: [{msg: '...'}]
  if (Array.isArray(first) && first.length && typeof first[0]?.msg === 'string') {
    return first.map((x: any) => x?.msg).filter(Boolean).join('; ');
  }
  return stringifyUnknown(first ?? data);
}

function toLowerSafe(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase() : stringifyUnknown(s).toLowerCase();
}

function isTokenExpiredStatus(status?: number): boolean {
  return status === 401; // add 419/440 if your backend uses them
}

function isTokenExpiredMessage(msg: string): boolean {
  if (!msg) return false;
  const m = toLowerSafe(msg);
  return (
    m.includes('token expired') ||
    m.includes('jwt expired') ||
    m.includes('session expired') ||
    m.includes('signature has expired') ||
    m.includes('invalid or expired')
  );
}

function redirectToLoginOnce() {
  // avoid redirect loops on /login itself
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    localStorage.removeItem('gurutvapay-user');
    window.location.href = '/login';
  }
}

// ----------------------------------------------------------------

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    const storedUser = localStorage.getItem('gurutvapay-user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user?.accessToken) {
          config.headers = config.headers ?? new axios.AxiosHeaders();
          config.headers.set('Authorization', `Bearer ${user.accessToken}`);
        }
      } catch {
        // bad JSON in storage – clear it
        localStorage.removeItem('gurutvapay-user');
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: normalize errors and handle auth expiry
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    // Network error (no response)
    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your connection.'));
    }

    const { status, data } = error.response;
    const msg = extractErrorMessage(data);

    if (isTokenExpiredStatus(status) || isTokenExpiredMessage(msg)) {
      redirectToLoginOnce();
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }

    // Re-throw with a clean message so UI never sees non-strings
    const clean = msg || `Request failed with status ${status}`;
    return Promise.reject(new Error(clean));
  }
);

export default api;
