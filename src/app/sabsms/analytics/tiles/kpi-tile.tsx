import Link from "next/link";

import { Button, StatCard } from '@/components/sabcrm/20ui';

import { TileActions } from "./tile-actions";

/**
 * KPI tile — renders one `Ui20StatCard` with optional delta vs the
 * compare-to window plus a "Open in logs" drill-down and an "AI explain"
 * action surfaced through `TileActions`.
 */

export interface KpiTileProps {
  metric: string;
  label: string;
  value: number;
  /** Previous-period value for the delta calculation. */
  previous?: number;
  /** Where this tile drills down to in `/sabsms/logs`. */
  drilldownHref: string;
  /** Encoded query string passed back to server actions. */
  queryString: string;
  /** When true, "up = bad" (e.g. failed, opt-out). */
  invertDelta?: boolean;
  /** When true, "up = good" but compare delta logic stays the same. */
  period?: string;
  /** Rendered after the value (e.g. "%" for rate KPIs). */
  suffix?: string;
}

function deltaPct(value: number, previous?: number): number | undefined {
  if (previous === undefined || previous === null) return undefined;
  if (previous === 0) return value === 0 ? 0 : 100;
  return Math.round(((value - previous) / previous) * 100);
}

export function KpiTile({
  metric,
  label,
  value,
  previous,
  drilldownHref,
  queryString,
  invertDelta,
  period,
  suffix,
}: KpiTileProps) {
  const delta = deltaPct(value, previous);
  // StatCard takes a pre-formatted `{ value, tone }` delta; tone encodes
  // good/bad, so inverted metrics (failed, opt-outs) flip it.
  const deltaProp =
    delta === undefined
      ? undefined
      : {
          value: `${delta > 0 ? "+" : ""}${delta}% ${period ?? "vs previous"}`,
          tone:
            delta === 0
              ? ("neutral" as const)
              : delta > 0 !== Boolean(invertDelta)
                ? ("up" as const)
                : ("down" as const),
        };

  return (
    <div className="relative">
      <StatCard
        label={label}
        value={`${value.toLocaleString()}${suffix ?? ""}`}
        delta={deltaProp}
      />
      <div className="mt-1 flex items-center justify-between gap-1 px-1 text-xs text-[var(--st-text-secondary)]">
        <Button asChild size="sm" variant="ghost" className="h-6 px-2">
          <Link href={drilldownHref}>Open in logs</Link>
        </Button>
        <TileActions
          metric={metric}
          tileId={`kpi-${metric}`}
          queryString={queryString}
          context={{ value, previous }}
        />
      </div>
    </div>
  );
}
