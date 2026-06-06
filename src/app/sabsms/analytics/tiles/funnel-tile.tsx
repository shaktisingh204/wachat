import Link from "next/link";

import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';

import { TileActions } from "./tile-actions";
import type { SabsmsFunnelStep } from "../aggregations";

export interface FunnelTileProps {
  steps: SabsmsFunnelStep[];
  drilldownHref: string;
  queryString: string;
}

export function FunnelTile({
  steps,
  drilldownHref,
  queryString,
}: FunnelTileProps) {
  const top = steps[0]?.value ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Funnel</CardTitle>
          <CardDescription>
            Sent → Delivered → Clicked → Replied, with drop-off between
            each step.
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
            metric="funnel"
            tileId="funnel"
            queryString={queryString}
          />
        </div>
      </CardHeader>
      <CardBody>
        <ol className="space-y-2">
          {steps.map((s) => {
            const widthPct = top > 0 ? Math.max(2, (s.value / top) * 100) : 0;
            return (
              <li key={s.step} className="flex items-center gap-3">
                <span className="w-24 text-sm text-[var(--st-text-secondary)]">
                  {s.step}
                </span>
                <div className="relative h-7 flex-1 overflow-hidden rounded bg-[var(--st-bg-muted)]">
                  <div
                    className="h-full bg-[var(--st-text)]/70"
                    style={{ width: `${widthPct}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-[var(--st-text)]">
                    {s.value.toLocaleString()}
                  </span>
                </div>
                <span className="w-16 text-right text-xs text-[var(--st-text-secondary)]">
                  {s.drop > 0 ? `−${s.drop}%` : "—"}
                </span>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
