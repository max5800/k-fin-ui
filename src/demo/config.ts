export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export const DEMO_TOKEN = 'demo-token';
export const DEMO_EMAIL = 'demo@k-fin.local';
export const DEMO_DISPLAY_NAME = 'Demo';

export function ensureDemoSession(): void {
  if (!DEMO_MODE) return;
  localStorage.setItem('kfin_token', DEMO_TOKEN);
  localStorage.setItem('kfin_display_name', DEMO_DISPLAY_NAME);
}

export function clearDemoSession(): void {
  if (!DEMO_MODE) return;
  localStorage.removeItem('kfin_token');
  localStorage.removeItem('kfin_display_name');
}
