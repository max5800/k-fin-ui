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
  // portfolio
  'total_value',
  'total_purchase_value',
  'total_pnl_abs',
  'total_pnl_rel',
  'daily_pnl_abs',
  'daily_pnl_rel',
  'dividend_yield_pct',
  'weight_pct',
  'share_pct',
  'current_price',
  'current_value',
  'purchase_value',
  'prev_day_price',
  'quantity',
  'price',
  'value',
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
