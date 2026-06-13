'use client';

/**
 * SabCRM People — Payroll run detail client (WI-32, flagship #2).
 *
 * Composes the doc-surface DocDetailPage with the payroll lifecycle:
 *
 *   - paper: one line per `EmployeeRunRow` (resolved employee label,
 *     rate = gross, total = net) with totals mapped gross→subTotal,
 *     deduction roll-up→discountTotal, net→total — all ENGINE-computed
 *     (risk R8: nothing is re-derived here);
 *   - rail: approvals timeline + per-employee expandable earnings /
 *     deductions / reimbursements breakdowns; generated payslips link
 *     out as lineage children;
 *   - actions: Compute (draft/processing), Approve (with comment),
 *     Disburse (approved, confirmed), Generate payslips
 *     (approved/disbursed), Edit draft fields, Delete (draft, danger).
 *     The server re-validates every transition.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  Calculator,
  CheckCircle2,
  FilePenLine,
  Printer,
  ReceiptText,
  Trash2,
  UserCheck,
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SelectField,
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  ConvertMenu,
  DocDetailPage,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
  type DocDetailLine,
  type DocRelatedRef,
} from '../../../finance/_components/doc-surface';
import {
  PAYROLL_RUN_BANK_FILE_FORMATS,
  PAYROLL_RUN_FLOW,
  PAYROLL_RUN_STATUSES,
  PEOPLE_PAYROLL_RUNS_PATH,
  bankFileFormatLabel,
  payslipDetailHref,
} from '../payroll-runs-config';

import {
  approveSabcrmPayrollRun,
  computeSabcrmPayrollRun,
  deleteSabcrmPayrollRun,
  disburseSabcrmPayrollRun,
  generateSabcrmPayslips,
  updateSabcrmPayrollRun,
} from '@/app/actions/sabcrm-people-payroll-runs.actions';
import type {
  SabcrmPayrollRunDetail,
  SabcrmPayrollRunEmployeeView,
  SabcrmPayrollRunFormInput,
} from '@/app/actions/sabcrm-people-payroll-runs.actions.types';
import type {
  CrmPayrollRunBankFileFormat,
  CrmPayrollRunStatus,
} from '@/lib/rust-client/crm-payroll-runs';

/* ─── Helpers ─────────────────────────────────────────────────── */

const CURRENCY = 'INR';

function periodLabel(from: string, to: string): string {
  return `${formatDocDate(from)} – ${formatDocDate(to)}`;
}

const FORMAT_OPTIONS: SelectOption[] = [
  { value: '', label: 'Not set' },
  ...PAYROLL_RUN_BANK_FILE_FORMATS.map((f) => ({
    value: f.value,
    label: f.label,
  })),
];

/* ─── Approve dialog (signed server-side, optional comment) ───── */

interface ApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  runLabel: string;
  onDone: () => void;
}

