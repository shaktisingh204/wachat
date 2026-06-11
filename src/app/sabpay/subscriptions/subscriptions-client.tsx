'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, PauseCircle, Plus, Repeat, XCircle } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  DatePicker,
  EmptyState,
  Field,
  Input,
  Modal,
  SegmentedControl,
  SelectField,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  toast,
  Tr,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import {
  formatSabpayAmount,
  type SabpayCustomer,
  type SabpayMode,
  type SabpayPlan,
  type SabpaySubscription,
} from '@/lib/sabpay/types';

import { createSabpaySubscription, getSabpaySubscriptions } from '../actions/subscriptions';
import { EntityStatusBadge } from '../_components/entity-status-badge';
import { ListToolbar } from '../_components/list-toolbar';
import { LoadMore } from '../_components/load-more';
import { formatPlanInterval } from '../plans/format-interval';

const PAGE_SIZE = 50;

type StatusFilter = 'all' | 'active' | 'paused' | 'cancelled' | 'completed';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
];

export function SubscriptionsClient({
  initialSubscriptions,
  plans,
  customers,
  mode,
}: {
  initialSubscriptions: SabpaySubscription[];
  plans: SabpayPlan[];
  customers: SabpayCustomer[];
  mode: SabpayMode;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<StatusFilter>('all');

  /* Cursor-paginated rows: server-rendered first page + client-loaded extras. */
  const [extra, setExtra] = React.useState<SabpaySubscription[]>([]);
  const [hasMore, setHasMore] = React.useState(initialSubscriptions.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = React.useState(false);

  /* Create modal. */
  const [createOpen, setCreateOpen] = React.useState(false);
  const [planId, setPlanId] = React.useState<string | null>(null);
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [totalCycles, setTotalCycles] = React.useState('12');
  const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const planById = React.useMemo(
    () => new Map(plans.map((p) => [p.id, p])),
    [plans],
  );
  const customerById = React.useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );

  const planOptions = React.useMemo<SelectOption[]>(
    () =>
      plans.map((p) => ({
        value: p.id,
        label: `${p.name} — ${formatSabpayAmount(p.amount, p.currency)} ${formatPlanInterval(p.interval, p.intervalCount)}`,
      })),
    [plans],
  );
  const customerOptions = React.useMemo<SelectOption[]>(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.email ? `${c.name} (${c.email})` : c.name,
      })),
    [customers],
  );

  const all = React.useMemo(() => {
    const seen = new Set(initialSubscriptions.map((s) => s.id));
    return [...initialSubscriptions, ...extra.filter((s) => !seen.has(s.id))];
  }, [initialSubscriptions, extra]);

  const subscriptions =
    filter === 'all' ? all : all.filter((s) => s.status === filter);

  const summary = React.useMemo(() => {
    let active = 0;
    let paused = 0;
    let cancelled = 0;
    let completed = 0;
    for (const s of all) {
      if (s.status === 'active') active += 1;
      else if (s.status === 'paused') paused += 1;
      else if (s.status === 'cancelled') cancelled += 1;
      else if (s.status === 'completed') completed += 1;
    }
    return { active, paused, cancelled, completed };
  }, [all]);

  const createButton = (
    <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
      Create subscription
    </Button>
  );

  function resetForm() {
    setPlanId(null);
    setCustomerId(null);
    setTotalCycles('12');
    setStartDate(undefined);
    setFormError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!planId) {
      setFormError('Pick a plan to bill on.');
      return;
    }
    const cycles = Number.parseInt(totalCycles, 10);
    if (!Number.isInteger(cycles) || cycles < 1) {
      setFormError('Total cycles must be a whole number of at least 1.');
      return;
    }
    setCreating(true);
    const result = await createSabpaySubscription({
      planId,
      customerId: customerId ?? undefined,
      totalCount: cycles,
      startAt: startDate ? startDate.toISOString() : undefined,
    });
    setCreating(false);
    if (result.error || !result.subscription) {
      setFormError(result.error || 'Could not create the subscription.');
      return;
    }
    setCreateOpen(false);
    resetForm();
    toast({
      title: 'Subscription created',
      description: `${result.subscription.id} — first charge ${startDate ? `on ${startDate.toLocaleDateString()}` : 'runs now'}.`,
      tone: 'success',
    });
    router.refresh();
  }

  async function loadMore() {
    const last = all[all.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const batch = await getSabpaySubscriptions({
        before: last.createdAt,
        limit: PAGE_SIZE,
      });
      setExtra((prev) => [...prev, ...batch]);
      if (batch.length < PAGE_SIZE) setHasMore(false);
    } catch {
      toast({
        title: 'Could not load more subscriptions',
        description: 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <ListToolbar
        left={
          <SegmentedControl
            aria-label="Filter subscriptions by status"
            items={FILTERS}
            value={filter}
            onChange={setFilter}
          />
        }
        actions={createButton}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--st-space-4, 16px)',
        }}
      >
        <StatCard label="Active" value={summary.active} icon={Repeat} />
        <StatCard label="Paused" value={summary.paused} icon={PauseCircle} />
        <StatCard label="Cancelled" value={summary.cancelled} icon={XCircle} />
        <StatCard label="Completed" value={summary.completed} icon={CheckCircle2} />
      </div>

      <Card>
        <CardBody>
          {subscriptions.length === 0 ? (
            <EmptyState
              icon={<Repeat size={22} />}
              title={
                filter === 'all'
                  ? `No subscriptions in ${mode} mode yet`
                  : `No ${filter} subscriptions in ${mode} mode yet`
              }
              description="Subscriptions charge a customer on a plan every cycle automatically. Create your first subscription to start recurring billing."
              action={createButton}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Sub id</Th>
                  <Th>Plan</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th>Cycles</Th>
                  <Th>Next charge</Th>
                  <Th>Created</Th>
                </Tr>
              </THead>
              <TBody>
                {subscriptions.map((s) => {
                  const plan = planById.get(s.planId);
                  const customer = s.customerId ? customerById.get(s.customerId) : undefined;
                  return (
                    <Tr key={s.id}>
                      <Td>
                        <Link
                          href={`/sabpay/subscriptions/${s.id}`}
                          style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                        >
                          {s.id}
                        </Link>
                      </Td>
                      <Td style={{ fontWeight: 600 }}>
                        {plan ? (
                          plan.name
                        ) : (
                          <span style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5, fontWeight: 400 }}>
                            {s.planId}
                          </span>
                        )}
                      </Td>
                      <Td>
                        {customer ? (
                          customer.name
                        ) : s.customerId ? (
                          <span style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}>
                            {s.customerId}
                          </span>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>
                        <EntityStatusBadge status={s.status} />
                      </Td>
                      <Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {s.paidCount}/{s.totalCount}
                        {s.missedCycles > 0 ? (
                          <span style={{ color: 'var(--st-text-muted)' }}>
                            {' '}· {s.missedCycles} missed
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        {s.nextChargeAt ? new Date(s.nextChargeAt).toLocaleString() : '—'}
                      </Td>
                      <Td>{new Date(s.createdAt).toLocaleString()}</Td>
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a subscription"
        description={`Starts ${mode}-mode recurring billing — every cycle charges the plan amount automatically.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="sabpay-create-subscription"
              disabled={creating || plans.length === 0}
            >
              {creating ? 'Creating…' : 'Create subscription'}
            </Button>
          </>
        }
      >
        <form
          id="sabpay-create-subscription"
          onSubmit={handleCreate}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field
            label="Plan"
            required
            error={formError}
            help={
              plans.length === 0 ? (
                <>
                  No plans in {mode} mode yet —{' '}
                  <Link href="/sabpay/plans">create a plan</Link> first.
                </>
              ) : undefined
            }
          >
            <SelectField
              value={planId}
              onChange={setPlanId}
              options={planOptions}
              placeholder="Pick a plan"
              searchable
              disabled={plans.length === 0}
              aria-label="Plan"
            />
          </Field>
          <Field label="Customer" help="Optional — attaches the customer to every cycle's invoice.">
            <SelectField
              value={customerId}
              onChange={setCustomerId}
              options={customerOptions}
              placeholder="No customer"
              searchable
              clearable
              aria-label="Customer"
            />
          </Field>
          <Field label="Total cycles" required help="How many times to charge in total.">
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={totalCycles}
              onChange={(e) => setTotalCycles(e.target.value)}
              placeholder="12"
              required
            />
          </Field>
          <Field label="Start date" help="Optional — defaults to charging immediately.">
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Today (first charge now)"
              disabledDates={{ before: new Date() }}
              aria-label="Start date"
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
