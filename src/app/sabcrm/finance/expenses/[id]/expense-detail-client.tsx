'use client';

/**
 * SabCRM Finance — Expense-claim detail client (spec §3.12).
 *
 * A focused approval surface (the claim has no line items, so the kit's
 * document paper is the wrong shape — this composes the kit's
 * StatusFlow + ConvertMenu + formatting with 20ui cards instead):
 *
 *   - status rail over the approval happy path (draft → submitted →
 *     approved → reimbursed; rejected/cancelled render as pills);
 *   - workflow actions per the transition map — approving stamps the
 *     session user as approver (server-side);
 *   - claim card (employee link to the CRM record, category, date,
 *     description, amount), SabFiles receipt card, approver audit;
 *   - Edit (full-field dialog) + Archive.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  FilePenLine,
  HandCoins,
  Paperclip,
  RotateCcw,
  Send,
  Trash2,
  UserRound,
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

import type { SabcrmExpenseClaimDoc } from '@/lib/rust-client/sabcrm-finance';
import type { CrmExpenseClaimStatus } from '@/lib/rust-client/crm-expense-claims';
import { transitionSabcrmExpenseStatus } from '@/app/actions/sabcrm-finance-expenses.actions';
import { deleteSabcrmExpense } from '@/app/actions/sabcrm-finance.actions';
import type { SabcrmPartyContact } from '@/app/actions/sabcrm-finance-invoices.actions.types';

import {
  ConvertMenu,
  StatusFlow,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
} from '../../_components/doc-surface';
import {
  EXPENSES_PATH,
  EXPENSE_FLOW,
  EXPENSE_STATUSES,
  employeeRecordHref,
} from '../expense-config';
import { ExpenseFormDialog } from '../expense-form';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../../_components/doc-surface/doc-surface.css';

/* ─── Component ───────────────────────────────────────────────── */

export interface ExpenseDetailClientProps {
  claim: SabcrmExpenseClaimDoc | null;
  /** Resolved CRM person contact (null for free-text employees). */
  employee: SabcrmPartyContact | null;
  error: string | null;
}

