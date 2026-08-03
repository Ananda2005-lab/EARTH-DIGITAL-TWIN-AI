import { formatCurrency, formatCompact, formatNumber, formatPercent } from '@edt/shared';

/**
 * World Bank indicators arrive in wildly different units (USD, %, years, tonnes…).
 * Both the rankings table and the correlation table need the same rendering so a
 * value never reads inconsistently between the two views.
 */
export function formatIndicatorValue(value: number, unit: string): string {
  if (unit === 'USD') return formatCurrency(value);
  if (unit === '%' || unit.startsWith('% of')) return formatPercent(value, 1);
  if (unit === 'years') return `${value.toFixed(1)} yrs`;
  if (unit === 'rank') return formatNumber(value, 0);
  if (unit === 'people' || unit === 'arrivals' || unit === 'passengers') {
    return formatCompact(value);
  }
  return formatNumber(value, Math.abs(value) >= 100 ? 0 : 1);
}
