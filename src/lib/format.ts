import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Centrally formatted currency for k-fin
 */
export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Centrally formatted dates
 */
export function formatDate(date: string | Date, pattern = 'dd.MM.yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern, { locale: de });
}

/**
 * Relative date formatting
 */
export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { locale: de, addSuffix: true });
}
