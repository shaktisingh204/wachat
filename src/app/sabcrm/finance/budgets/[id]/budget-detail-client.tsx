'use client';

/**
 * SabCRM Finance — Budget detail client (spec §3.16).
 *
 * A focused planning surface (no line items — composes the kit's
 * StatusFlow + ConvertMenu + formatting with 20ui cards):
 *
 *   - status rail over the approval happy path (draft → approved →
 *     locked; rejected renders as a pill);
 *   - workflow actions per the transition map (approve / reject / lock
 *     / reopen);
 *   - plan card (planned / actual / remaining with an over-budget
 *     alert) and a read-only audit-trail card (approval/lock/reject
 *     timestamps + reject reason, when historical docs carry them —
 *     they are not writable on this mount: Rust gap);
 *   - Edit (full-field dialog incl. record-actuals) + Archive.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Archive,
  BadgeCheck,
  CheckCircle2,
  FilePenLine,
  Gauge,
  Lock,
  PiggyBank,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  toast,
} from '@/components/sabcrm/20ui';

import type { SabcrmBudgetDoc } from '@/lib/rust-client/sabcrm-finance';
import type { CrmBudgetStatus } from '@/lib/rust-client/crm-budgets';
import { transitionSabcrmBudgetStatus } from '@/app/actions/sabcrm-finance-budgets.actions';
import { deleteSabcrmBudget } from '@/app/actions/sabcrm-finance.actions';

import {
  ConvertMenu,
  StatusFlow,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
} from '../../_components/doc-surface';
import {
  BUDGETS_PATH,
  BUDGET_FLOW,
  BUDGET_STATUSES,
} from '../budget-config';
import { BudgetFormDialog } from '../budget-form';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../../_components/doc-surface/doc-surface.css';

/* ─── Component ───────────────────────────────────────────────── */

export interface BudgetDetailClientProps {
  budget: SabcrmBudgetDoc | null;
  error: string | null;
}

