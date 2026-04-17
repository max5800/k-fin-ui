import axios from 'axios';

const apiBaseUrl =
  (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('kfin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Fields the backend serializes as Decimal strings. Parse to number at the boundary.
const DECIMAL_FIELDS = new Set([
  'amount',
  'income',
  'expenses',
  'net',
  'savings_rate',
  'monthly_limit',
  'total',
]);

function parseDecimals(data: unknown): unknown {
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(parseDecimals);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (DECIMAL_FIELDS.has(key) && typeof value === 'string') {
      const parsed = Number(value);
      out[key] = Number.isFinite(parsed) ? parsed : value;
    } else {
      out[key] = parseDecimals(value);
    }
  }
  return out;
}

apiClient.interceptors.response.use(
  (response) => {
    response.data = parseDecimals(response.data);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('kfin_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
