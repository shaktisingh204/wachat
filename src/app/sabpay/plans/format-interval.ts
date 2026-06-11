/**
 * SabPay — human label for a plan's billing interval.
 *
 * Plain shared module (no directive) so both server detail pages and client
 * list components can import it: `formatPlanInterval('monthly', 1)` → "/ month",
 * `formatPlanInterval('weekly', 2)` → "/ 2 weeks".
 */

const UNIT_BY_INTERVAL: Record<string, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

export function formatPlanInterval(interval: string, intervalCount = 1): string {
  const unit = UNIT_BY_INTERVAL[interval] ?? interval;
  return intervalCount <= 1 ? `/ ${unit}` : `/ ${intervalCount} ${unit}s`;
}
