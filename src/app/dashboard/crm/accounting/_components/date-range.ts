/**
 * Shared date-range helpers for accounting report pages.
 *
 * Defaults to the **Indian financial year** (Apr 1 → Mar 31) the current
 * date sits in. The FY runs from April of the start year to March of the
 * following year — e.g. on 2026-05-17 the FY is 2026-04-01 → 2027-03-31.
 */

export interface ReportRange {
  from: Date;
  to: Date;
  /** Display label like "FY 2026-2027". */
  label: string;
}

export function currentFinancialYear(now: Date = new Date()): ReportRange {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const fyStart = month >= 3 ? year : year - 1; // Apr (index 3) is the boundary
  const from = new Date(fyStart, 3, 1);
  const to = new Date(fyStart + 1, 2, 31, 23, 59, 59, 999);
  return {
    from,
    to,
    label: `FY ${fyStart}-${fyStart + 1}`,
  };
}

/**
 * Parse `from` / `to` ISO date strings from search params, applying the
 * current FY as a default fallback. Returns plain Date objects in UTC-ish
 * local time — callers should pass them straight through to the compute
 * helpers, which apply `startOfDay` / `endOfDay`.
 */
export function resolveRange(
  from: string | undefined,
  to: string | undefined,
): ReportRange {
  const fy = currentFinancialYear();
  const f = from ? new Date(`${from}T00:00:00`) : fy.from;
  const t = to ? new Date(`${to}T23:59:59`) : fy.to;
  return {
    from: Number.isNaN(f.getTime()) ? fy.from : f,
    to: Number.isNaN(t.getTime()) ? fy.to : t,
    label:
      from || to
        ? `${(from ? f : fy.from).toLocaleDateString()} – ${(to ? t : fy.to).toLocaleDateString()}`
        : fy.label,
  };
}

export function toISODateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resolveAsOf(asOf: string | undefined): Date {
  if (!asOf) return new Date();
  const d = new Date(`${asOf}T23:59:59`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}
