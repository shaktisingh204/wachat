'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Plus, Repeat, Trash2 } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  Modal,
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
  type SabpayMode,
  type SabpayPlan,
} from '@/lib/sabpay/types';

import { createSabpayPlan, deleteSabpayPlan, getSabpayPlans } from '../actions/plans';
import { ConfirmAction } from '../_components/confirm-action';
import { CopyableId } from '../_components/copyable-id';
import { ListToolbar } from '../_components/list-toolbar';
import { LoadMore } from '../_components/load-more';
import { formatPlanInterval } from './format-interval';

const PAGE_SIZE = 50;

const INTERVAL_OPTIONS: SelectOption[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function PlansClient({
  initialPlans,
  mode,
}: {
  initialPlans: SabpayPlan[];
  mode: SabpayMode;
}) {
  const router = useRouter();

  /* Cursor-paginated rows: server-rendered first page + client-loaded extras. */
  const [extra, setExtra] = React.useState<SabpayPlan[]>([]);
  const [hasMore, setHasMore] = React.useState(initialPlans.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = React.useState(false);

  /* Create modal. */
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [planInterval, setPlanInterval] = React.useState('monthly');
  const [intervalCount, setIntervalCount] = React.useState('1');
  const [description, setDescription] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  /* Delete confirmation. */
  const [deleteTarget, setDeleteTarget] = React.useState<SabpayPlan | null>(null);

  const plans = React.useMemo(() => {
    const seen = new Set(initialPlans.map((p) => p.id));
    return [...initialPlans, ...extra.filter((p) => !seen.has(p.id))];
  }, [initialPlans, extra]);

  const summary = React.useMemo(() => {
    let monthly = 0;
    for (const p of plans) {
      if (p.interval === 'monthly') monthly += 1;
    }
    return { total: plans.length, monthly };
  }, [plans]);

  const createButton = (
    <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
      Create plan
    </Button>
  );

  function resetForm() {
    setName('');
    setAmount('');
    setPlanInterval('monthly');
    setIntervalCount('1');
    setDescription('');
    setFormError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const rupees = Number.parseFloat(amount);
    if (!Number.isFinite(rupees) || rupees < 1) {
      setFormError('Enter an amount of at least ₹1.');
      return;
    }
    const count = Number.parseInt(intervalCount, 10);
    setCreating(true);
    const result = await createSabpayPlan({
      name: name.trim(),
      amount: Math.round(rupees * 100),
      interval: planInterval,
      intervalCount: Number.isInteger(count) && count >= 1 ? count : 1,
      description: description.trim() || undefined,
    });
    setCreating(false);
    if (result.error || !result.plan) {
      setFormError(result.error || 'Could not create the plan.');
      return;
    }
    setCreateOpen(false);
    resetForm();
    toast({
      title: 'Plan created',
      description: `${result.plan.name} — ${formatSabpayAmount(result.plan.amount, result.plan.currency)} ${formatPlanInterval(result.plan.interval, result.plan.intervalCount)}`,
      tone: 'success',
    });
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const result = await deleteSabpayPlan(target.id);
    if (result.error) {
      toast({
        title: 'Could not delete the plan',
        description: result.error,
        tone: 'danger',
      });
      return;
    }
    setExtra((prev) => prev.filter((p) => p.id !== target.id));
    toast({ title: 'Plan deleted', tone: 'success' });
    router.refresh();
  }

  async function loadMore() {
    const last = plans[plans.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const batch = await getSabpayPlans({ before: last.createdAt, limit: PAGE_SIZE });
      setExtra((prev) => [...prev, ...batch]);
      if (batch.length < PAGE_SIZE) setHasMore(false);
    } catch {
      toast({
        title: 'Could not load more plans',
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
          <span style={{ fontSize: 13, color: 'var(--st-text-muted)' }}>
            {plans.length === 1 ? '1 plan' : `${plans.length} plans`} · plans are
            immutable once created
          </span>
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
        <StatCard label="Plans" value={summary.total} icon={Layers} />
        <StatCard label="Monthly-billed" value={summary.monthly} icon={Repeat} />
      </div>

      <Card>
        <CardBody>
          {plans.length === 0 ? (
            <EmptyState
              icon={<Layers size={22} />}
              title={`No plans in ${mode} mode yet`}
              description="Plans are reusable billing templates — an amount and an interval you put subscriptions on. Create your first plan to start recurring billing."
              action={createButton}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Plan id</Th>
                  <Th>Name</Th>
                  <Th>Amount / interval</Th>
                  <Th>Created</Th>
                  <Th>
                    <span style={SR_ONLY}>Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {plans.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <CopyableId value={p.id} />
                    </Td>
                    <Td style={{ fontWeight: 600 }}>{p.name}</Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatSabpayAmount(p.amount, p.currency)}{' '}
                      <span style={{ color: 'var(--st-text-muted)' }}>
                        {formatPlanInterval(p.interval, p.intervalCount)}
                      </span>
                    </Td>
                    <Td>{new Date(p.createdAt).toLocaleString()}</Td>
                    <Td style={{ textAlign: 'right' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={<Trash2 size={14} />}
                        onClick={() => setDeleteTarget(p)}
                        aria-label={`Delete plan ${p.name}`}
                      >
                        Delete
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a plan"
        description={`Creates a ${mode}-mode billing template. Plans are immutable — to change pricing, create a new plan.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="sabpay-create-plan" disabled={creating}>
              {creating ? 'Creating…' : 'Create plan'}
            </Button>
          </>
        }
      >
        <form
          id="sabpay-create-plan"
          onSubmit={handleCreate}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pro monthly"
              maxLength={120}
              required
            />
          </Field>
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
          <Field label="Billing interval" required>
            <SelectField
              value={planInterval}
              onChange={(v) => setPlanInterval(v ?? 'monthly')}
              options={INTERVAL_OPTIONS}
              aria-label="Billing interval"
            />
          </Field>
          <Field
            label="Interval count"
            help="Charge every N intervals — 1 with monthly bills every month, 3 bills quarterly."
          >
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={intervalCount}
              onChange={(e) => setIntervalCount(e.target.value)}
              placeholder="1"
              required
            />
          </Field>
          <Field label="Description" help="Shown to the customer on subscription invoices.">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Everything in Pro, billed monthly"
              maxLength={200}
            />
          </Field>
        </form>
      </Modal>

      <ConfirmAction
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : 'Delete plan?'}
        description="Plans with subscriptions on them cannot be deleted. This cannot be undone."
        confirmLabel="Delete plan"
        tone="danger"
      />
    </>
  );
}
