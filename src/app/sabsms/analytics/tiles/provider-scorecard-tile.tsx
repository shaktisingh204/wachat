import Link from "next/link";

import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "@/components/zoruui";

import { TileActions } from "./tile-actions";
import type { SabsmsProviderScore } from "../aggregations";

export interface ProviderScorecardTileProps {
  rows: SabsmsProviderScore[];
  drilldownHref: string;
  queryString: string;
  /** When true the table shows per-number health instead of per-provider. */
  numberHealth?: boolean;
}

/** Reused for both provider scorecard (S6) and number-health scorecard (S7). */
export function ProviderScorecardTile({
  rows,
  drilldownHref,
  queryString,
  numberHealth,
}: ProviderScorecardTileProps) {
  const tileId = numberHealth ? "number-health" : "provider-scorecard";
  const title = numberHealth ? "Number health" : "Provider scorecard";

  return (
    <Card>
      <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <ZoruCardTitle>{title}</ZoruCardTitle>
          <ZoruCardDescription>
            DLR %, latency p95, error rate per{" "}
            {numberHealth ? "sender number" : "provider"}.
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
            metric={tileId}
            tileId={tileId}
            queryString={queryString}
          />
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-zoru-ink-muted">
            No data yet.
          </p>
        ) : (
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>
                  {numberHealth ? "Number" : "Provider"}
                </ZoruTableHead>
                <ZoruTableHead className="text-right">Total</ZoruTableHead>
                <ZoruTableHead className="text-right">DLR %</ZoruTableHead>
                <ZoruTableHead className="text-right">Error %</ZoruTableHead>
                <ZoruTableHead className="text-right">p95 ms</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.map((r) => (
                <ZoruTableRow key={r.provider}>
                  <ZoruTableCell className="font-mono text-xs">
                    {r.provider}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-xs">
                    {r.total.toLocaleString()}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-xs">
                    <Badge
                      variant={r.dlrRate >= 95 ? "default" : "secondary"}
                    >
                      {r.dlrRate}%
                    </Badge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-xs">
                    <Badge
                      variant={r.errorRate > 5 ? "destructive" : "secondary"}
                    >
                      {r.errorRate}%
                    </Badge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-xs text-zoru-ink-muted">
                    {r.latencyP95Ms.toLocaleString()}
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        )}
      </ZoruCardContent>
    </Card>
  );
}
