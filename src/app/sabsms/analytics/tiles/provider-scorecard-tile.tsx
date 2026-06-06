import Link from "next/link";

import { Badge, Card, CardBody, CardDescription, CardHeader, CardTitle, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';

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
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            DLR %, latency p95, error rate per{" "}
            {numberHealth ? "sender number" : "provider"}.
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
            metric={tileId}
            tileId={tileId}
            queryString={queryString}
          />
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
            No data yet.
          </p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>
                  {numberHealth ? "Number" : "Provider"}
                </Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">DLR %</Th>
                <Th className="text-right">Error %</Th>
                <Th className="text-right">p95 ms</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.provider}>
                  <Td className="font-mono text-xs">
                    {r.provider}
                  </Td>
                  <Td className="text-right text-xs">
                    {r.total.toLocaleString()}
                  </Td>
                  <Td className="text-right text-xs">
                    <Badge
                      variant={r.dlrRate >= 95 ? "default" : "secondary"}
                    >
                      {r.dlrRate}%
                    </Badge>
                  </Td>
                  <Td className="text-right text-xs">
                    <Badge
                      variant={r.errorRate > 5 ? "destructive" : "secondary"}
                    >
                      {r.errorRate}%
                    </Badge>
                  </Td>
                  <Td className="text-right text-xs text-[var(--st-text-secondary)]">
                    {r.latencyP95Ms.toLocaleString()}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