function ApproveDialog({
  open,
  onOpenChange,
  runId,
  runLabel,
  onDone,
}: ApproveDialogProps): React.JSX.Element {
  const [comment, setComment] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setComment('');
    setError(null);
  }, [open]);

  const submit = (): void => {
    setError(null);
    startTransition(async () => {
      const res = await approveSabcrmPayrollRun(runId, comment || undefined);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Run ${runLabel} approved.`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="run-approve-desc">
        <DialogHeader>
          <DialogTitle>Approve this payroll run?</DialogTitle>
          <DialogDescription id="run-approve-desc">
            {runLabel} — the approval is signed as you and unlocks disbursal.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Comment" help="Optional — stored on the approval step.">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Verified against the attendance lock…"
                disabled={pending}
                autoFocus
              />
            </Field>
            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              Approve run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit dialog (full draft-field set) ──────────────────────── */

interface EditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  seed: SabcrmPayrollRunFormInput;
  onDone: () => void;
}

function EditDialog({
  open,
  onOpenChange,
  runId,
  seed,
  onDone,
}: EditDialogProps): React.JSX.Element {
  const [form, setForm] = React.useState<SabcrmPayrollRunFormInput>(seed);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setForm(seed);
    setError(null);
  }, [open, seed]);

  const patch = (p: Partial<SabcrmPayrollRunFormInput>): void =>
    setForm((prev) => ({ ...prev, ...p }));

  const submit = (): void => {
    setError(null);
    startTransition(async () => {
      const res = await updateSabcrmPayrollRun(runId, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Run ${res.data.periodLabel} updated.`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="run-edit-desc">
        <DialogHeader>
          <DialogTitle>Edit payroll run</DialogTitle>
          <DialogDescription id="run-edit-desc">
            Every stored draft field is editable until the run is approved.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Period start" required>
              <Input
                type="date"
                value={form.periodFrom}
                onChange={(e) => patch({ periodFrom: e.target.value })}
                disabled={pending}
              />
            </Field>
            <Field label="Period end" required>
              <Input
                type="date"
                value={form.periodTo}
                onChange={(e) => patch({ periodTo: e.target.value })}
                disabled={pending}
              />
            </Field>
            <Field label="Pay date">
              <Input
                type="date"
                value={form.payDate ?? ''}
                onChange={(e) => patch({ payDate: e.target.value })}
                disabled={pending}
              />
            </Field>
            <Field label="Lock date">
              <Input
                type="date"
                value={form.lockDate ?? ''}
                onChange={(e) => patch({ lockDate: e.target.value })}
                disabled={pending}
              />
            </Field>
            <Field label="Bank file format">
              <SelectField
                value={form.bankFileFormat ?? ''}
                onChange={(v) =>
                  patch({
                    bankFileFormat: (v || '') as CrmPayrollRunBankFileFormat | '',
                  })
                }
                options={FORMAT_OPTIONS}
                disabled={pending}
                aria-label="Bank file format"
              />
            </Field>
            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Rail cards ──────────────────────────────────────────────── */

function ApprovalsCard({
  approvals,
}: {
  approvals: SabcrmPayrollRunDetail['approvals'];
}): React.JSX.Element {
  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <UserCheck size={14} aria-hidden="true" /> Approvals
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        {approvals.length === 0 ? (
          <span className="fdoc-cell-sub">
            No approvals yet — they appear here once the run is approved.
          </span>
        ) : (
          <ul className="fdoc-rail-list">
            {approvals.map((step, i) => (
              <li key={`${step.approverId}-${i}`} className="fdoc-rail-item">
                <span>
                  {step.approverLabel}
                  <span className="fdoc-rail-item__kind">
                    {step.decidedAt ? formatDocDate(step.decidedAt) : 'Pending'}
                    {step.comment ? ` · ${step.comment}` : ''}
                  </span>
                </span>
                <Badge tone={step.status === 'approved' ? 'success' : 'neutral'}>
                  {step.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function BreakdownTable({
  caption,
  rows,
}: {
  caption: string;
  rows: { label: string; amount: number }[];
}): React.JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <div className="mt-2">
      <span className="fdoc-detail__meta-label">{caption}</span>
      <dl className="m-0 mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm">
        {rows.map((row, i) => (
          <React.Fragment key={`${row.label}-${i}`}>
            <dt className="m-0 text-[var(--st-text-secondary)]">{row.label}</dt>
            <dd className="m-0 text-right tabular-nums">
              {formatDocMoney(row.amount, CURRENCY)}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

function EmployeeBreakdownCard({
  employees,
}: {
  employees: SabcrmPayrollRunEmployeeView[];
}): React.JSX.Element {
  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>Per-employee breakdown</CardTitle>
      </CardHeader>
      <CardBody>
        {employees.length === 0 ? (
          <span className="fdoc-cell-sub">
            Nothing computed yet — run Compute to resolve the roster against
            each employee&apos;s salary structure.
          </span>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {employees.map((emp) => (
              <li key={emp.employeeId}>
                <details className="group rounded-md border border-[var(--st-border)] px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
                    <span>{emp.employeeLabel}</span>
                    <span className="tabular-nums text-[var(--st-text-secondary)]">
                      {formatDocMoney(emp.net, CURRENCY)}
                    </span>
                  </summary>
                  <BreakdownTable
                    caption="Earnings"
                    rows={(emp.earnings ?? []).map((l) => ({
                      label: l.label || l.code,
                      amount: l.amount,
                    }))}
                  />
                  <BreakdownTable
                    caption="Deductions"
                    rows={(emp.deductions ?? []).map((l) => ({
                      label: l.label || l.code,
                      amount: l.amount,
                    }))}
                  />
                  <BreakdownTable
                    caption="Reimbursements"
                    rows={(emp.reimbursements ?? []).map((l) => ({
                      label: l.category,
                      amount: l.amount,
                    }))}
                  />
                  <dl className="m-0 mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-[var(--st-border)] pt-2 text-sm">
                    <dt className="m-0 text-[var(--st-text-secondary)]">Gross</dt>
                    <dd className="m-0 text-right tabular-nums">
                      {formatDocMoney(emp.gross, CURRENCY)}
                    </dd>
                    <dt className="m-0 text-[var(--st-text-secondary)]">CTC</dt>
                    <dd className="m-0 text-right tabular-nums">
                      {formatDocMoney(emp.ctc, CURRENCY)}
                    </dd>
                    <dt className="m-0 font-medium">Net pay</dt>
                    <dd className="m-0 text-right font-medium tabular-nums">
                      {formatDocMoney(emp.net, CURRENCY)}
                    </dd>
                  </dl>
                </details>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface PayrollRunDetailClientProps {
  detail: SabcrmPayrollRunDetail | null;
  error: string | null;
}

export function PayrollRunDetailClient({
  detail,
  error,
}: PayrollRunDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDisburse, setConfirmDisburse] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [working, startWork] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const editSeed = React.useMemo<SabcrmPayrollRunFormInput>(() => {
    const run = detail?.run;
    return {
      periodFrom: (run?.periodFrom ?? '').slice(0, 10),
      periodTo: (run?.periodTo ?? '').slice(0, 10),
      payDate: run?.payDate ? run.payDate.slice(0, 10) : undefined,
      lockDate: run?.lockDate ? run.lockDate.slice(0, 10) : undefined,
      bankFileFormat: run?.bankFileFormat ?? '',
    };
  }, [detail?.run]);

  if (!detail) {
    return (
      <DocDetailPage
        backHref={PEOPLE_PAYROLL_RUNS_PATH}
        backLabel="Payroll runs"
        docNumber="Payroll run"
        entitySingular="Payroll run"
        statuses={PAYROLL_RUN_STATUSES}
        flow={PAYROLL_RUN_FLOW}
        status="draft"
        party={null}
        meta={[]}
        currency={CURRENCY}
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Payroll run not found.'}
      />
    );
  }

  const { run, employees, approvals, payslips } = detail;
  const status = (run.status ?? 'draft') as CrmPayrollRunStatus;
  const label = periodLabel(run.periodFrom, run.periodTo);
  const gross = run.totals?.gross ?? 0;
  const net = run.totals?.net ?? 0;
  const employeeCount = run.totals?.employeeCount ?? employees.length;
  const deductionRollup = Math.max(0, gross - net);

  const canCompute = status === 'draft' || status === 'processing';
  const canApprove = status === 'draft' || status === 'processing';
  const canDisburse = status === 'approved';
  const canGeneratePayslips = status === 'approved' || status === 'disbursed';
  const canEdit = status === 'draft';
  const canDelete = status === 'draft';

  const compute = (): void => {
    startWork(async () => {
      const res = await computeSabcrmPayrollRun(run._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Computed ${res.data.employeeCount} ${res.data.employeeCount === 1 ? 'employee' : 'employees'} — net ${formatDocMoney(res.data.net, CURRENCY)}.`,
      );
      refresh();
    });
  };

  const disburse = (): void => {
    startWork(async () => {
      const res = await disburseSabcrmPayrollRun(run._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Run ${label} disbursed.`);
      setConfirmDisburse(false);
      refresh();
    });
  };

  const generatePayslips = (): void => {
    startWork(async () => {
      const res = await generateSabcrmPayslips(run._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `${res.data.generated} ${res.data.generated === 1 ? 'payslip' : 'payslips'} generated${res.data.skipped > 0 ? ` (${res.data.skipped} skipped)` : ''}.`,
      );
      refresh();
    });
  };

  const handleDelete = (): void => {
    startDelete(async () => {
      const res = await deleteSabcrmPayrollRun(run._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Run ${label} deleted.`);
      router.push(PEOPLE_PAYROLL_RUNS_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const menuItems: ConvertMenuItem[] = [
    {
      key: 'compute',
      label: 'Compute',
      description: 'Resolve the roster against salary structures',
      icon: Calculator,
      disabled: !canCompute,
      onSelect: compute,
    },
    {
      key: 'approve',
      label: 'Approve…',
      description: 'Sign-off with an optional comment',
      icon: CheckCircle2,
      disabled: !canApprove,
      onSelect: () => setApproveOpen(true),
    },
    {
      key: 'disburse',
      label: 'Disburse…',
      description: 'Generate the bank file and pay out',
      icon: Banknote,
      disabled: !canDisburse,
      onSelect: () => setConfirmDisburse(true),
    },
    {
      key: 'payslips',
      label: 'Generate payslips',
      description: 'Freeze one payslip per employee row',
      icon: ReceiptText,
      disabled: !canGeneratePayslips,
      group: true,
      onSelect: generatePayslips,
    },
    {
      key: 'delete',
      label: 'Delete run',
      icon: Trash2,
      danger: true,
      disabled: !canDelete,
      group: true,
      onSelect: () => setConfirmDelete(true),
    },
  ];

  const actions = (
    <>
      {canCompute ? (
        <Button
          variant="primary"
          iconLeft={Calculator}
          loading={working}
          onClick={compute}
        >
          Compute
        </Button>
      ) : null}
      {canDisburse ? (
        <Button
          variant="primary"
          iconLeft={Banknote}
          onClick={() => setConfirmDisburse(true)}
        >
          Disburse
        </Button>
      ) : null}
      {status === 'disbursed' && payslips.length === 0 ? (
        <Button
          variant="primary"
          iconLeft={ReceiptText}
          loading={working}
          onClick={generatePayslips}
        >
          Generate payslips
        </Button>
      ) : null}
      <Button
        variant="secondary"
        iconLeft={Printer}
        onClick={() => window.print()}
      >
        Print
      </Button>
      {canEdit ? (
        <Button
          variant="secondary"
          iconLeft={FilePenLine}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
      ) : null}
      <ConvertMenu label="Lifecycle" items={menuItems} disabled={working} />
    </>
  );

  /* ---- paper data ---- */
  const lines: DocDetailLine[] = employees.map((emp) => ({
    description: emp.employeeLabel,
    itemLabel:
      (emp.deductions ?? []).length > 0 || (emp.earnings ?? []).length > 0
        ? `${(emp.earnings ?? []).length} earnings · ${(emp.deductions ?? []).length} deductions`
        : null,
    qty: 1,
    rate: emp.gross,
    total: emp.net,
  }));

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Pay date', value: formatDocDate(run.payDate) },
    { label: 'Lock date', value: formatDocDate(run.lockDate) },
    {
      label: 'Bank file format',
      value: bankFileFormatLabel(run.bankFileFormat) ?? '—',
    },
    ...(run.bankFileId
      ? [
          {
            label: 'Bank file',
            value: <span className="font-mono text-xs">{run.bankFileId}</span>,
          },
        ]
      : []),
    { label: 'Employees', value: String(employeeCount) },
    {
      label: 'Approvals',
      value: String(approvals.length),
    },
    ...(run.createdAt
      ? [{ label: 'Created', value: formatDocDate(run.createdAt) }]
      : []),
  ];

  const related: DocRelatedRef[] = payslips.map((slip) => ({
    kind: 'payslip',
    id: slip.id,
    label: slip.employeeLabel,
    href: payslipDetailHref(slip.id),
    amount: slip.netPay,
    currency: CURRENCY,
    status: slip.sent ? 'sent' : undefined,
    direction: 'child',
  }));

  return (
    <>
      <DocDetailPage
        backHref={PEOPLE_PAYROLL_RUNS_PATH}
        backLabel="Payroll runs"
        docNumber={label}
        entitySingular="Payroll run"
        statuses={PAYROLL_RUN_STATUSES}
        flow={PAYROLL_RUN_FLOW}
        status={status}
        actions={actions}
        party={{
          label: `${employeeCount} ${employeeCount === 1 ? 'employee' : 'employees'}`,
          href: null,
          meta: 'Payroll roster for this period',
        }}
        meta={meta}
        currency={CURRENCY}
        lines={lines}
        totals={{
          subTotal: gross,
          discountTotal: deductionRollup,
          total: net,
        }}
        related={related}
        railExtra={
          <>
            <ApprovalsCard approvals={approvals} />
            <EmployeeBreakdownCard employees={employees} />
          </>
        }
      />

      <ApproveDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        runId={run._id}
        runLabel={label}
        onDone={refresh}
      />

      <EditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        runId={run._id}
        seed={editSeed}
        onDone={refresh}
      />

      <AlertDialog
        open={confirmDisburse}
        onOpenChange={(next) => !next && !working && setConfirmDisburse(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disburse {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              The bank file is generated and the run flips to disbursed —
              {' '}{formatDocMoney(net, CURRENCY)} across {employeeCount}{' '}
              {employeeCount === 1 ? 'employee' : 'employees'}. This cannot be
              re-run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={working}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="primary" loading={working} onClick={disburse}>
              Disburse run
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => !next && !deleting && setConfirmDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the draft run. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete run
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
