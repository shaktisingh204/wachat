import Link from "next/link";

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
} from "@/components/zoruui";

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
    <ZoruCard>
      <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <ZoruCardTitle>Funnel</ZoruCardTitle>
          <ZoruCardDescription>
            Sent → Delivered → Clicked → Replied, with drop-off between
            each step.
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
            metric="funnel"
            tileId="funnel"
            queryString={queryString}
          />
        </div>
      </ZoruCardHeader>
      <ZoruCardContent>
        <ol className="space-y-2">
          {steps.map((s) => {
            const widthPct = top > 0 ? Math.max(2, (s.value / top) * 100) : 0;
            return (
              <li key={s.step} className="flex items-center gap-3">
                <span className="w-24 text-sm text-zoru-ink-muted">
                  {s.step}
                </span>
                <div className="relative h-7 flex-1 overflow-hidden rounded bg-zoru-surface-2">
                  <div
                    className="h-full bg-zoru-ink/70"
                    style={{ width: `${widthPct}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-zoru-ink">
                    {s.value.toLocaleString()}
                  </span>
                </div>
                <span className="w-16 text-right text-xs text-zoru-ink-muted">
                  {s.drop > 0 ? `−${s.drop}%` : "—"}
                </span>
              </li>
            );
          })}
        </ol>
      </ZoruCardContent>
    </ZoruCard>
  );
}
