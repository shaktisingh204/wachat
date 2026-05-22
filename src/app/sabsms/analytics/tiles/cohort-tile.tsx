import Link from "next/link";

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
} from "@/components/zoruui";

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
    <ZoruCard>
      <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <ZoruCardTitle>Cohort retention</ZoruCardTitle>
          <ZoruCardDescription>
            Weekly cohorts × weeks-since-first-send. Darker = more retained.
          </ZoruCardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={drilldownHref}
            className="text-zoru-ink-muted hover:text-zoru-ink"
          >
            Open in logs
          </Link>
          <TileActions
            metric="cohort"
            tileId="cohort"
            queryString={queryString}
          />
        </div>
      </ZoruCardHeader>
      <ZoruCardContent>
        {rows.size === 0 ? (
          <p className="py-12 text-center text-sm text-zoru-ink-muted">
            Not enough data to compute cohorts.
          </p>
        ) : (
          <div className="space-y-1">
            {Array.from(rows.entries()).map(([cohort, list]) => (
              <div key={cohort} className="flex items-center gap-2">
                <span className="w-20 font-mono text-xs text-zoru-ink-muted">
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
                        className="h-6 flex-1 rounded-sm border border-zoru-line"
                        style={{
                          backgroundColor: `hsl(var(--zoru-ink) / ${
                            0.08 + intensity * 0.72
                          })`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ZoruCardContent>
    </ZoruCard>
  );
}