export function BudgetDetailClient({
  budget,
  error,
}: BudgetDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [archiving, startArchive] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  if (!budget) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-6">
        <Link
          href={BUDGETS_PATH}
          className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Budgets
        </Link>
        <div className="mt-6">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load this budget: {error ?? 'Not found.'}
          </Alert>
        </div>
      </div>
    );
  }

  const status = (budget.status ?? 'draft') as CrmBudgetStatus;
  const currency = budget.currency || 'INR';
  const planned = budget.plannedAmount ?? 0;
  const actual = budget.actualAmount ?? 0;
  const remaining = planned - actual;
  const overBudget = planned > 0 && actual > planned;
  const utilisationPct = planned > 0 ? Math.round((actual / planned) * 100) : 0;

  const transition = (next: CrmBudgetStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmBudgetStatus(budget._id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      refresh();
    });
  };

  const handleArchive = (): void => {
    startArchive(async () => {
      const res = await deleteSabcrmBudget(budget._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Budget "${budget.budgetHead}" archived.`);
      router.push(BUDGETS_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const head = budget.budgetHead;
  const menuItems: ConvertMenuItem[] = [];
  if (status === 'draft') {
    menuItems.push({
      key: 'reject',
      label: 'Reject budget',
      icon: XCircle,
      danger: true,
      onSelect: () => transition('rejected', `"${head}" rejected.`),
    });
  }
  menuItems.push({
    key: 'archive',
    label: 'Archive budget',
    icon: Archive,
    danger: true,
    group: menuItems.length > 0,
    onSelect: () => setConfirmArchive(true),
  });

  const primaryAction =
    status === 'draft' ? (
      <Button
        variant="primary"
        iconLeft={CheckCircle2}
        loading={transitioning}
        onClick={() => transition('approved', `"${head}" approved.`)}
      >
        Approve
      </Button>
    ) : status === 'approved' ? (
      <Button
        variant="primary"
        iconLeft={Lock}
        loading={transitioning}
        onClick={() => transition('locked', `"${head}" locked.`)}
      >
        Lock budget
      </Button>
    ) : status === 'rejected' ? (
      <Button
        variant="primary"
        iconLeft={RotateCcw}
        loading={transitioning}
        onClick={() => transition('draft', `"${head}" reopened as draft.`)}
      >
        Reopen as draft
      </Button>
    ) : null;

  const canEdit = status !== 'locked';

  /* ---- audit trail (read-only — not writable on this mount) ---- */
  const audit: { label: string; value: string }[] = [
    ...(budget.approvedAt
      ? [{ label: 'Approved', value: formatDocDate(budget.approvedAt) }]
      : []),
    ...(budget.lockedAt
      ? [{ label: 'Locked', value: formatDocDate(budget.lockedAt) }]
      : []),
    ...(budget.rejectedAt
      ? [{ label: 'Rejected', value: formatDocDate(budget.rejectedAt) }]
      : []),
    ...(budget.rejectReason
      ? [{ label: 'Reject reason', value: budget.rejectReason }]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-6">
      <Link
        href={BUDGETS_PATH}
        className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Budgets
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight text-[var(--st-text)]">
            {head}
          </h1>
          <div className="mt-2">
            <StatusFlow
              flow={BUDGET_FLOW}
              statuses={BUDGET_STATUSES}
              current={status}
            />
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Budget actions"
        >
          {primaryAction}
          {canEdit ? (
            <Button
              variant="secondary"
              iconLeft={FilePenLine}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
          ) : null}
          <ConvertMenu label="More" items={menuItems} disabled={transitioning} />
        </div>
      </div>

      {overBudget ? (
        <div className="mt-4">
          <Alert tone="danger" role="alert">
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert size={14} aria-hidden="true" />
              Actuals exceed the plan by{' '}
              {formatDocMoney(actual - planned, currency)} ({utilisationPct}%
              utilised).
            </span>
          </Alert>
        </div>
      ) : null}

      <div className="fdoc-detail">
        {/* ─── Plan card (main column) ──────────────────────────── */}
        <section className="fdoc-paper" aria-label={`Budget ${head}`}>
          <div className="fdoc-paper__head">
            <div>
              <h2 className="fdoc-paper__title">{head}</h2>
              <span className="fdoc-cell-sub">Budget</span>
            </div>
            <div>
              <span className="fdoc-detail__meta-label">Period</span>
              <span className="fdoc-detail__meta-value">
                {budget.period || '—'}
              </span>
            </div>
          </div>

          <div className="fdoc-detail__meta">
            {budget.department ? (
              <div>
                <span className="fdoc-detail__meta-label">Department</span>
                <span className="fdoc-detail__meta-value">
                  {budget.department}
                </span>
              </div>
            ) : null}
            <div>
              <span className="fdoc-detail__meta-label">Currency</span>
              <span className="fdoc-detail__meta-value">{currency}</span>
            </div>
            <div>
              <span className="fdoc-detail__meta-label">Created</span>
              <span className="fdoc-detail__meta-value">
                {formatDocDate(budget.createdAt)}
              </span>
            </div>
            {budget.updatedAt ? (
              <div>
                <span className="fdoc-detail__meta-label">Updated</span>
                <span className="fdoc-detail__meta-value">
                  {formatDocDate(budget.updatedAt)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="fdoc-lines__footer" data-section="totals">
            <div />
            <dl className="fdoc-totals">
              <dt className="fdoc-totals__label">Planned</dt>
              <dd className="fdoc-totals__value">
                {formatDocMoney(planned, currency)}
              </dd>
              <dt className="fdoc-totals__label">Actual</dt>
              <dd className="fdoc-totals__value">
                {formatDocMoney(actual, currency)}
              </dd>
              <div className="fdoc-totals__grand">
                <dt className="fdoc-totals__label">
                  {remaining >= 0 ? 'Remaining' : 'Over by'}
                </dt>
                <dd className="fdoc-totals__value">
                  {formatDocMoney(Math.abs(remaining), currency)}
                </dd>
              </div>
            </dl>
          </div>

          {budget.notes ? (
            <div className="fdoc-paper__notes">
              <h4>Notes</h4>
              {budget.notes}
            </div>
          ) : null}
        </section>

        {/* ─── Rail ─────────────────────────────────────────────── */}
        <aside className="fdoc-rail" aria-label="Budget context">
          <Card variant="outlined">
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <Gauge size={14} aria-hidden="true" /> Utilisation
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <span className="text-sm font-medium">
                {planned > 0
                  ? `${utilisationPct}% of plan used`
                  : 'No planned amount set'}
              </span>
              <div className="mt-2">
                <Badge
                  tone={
                    overBudget
                      ? 'danger'
                      : utilisationPct > 80
                        ? 'warning'
                        : 'success'
                  }
                  dot
                >
                  {overBudget
                    ? 'Over budget'
                    : utilisationPct > 80
                      ? 'Approaching limit'
                      : 'On track'}
                </Badge>
              </div>
            </CardBody>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck size={14} aria-hidden="true" /> Approval trail
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {audit.length === 0 ? (
                <span className="fdoc-cell-sub">
                  No approvals recorded yet — approve or lock the budget to
                  advance it.
                </span>
              ) : (
                <ul className="fdoc-rail-list">
                  {audit.map((a) => (
                    <li key={a.label} className="fdoc-rail-item">
                      <span>
                        {a.label}
                        <span className="fdoc-rail-item__kind">{a.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {budget.locked || status === 'locked' ? (
                <div className="mt-2">
                  <Badge tone="info" dot>
                    Figures locked
                  </Badge>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <PiggyBank size={14} aria-hidden="true" /> Plan summary
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="fdoc-rail-list">
                <li className="fdoc-rail-item">
                  <span>Planned</span>
                  <span className="fdoc-rail-item__amount">
                    {formatDocMoney(planned, currency)}
                  </span>
                </li>
                <li className="fdoc-rail-item">
                  <span>Actual</span>
                  <span className="fdoc-rail-item__amount">
                    {formatDocMoney(actual, currency)}
                  </span>
                </li>
                <li className="fdoc-rail-item">
                  <span>{remaining >= 0 ? 'Remaining' : 'Over by'}</span>
                  <span className="fdoc-rail-item__amount">
                    {formatDocMoney(Math.abs(remaining), currency)}
                  </span>
                </li>
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>

      <BudgetFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={budget}
        onDone={refresh}
      />

      <AlertDialog
        open={confirmArchive}
        onOpenChange={(next) => {
          if (!next && !archiving) setConfirmArchive(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive &quot;{head}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              The budget disappears from the list (crm-common soft delete).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={archiving}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={archiving} onClick={handleArchive}>
              Archive budget
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
