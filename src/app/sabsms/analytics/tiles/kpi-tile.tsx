import Link from "next/link";

import { Button, StatCard } from "@/components/zoruui";

import { TileActions } from "./tile-actions";

/**
 * KPI tile — renders one `ZoruStatCard` with optional delta vs the
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
}: KpiTileProps) {
  const delta = deltaPct(value, previous);

  return (
    <div className="relative">
      <StatCard
        label={label}
        value={value.toLocaleString()}
        delta={delta}
        invertDelta={invertDelta}
        period={period ?? (delta !== undefined ? "vs previous" : undefined)}
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
