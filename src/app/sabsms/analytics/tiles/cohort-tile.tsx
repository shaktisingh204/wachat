import Link from "next/link";

import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';

import { TileActions } from "./tile-actions";
import type { SabsmsCohortCell } from "../aggregations";

export interface CohortTileProps {
  cells: SabsmsCohortCell[];
  drilldownHref: string;
  queryString: string;
}

/**
 * Cohort retention heatmap — a simple hand-rolled grid of color-graded
 * divs. Saturation tracks `retained` relative to the cohort's peak.
 */
export function CohortTile({
  cells,
  drilldownHref,
  queryString,
}: CohortTileProps) {
  const peak = cells.reduce((m, c) => Math.max(m, c.retained), 0);

  // Group cells by cohort row.
  const rows = new Map<string, SabsmsCohortCell[]>();
  for (const c of cells) {
    let list = rows.get(c.cohort);
    if (!list) {
      list = [];
      rows.set(c.cohort, list);
    }
    list.push(c);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Cohort retention</CardTitle>
          <CardDescription>
            Weekly cohorts × weeks-since-first-send. Darker = more retained.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={drilldownHref}
            className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          >
            Open in logs
          </Link>
          <TileActions
            metric="cohort"
            tileId="cohort"
            queryString={queryString}
          />
        </div>
      </CardHeader>
      <CardBody>
        {rows.size === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--st-text-secondary)]">
            Not enough data to compute cohorts.
          </p>
        ) : (
          <div className="space-y-1">
            {Array.from(rows.entries()).map(([cohort, list]) => (
              <div key={cohort} className="flex items-center gap-2">
                <span className="w-20 font-mono text-xs text-[var(--st-text-secondary)]">
                  {cohort}
                </span>
                <div className="flex flex-1 gap-1">
                  {list.map((c) => {
                    const intensity =
                      peak > 0 ? Math.min(1, c.retained / peak) : 0;
                    return (
                      <div
                        key={`${cohort}-${c.weekOffset}`}
                        title={`${cohort} · w+${c.weekOffset}: ${c.retained}`}
                        className="h-6 flex-1 rounded-sm border border-[var(--st-border)]"
                        style={{
                          backgroundColor: `color-mix(in srgb, var(--st-text) calc(${
                            0.08 + intensity * 0.72
                          } * 100%), transparent)`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