export function ExpenseDetailClient({
  claim,
  employee,
  error,
}: ExpenseDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [archiving, startArchive] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  if (!claim) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-6">
        <Link
          href={EXPENSES_PATH}
          className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Expenses
        </Link>
        <div className="mt-6">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load this expense claim: {error ?? 'Not found.'}
          </Alert>
        </div>
      </div>
    );
  }

  const status = claim.status;
  const currency = claim.currency || 'INR';
  const employeeLabel =
    employee?.label ||
    claim.employee_name ||
    (!/^[0-9a-fA-F]{24}$/.test(claim.employee_id) ? claim.employee_id : null);
  const employeeHref = employee
    ? employeeRecordHref(claim.employee_id)
    : null;

  const transition = (next: CrmExpenseClaimStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmExpenseStatus(claim._id, next);
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
      const res = await deleteSabcrmExpense(claim._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${claim.claim_number} archived.`);
      router.push(EXPENSES_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const num = claim.claim_number;
  const menuItems: ConvertMenuItem[] = [];
  if (status === 'submitted') {
    menuItems.push({
      key: 'reject',
      label: 'Reject claim',
      icon: XCircle,
      danger: true,
      onSelect: () => transition('rejected', `${num} rejected.`),
    });
  }
  if (status === 'draft') {
    menuItems.push({
      key: 'cancel',
      label: 'Cancel claim',
      icon: XCircle,
      danger: true,
      onSelect: () => transition('cancelled', `${num} cancelled.`),
    });
  }
  menuItems.push({
    key: 'archive',
    label: 'Archive claim',
    icon: Trash2,
    danger: true,
    group: menuItems.length > 0,
    onSelect: () => setConfirmArchive(true),
  });

  const primaryAction =
    status === 'draft' ? (
      <Button
        variant="primary"
        iconLeft={Send}
        loading={transitioning}
        onClick={() => transition('submitted', `${num} submitted for approval.`)}
      >
        Submit for approval
      </Button>
    ) : status === 'submitted' ? (
      <Button
        variant="primary"
        iconLeft={CheckCircle2}
        loading={transitioning}
        onClick={() => transition('approved', `${num} approved.`)}
      >
        Approve
      </Button>
    ) : status === 'approved' ? (
      <Button
        variant="primary"
        iconLeft={HandCoins}
        loading={transitioning}
        onClick={() => transition('reimbursed', `${num} marked reimbursed.`)}
      >
        Mark reimbursed
      </Button>
    ) : status === 'rejected' ? (
      <Button
        variant="primary"
        iconLeft={RotateCcw}
        loading={transitioning}
        onClick={() => transition('submitted', `${num} re-submitted.`)}
      >
        Re-submit
      </Button>
    ) : null;

  const canEdit =
    status === 'draft' || status === 'submitted' || status === 'rejected';

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-6">
      <Link
        href={EXPENSES_PATH}
        className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Expenses
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight text-[var(--st-text)]">
            {num}
          </h1>
          <div className="mt-2">
            <StatusFlow
              flow={EXPENSE_FLOW}
              statuses={EXPENSE_STATUSES}
              current={status}
            />
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Expense claim actions"
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

      <div className="fdoc-detail">
        {/* ─── Claim card (main column) ─────────────────────────── */}
        <section
          className="fdoc-paper"
          aria-label={`Expense claim ${num}`}
        >
          <div className="fdoc-paper__head">
            <div>
              <h2 className="fdoc-paper__title">{num}</h2>
              <span className="fdoc-cell-sub">Expense claim</span>
            </div>
            <div>
              <span className="fdoc-detail__meta-label">Claimed by</span>
              <span className="fdoc-detail__meta-value">
                {employeeLabel ? (
                  employeeHref ? (
                    <Link href={employeeHref} data-noprint-link="">
                      {employeeLabel}
                    </Link>
                  ) : (
                    employeeLabel
                  )
                ) : (
                  <span className="fdoc-unknown-party">Unknown employee</span>
                )}
              </span>
              {employee?.email ? (
                <span className="fdoc-cell-sub">{employee.email}</span>
              ) : null}
            </div>
          </div>

          <div className="fdoc-detail__meta">
            <div>
              <span className="fdoc-detail__meta-label">Expense date</span>
              <span className="fdoc-detail__meta-value">
                {formatDocDate(claim.expense_date ?? claim.createdAt)}
              </span>
            </div>
            {claim.category_name ? (
              <div>
                <span className="fdoc-detail__meta-label">Category</span>
                <span className="fdoc-detail__meta-value">
                  {claim.category_name}
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
                {formatDocDate(claim.createdAt)}
              </span>
            </div>
            {claim.updatedAt ? (
              <div>
                <span className="fdoc-detail__meta-label">Updated</span>
                <span className="fdoc-detail__meta-value">
                  {formatDocDate(claim.updatedAt)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="fdoc-lines__footer" data-section="totals">
            <div />
            <dl className="fdoc-totals">
              <div className="fdoc-totals__grand">
                <dt className="fdoc-totals__label">Claim amount</dt>
                <dd className="fdoc-totals__value">
                  {formatDocMoney(claim.amount ?? 0, currency)}
                </dd>
              </div>
            </dl>
          </div>

          {claim.description ? (
            <div className="fdoc-paper__notes">
              <h4>Description</h4>
              {claim.description}
            </div>
          ) : null}
        </section>

        {/* ─── Rail ─────────────────────────────────────────────── */}
        <aside className="fdoc-rail" aria-label="Claim context">
          <Card variant="outlined">
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <UserRound size={14} aria-hidden="true" /> Employee
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {employeeLabel ? (
                <>
                  {employeeHref ? (
                    <Link
                      href={employeeHref}
                      className="text-sm font-medium text-[var(--st-accent)] hover:underline"
                    >
                      {employeeLabel}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">{employeeLabel}</span>
                  )}
                  <span className="fdoc-cell-sub">
                    {employee
                      ? (employee.email ?? 'CRM person record')
                      : 'Non-CRM employee (free text)'}
                  </span>
                </>
              ) : (
                <span className="fdoc-unknown-party text-sm">
                  Unknown employee
                </span>
              )}
            </CardBody>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <Paperclip size={14} aria-hidden="true" /> Receipt
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {claim.receipt_url ? (
                <a
                  href={claim.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-[var(--st-accent)] hover:underline"
                >
                  {claim.receipt_name || 'View receipt'}
                </a>
              ) : (
                <span className="fdoc-cell-sub">No receipt attached.</span>
              )}
            </CardBody>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck size={14} aria-hidden="true" /> Approval
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {claim.approver_name || claim.approver_id ? (
                <>
                  <span className="text-sm font-medium">
                    {claim.approver_name || 'Approver on record'}
                  </span>
                  <span className="fdoc-cell-sub">
                    {status === 'approved' || status === 'reimbursed'
                      ? 'Approved this claim'
                      : 'Last reviewer'}
                  </span>
                </>
              ) : (
                <span className="fdoc-cell-sub">
                  Not reviewed yet — approving stamps your user as the
                  approver.
                </span>
              )}
              <div className="mt-2">
                <Badge
                  tone={
                    EXPENSE_STATUSES.find((s) => s.value === status)?.tone ??
                    'neutral'
                  }
                  dot
                >
                  {EXPENSE_STATUSES.find((s) => s.value === status)?.label ??
                    status}
                </Badge>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

      <ExpenseFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={claim}
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
            <AlertDialogTitle>Archive {num}?</AlertDialogTitle>
            <AlertDialogDescription>
              The claim disappears from the list (crm-common soft delete).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={archiving}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={archiving} onClick={handleArchive}>
              Archive claim
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
