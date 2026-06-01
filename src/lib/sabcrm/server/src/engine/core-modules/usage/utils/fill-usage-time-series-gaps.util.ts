import { type UsageTimeSeriesPoint } from "@/lib/sabcrm/server/src/engine/core-modules/usage/services/usage-analytics.service";

type FillUsageTimeSeriesGapsParams = {
  rows: UsageTimeSeriesPoint[];
  periodStart: Date;
  periodEnd: Date;
};

// Parses "YYYY-MM-DD" or an ISO string into a plain { year, month, day } object
function parsePlainDate(value: string): { year: number; month: number; day: number } {
  const d = new Date(value);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function plainDateToString(pd: { year: number; month: number; day: number }): string {
  const mm = String(pd.month).padStart(2, "0");
  const dd = String(pd.day).padStart(2, "0");
  return `${pd.year}-${mm}-${dd}`;
}

function addDays(pd: { year: number; month: number; day: number }, days: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(pd.year, pd.month - 1, pd.day));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function isBeforeOrEqual(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): boolean {
  if (a.year !== b.year) return a.year < b.year;
  if (a.month !== b.month) return a.month < b.month;
  return a.day <= b.day;
}

function isAfter(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): boolean {
  return !isBeforeOrEqual(a, b);
}

export const fillUsageTimeSeriesGaps = ({
  rows,
  periodStart,
  periodEnd,
}: FillUsageTimeSeriesGapsParams): UsageTimeSeriesPoint[] => {
  const startDate = parsePlainDate(periodStart.toISOString());
  const lastIncludedInstant = new Date(periodEnd.getTime() - 1);
  const endDate = parsePlainDate(lastIncludedInstant.toISOString());

  if (isAfter(startDate, endDate)) {
    return [];
  }

  const rowsByDate = new Map<string, UsageTimeSeriesPoint>();
  for (const row of rows) {
    rowsByDate.set(row.date, row);
  }

  const filled: UsageTimeSeriesPoint[] = [];
  let cursor = startDate;

  while (isBeforeOrEqual(cursor, endDate)) {
    const key = plainDateToString(cursor);
    const existing = rowsByDate.get(key);
    filled.push(existing ?? { date: key, creditsUsed: 0 });
    cursor = addDays(cursor, 1);
  }

  return filled;
};
