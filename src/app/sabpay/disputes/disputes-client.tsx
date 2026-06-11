'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FlaskConical } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
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
  type SabpayDispute,
  type SabpayMode,
} from '@/lib/sabpay/types';

import { createSabpayTestDispute, getSabpayDisputes } from '../actions/disputes';
import { EntityStatusBadge } from '../_components/entity-status-badge';
import { ListToolbar } from '../_components/list-toolbar';
import { LoadMore } from '../_components/load-more';

const PAGE_SIZE = 50;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

type StatusFilter = 'all' | 'open' | 'under_review' | 'won' | 'lost';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const mono = { fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 } as const;

/** A dispute's respond-by deadline is urgent when unresolved and ≤ 3 days out. */
function isRespondByUrgent(dispute: SabpayDispute): boolean {
  if (dispute.status === 'won' || dispute.status === 'lost') return false;
  return new Date(dispute.respondBy).getTime() - Date.now() <= THREE_DAYS_MS;
}

export function DisputesClient({
  initialDisputes,
  mode,
}: {
  initialDisputes: SabpayDispute[];
  mode: SabpayMode;
}): React.JSX.Element {
  const router = useRouter();
  const [filter, setFilter] = React.useState<StatusFilter>('all');
  const [extra, setExtra] = React.useState<SabpayDispute[]>([]);
  const [hasMore, setHasMore] = React.useState(
    initialDisputes.length >= PAGE_SIZE,
  );
  const [loadingMore, setLoadingMore] = React.useState(false);

  const [simulateOpen, setSimulateOpen] = React.useState(false);
  const [paymentId, setPaymentId] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [simulating, setSimulating] = React.useState(false);

  // `initialDisputes` refreshes on router.refresh(); de-dupe any overlap with
  // pages loaded through the cursor so rows never render twice.
  const allDisputes = React.useMemo(() => {
    const seen = new Set(initialDisputes.map((d) => d.id));
    return [...initialDisputes, ...extra.filter((d) => !seen.has(d.id))];
  }, [initialDisputes, extra]);

  const disputes =
    filter === 'all'
      ? allDisputes
      : allDisputes.filter((d) => d.status === filter);

  async function loadMore() {
    const last = allDisputes[allDisputes.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const { disputes: next } = await getSabpayDisputes({
        before: last.createdAt,
        limit: PAGE_SIZE,
      });
      setExtra((prev) => [...prev, ...next]);
      setHasMore(next.length >= PAGE_SIZE);
    } catch {
      toast({ title: 'Could not load more disputes', tone: 'danger' });
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSimulate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const id = paymentId.trim();
    if (!id) {
      setFormError('Enter the id of a succeeded payment.');
      return;
    }
    setSimulating(true);
    const result = await createSabpayTestDispute({ paymentId: id });
    setSimulating(false);
    if (result.error || !result.dispute) {
      setFormError(result.error || 'Could not create the test dispute.');
      return;
    }
    setSimulateOpen(false);
    setPaymentId('');
    toast({
      title: 'Test dispute created',
      description: result.dispute.id,
      tone: 'success',
    });
    router.refresh();
  }

  return (
    <>
      <ListToolbar
        left={
          <SegmentedControl
            aria-label="Filter disputes by status"
            items={FILTERS}
            value={filter}
            onChange={setFilter}
          />
        }
        actions={
          mode === 'test' ? (
            <Button
              variant="primary"
              iconLeft={<FlaskConical size={15} />}
              onClick={() => {
                setFormError(null);
                setSimulateOpen(true);
              }}
            >
              Simulate dispute
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardBody>
          {disputes.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No{' '}
              {filter === 'all'
                ? ''
                : `${filter === 'under_review' ? 'under-review' : filter} `}
              disputes in {mode} mode yet.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Dispute</Th>
                  <Th>Payment</Th>
                  <Th>Amount</Th>
                  <Th>Reason</Th>
                  <Th>Status</Th>
                  <Th>Respond by</Th>
                </Tr>
              </THead>
              <TBody>
                {disputes.map((d) => {
                  const urgent = isRespondByUrgent(d);
                  return (
                    <Tr key={d.id}>
                      <Td>
                        <Link href={`/sabpay/disputes/${d.id}`} style={mono}>
                          {d.id}
                        </Link>
                      </Td>
                      <Td>
                        <Link
                          href={`/sabpay/payments/${d.paymentId}`}
                          style={mono}
                        >
                          {d.paymentId}
                        </Link>
                      </Td>
                      <Td
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                        }}
                      >
                        {formatSabpayAmount(d.amount, d.currency)}
                      </Td>
                      <Td>{d.reasonCode}</Td>
                      <Td>
                        <EntityStatusBadge status={d.status} />
                      </Td>
                      <Td
                        style={
                          urgent
                            ? { color: 'var(--st-danger)', fontWeight: 600 }
                            : undefined
                        }
                      >
                        {new Date(d.respondBy).toLocaleString()}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />

      <Modal
        open={simulateOpen}
        onClose={() => setSimulateOpen(false)}
        title="Simulate a dispute"
        description="Creates a test-mode chargeback against a succeeded payment so you can rehearse the evidence flow."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSimulateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="sabpay-simulate-dispute"
              disabled={simulating}
            >
              {simulating ? 'Creating…' : 'Create dispute'}
            </Button>
          </>
        }
      >
        <form
          id="sabpay-simulate-dispute"
          onSubmit={handleSimulate}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field
            label="Payment id"
            required
            error={formError}
            help="A succeeded test-mode payment (pay_…)."
          >
            <Input
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              placeholder="pay_…"
              style={{ fontFamily: 'var(--st-font-mono, monospace)' }}
              required
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
