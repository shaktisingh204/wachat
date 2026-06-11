'use client';

import * as React from 'react';
import Link from 'next/link';
import { Undo2 } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  EmptyState,
  SegmentedControl,
  Table,
  TBody,
  Td,
  Th,
  THead,
  toast,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  formatSabpayAmount,
  type SabpayMode,
  type SabpayRefund,
} from '@/lib/sabpay/types';

import { getSabpayRefunds } from '../actions/refunds';
import { exportSabpayCsv } from '../actions/exports';
import { EntityStatusBadge } from '../_components/entity-status-badge';
import { ExportCsvButton } from '../_components/export-csv-button';
import { ListToolbar } from '../_components/list-toolbar';
import { LoadMore } from '../_components/load-more';

const PAGE_SIZE = 50;

type StatusFilter = 'all' | 'pending' | 'processed';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processed', label: 'Processed' },
];

export function RefundsClient({
  initialRefunds,
  mode,
}: {
  initialRefunds: SabpayRefund[];
  mode: SabpayMode;
}) {
  const [filter, setFilter] = React.useState<StatusFilter>('all');
  const [extra, setExtra] = React.useState<SabpayRefund[]>([]);
  const [hasMore, setHasMore] = React.useState(initialRefunds.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // initialRefunds refreshes via router.refresh(); extra holds older pages.
  const refunds = React.useMemo(() => {
    const byId = new Map<string, SabpayRefund>();
    for (const r of [...initialRefunds, ...extra]) byId.set(r.id, r);
    return Array.from(byId.values());
  }, [initialRefunds, extra]);

  const visible =
    filter === 'all' ? refunds : refunds.filter((r) => r.status === filter);

  async function handleLoadMore() {
    const last = refunds[refunds.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const older = await getSabpayRefunds({ before: last.createdAt, limit: PAGE_SIZE });
      setExtra((prev) => [...prev, ...older]);
      setHasMore(older.length >= PAGE_SIZE);
    } catch {
      toast({ title: 'Could not load more refunds', tone: 'danger' });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <ListToolbar
        left={
          <SegmentedControl
            aria-label="Filter refunds by status"
            items={FILTERS}
            value={filter}
            onChange={setFilter}
          />
        }
        actions={
          <ExportCsvButton
            onExport={() => exportSabpayCsv('refunds', { mode })}
            filename="sabpay-refunds.csv"
          />
        }
      />

      <Card>
        <CardBody>
          {visible.length === 0 ? (
            <EmptyState
              icon={<Undo2 size={22} />}
              title={
                filter === 'all'
                  ? `No refunds in ${mode} mode yet`
                  : `No ${filter} refunds in ${mode} mode yet`
              }
              description="Refunds are issued from a payment — open a succeeded payment and use its Refund action."
              action={
                <Button asChild variant="secondary">
                  <Link href="/sabpay/payments">Go to payments</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Refund id</Th>
                  <Th>Payment</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </Tr>
              </THead>
              <TBody>
                {visible.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <Link
                        href={`/sabpay/refunds/${r.id}`}
                        style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                      >
                        {r.id}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/sabpay/payments/${r.paymentId}`}
                        style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                      >
                        {r.paymentId}
                      </Link>
                    </Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatSabpayAmount(r.amount, r.currency)}
                    </Td>
                    <Td>
                      <EntityStatusBadge status={r.status} />
                    </Td>
                    <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={handleLoadMore} />
    </>
  );
}
