'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, ReceiptText } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  Modal,
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
  type SabpayOrder,
} from '@/lib/sabpay/types';

import { createSabpayOrder, getSabpayOrders } from '../actions/orders';
import { exportSabpayCsv } from '../actions/exports';
import { EntityStatusBadge } from '../_components/entity-status-badge';
import { ExportCsvButton } from '../_components/export-csv-button';
import { ListToolbar } from '../_components/list-toolbar';
import { LoadMore } from '../_components/load-more';

const PAGE_SIZE = 50;

type StatusFilter = 'all' | 'created' | 'attempted' | 'paid';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'created', label: 'Created' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'paid', label: 'Paid' },
];

export function OrdersClient({
  initialOrders,
  mode,
}: {
  initialOrders: SabpayOrder[];
  mode: SabpayMode;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<StatusFilter>('all');
  const [extra, setExtra] = React.useState<SabpayOrder[]>([]);
  const [hasMore, setHasMore] = React.useState(initialOrders.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [receipt, setReceipt] = React.useState('');
  const [note, setNote] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  // initialOrders refreshes via router.refresh(); extra holds older pages.
  // Dedupe by id so a freshly-created order never shows twice.
  const orders = React.useMemo(() => {
    const byId = new Map<string, SabpayOrder>();
    for (const o of [...initialOrders, ...extra]) byId.set(o.id, o);
    return Array.from(byId.values());
  }, [initialOrders, extra]);

  const visible =
    filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  async function handleLoadMore() {
    const last = orders[orders.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const older = await getSabpayOrders({ before: last.createdAt, limit: PAGE_SIZE });
      setExtra((prev) => [...prev, ...older]);
      setHasMore(older.length >= PAGE_SIZE);
    } catch {
      toast({ title: 'Could not load more orders', tone: 'danger' });
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const rupees = Number.parseFloat(amount);
    if (!Number.isFinite(rupees) || rupees < 1) {
      setFormError('Enter an amount of at least ₹1.');
      return;
    }
    setCreating(true);
    const result = await createSabpayOrder({
      amount: Math.round(rupees * 100),
      currency: 'INR',
      receipt: receipt || undefined,
      notes: note ? { note } : undefined,
    });
    setCreating(false);
    if (result.error || !result.order) {
      setFormError(result.error || 'Could not create the order.');
      return;
    }
    setCreateOpen(false);
    setAmount('');
    setReceipt('');
    setNote('');
    toast({
      title: 'Order created',
      description: `${result.order.id} for ${formatSabpayAmount(result.order.amount, result.order.currency)}.`,
      tone: 'success',
    });
    router.refresh();
  }

  const createButton = (
    <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
      Create order
    </Button>
  );

  return (
    <>
      <ListToolbar
        left={
          <SegmentedControl
            aria-label="Filter orders by status"
            items={FILTERS}
            value={filter}
            onChange={setFilter}
          />
        }
        actions={
          <>
            <ExportCsvButton
              onExport={() => exportSabpayCsv('orders', { mode })}
              filename="sabpay-orders.csv"
            />
            {createButton}
          </>
        }
      />

      <Card>
        <CardBody>
          {visible.length === 0 ? (
            <EmptyState
              icon={<ReceiptText size={22} />}
              title={
                filter === 'all'
                  ? `No orders in ${mode} mode yet`
                  : `No ${filter} orders in ${mode} mode yet`
              }
              description="Create an order to track an amount to collect — payments made against it roll up into amount paid."
              action={createButton}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Order id</Th>
                  <Th>Amount</Th>
                  <Th>Amount paid</Th>
                  <Th>Status</Th>
                  <Th>Receipt</Th>
                  <Th>Created</Th>
                </Tr>
              </THead>
              <TBody>
                {visible.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <Link
                        href={`/sabpay/orders/${o.id}`}
                        style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                      >
                        {o.id}
                      </Link>
                    </Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatSabpayAmount(o.amount, o.currency)}
                    </Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatSabpayAmount(o.amountPaid, o.currency)}
                    </Td>
                    <Td>
                      <EntityStatusBadge status={o.status} />
                    </Td>
                    <Td>{o.receipt || '—'}</Td>
                    <Td>{new Date(o.createdAt).toLocaleString()}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={handleLoadMore} />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create an order"
        description={`Creates a ${mode}-mode order — collect one or more payments against it via the API.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="sabpay-create-order" disabled={creating}>
              {creating ? 'Creating…' : 'Create order'}
            </Button>
          </>
        }
      >
        <form
          id="sabpay-create-order"
          onSubmit={handleCreate}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field label="Amount (₹)" required error={formError}>
            <Input
              type="number"
              min={1}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="499"
              required
            />
          </Field>
          <Field label="Currency" help="SabPay settles in Indian rupees.">
            <Input value="INR" readOnly aria-readonly="true" />
          </Field>
          <Field label="Receipt" help="Optional. Your internal receipt or reference number.">
            <Input
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              placeholder="rcpt-2026-0042"
              maxLength={64}
            />
          </Field>
          <Field label="Note" help="Optional. Stored on the order — visible only to your team.">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="March retainer"
              maxLength={200}
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
