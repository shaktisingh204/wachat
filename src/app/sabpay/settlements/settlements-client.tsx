'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarCheck, IndianRupee, Landmark } from 'lucide-react';

import {
  Card,
  CardBody,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  toast,
  Tr,
} from '@/components/sabcrm/20ui';
import { formatSabpayAmount, type SabpaySettlement } from '@/lib/sabpay/types';
import type { SabpaySettlementSummary } from '@/lib/rust-client/sabpay';

import { exportSabpayCsv } from '../actions/exports';
import { getSabpaySettlements } from '../actions/settlements';
import { EntityStatusBadge } from '../_components/entity-status-badge';
import { ExportCsvButton } from '../_components/export-csv-button';
import { ListToolbar } from '../_components/list-toolbar';
import { LoadMore } from '../_components/load-more';

const PAGE_SIZE = 50;

const money = { fontVariantNumeric: 'tabular-nums' } as const;

export function SettlementsClient({
  initialSettlements,
  summary,
}: {
  initialSettlements: SabpaySettlement[];
  summary: SabpaySettlementSummary;
}): React.JSX.Element {
  const [extra, setExtra] = React.useState<SabpaySettlement[]>([]);
  const [hasMore, setHasMore] = React.useState(
    initialSettlements.length >= PAGE_SIZE,
  );
  const [loadingMore, setLoadingMore] = React.useState(false);

  // `initialSettlements` refreshes on router.refresh(); de-dupe any overlap
  // with pages loaded through the cursor so rows never render twice.
  const settlements = React.useMemo(() => {
    const seen = new Set(initialSettlements.map((s) => s.id));
    return [...initialSettlements, ...extra.filter((s) => !seen.has(s.id))];
  }, [initialSettlements, extra]);

  async function loadMore() {
    const last = settlements[settlements.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const { settlements: next } = await getSabpaySettlements({
        before: last.createdAt,
        limit: PAGE_SIZE,
      });
      setExtra((prev) => [...prev, ...next]);
      setHasMore(next.length >= PAGE_SIZE);
    } catch {
      toast({ title: 'Could not load more settlements', tone: 'danger' });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--st-space-4, 16px)',
        }}
      >
        <StatCard
          label="Next settlement"
          value={formatSabpayAmount(summary.nextAmount)}
          icon={IndianRupee}
        />
        <StatCard
          label="Eligible payments"
          value={summary.eligibleCount}
          icon={Landmark}
        />
        <StatCard
          label="Last settled"
          value={
            summary.lastSettledAt
              ? new Date(summary.lastSettledAt).toLocaleDateString()
              : '—'
          }
          icon={CalendarCheck}
        />
      </div>

      <ListToolbar
        actions={
          <ExportCsvButton
            onExport={() => exportSabpayCsv('settlements')}
            filename="sabpay-settlements.csv"
            label="Export CSV"
          />
        }
      />

      <Card>
        <CardBody>
          {settlements.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No settlements in live mode yet.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Settlement</Th>
                  <Th>Gross</Th>
                  <Th>Fees</Th>
                  <Th>Tax</Th>
                  <Th>Net</Th>
                  <Th>Status</Th>
                  <Th>Settled on</Th>
                </Tr>
              </THead>
              <TBody>
                {settlements.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <Link
                        href={`/sabpay/settlements/${s.id}`}
                        style={{
                          fontFamily: 'var(--st-font-mono, monospace)',
                          fontSize: 12.5,
                        }}
                      >
                        {s.id}
                      </Link>
                    </Td>
                    <Td style={money}>{formatSabpayAmount(s.grossAmount)}</Td>
                    <Td style={{ ...money, color: 'var(--st-text-muted)' }}>
                      − {formatSabpayAmount(s.feesTotal)}
                    </Td>
                    <Td style={{ ...money, color: 'var(--st-text-muted)' }}>
                      − {formatSabpayAmount(s.taxTotal)}
                    </Td>
                    <Td style={{ ...money, fontWeight: 700 }}>
                      {formatSabpayAmount(s.amount)}
                    </Td>
                    <Td>
                      <EntityStatusBadge status={s.status} />
                    </Td>
                    <Td>
                      {s.settledAt
                        ? new Date(s.settledAt).toLocaleString()
                        : '—'}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
    </>
  );
}
