'use client';

/**
 * SabCRM People — Leave surface client (`/sabcrm/people/leave`, WI-26).
 *
 * Tabbed doc-surface adopter over BOTH `crm-leaves` subtrees:
 *
 *   - **Applications** (default tab): KPI strip (pending / approved
 *     this month / on leave today / catalog size), config-driven list
 *     (search + status + employee + from-date filters, server
 *     pagination, CSV export) and an application drawer — the FULL
 *     create field set (leave type picker, on-behalf employee picker,
 *     inclusive date range, half-day flag, reason, SabFiles
 *     attachments, server-computed `days` preview), the
 *     `StatusFlow` rail (pending → approved; rejected / cancelled
 *     off-path), the resolved approver-chain timeline and a
 *     `ConvertMenu` with the Approve decision (with comment). The
 *     engine exposes APPROVE only today — Reject renders disabled
 *     until the endpoint ships (the UI never fakes a transition).
 *   - **Types**: the nine-field leave-type catalog (code, name, paid,
 *     accrual rule, max balance, carry-forward, encashable, gender
 *     restriction, min service months) with a full editor drawer.
 *
 * Employees and leave types are picked through the kit `EntityPicker`
 * (gated search actions) and render as RESOLVED labels — never raw
 * ObjectIds. Deep links: `?tab=`, `?open=<applicationId>`,
 * `?type=<leaveTypeId>`.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarOff,
  CheckCircle2,
  Hourglass,
  Layers,
  Paperclip,
  Plus,
  Trash2,
  X,
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  SelectField,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';
import { SabFilePickerButton } from '@/components/sabfiles';

import {
  ConvertMenu,
  DocListPage,
  EntityPicker,
  StatusFlow,
  formatDocDate,
  type ConvertMenuItem,
  type DocListColumn,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';
import {
  LEAVE_FLOW,
  LEAVE_PATH,
  LEAVE_STATUSES,
  leaveApplicationOpenHref,
  leaveTypeOpenHref,
  toLeaveApplicationFilters,
  type LeaveTab,
} from './leave-config';

import {
  approveSabcrmLeaveApplication,
  createSabcrmLeaveApplication,
  deleteSabcrmLeaveApplication,
  deleteSabcrmLeaveType,
  getSabcrmLeaveApplication,
  listSabcrmLeaveApplicationsPage,
  listSabcrmLeaveTypesPage,
  saveSabcrmLeaveType,
  searchSabcrmLeaveEmployees,
  searchSabcrmLeaveTypes,
  updateSabcrmLeaveApplication,
} from '@/app/actions/sabcrm-people-leave.actions';
import type {
  SabcrmLeaveApplicationDetail,
  SabcrmLeaveApplicationInput,
  SabcrmLeaveApplicationRow,
  SabcrmLeaveKpis,
  SabcrmLeaveTypeInput,
  SabcrmLeaveTypeRow,
} from '@/app/actions/sabcrm-people-leave.actions.types';

/* ─── Shared helpers ──────────────────────────────────────────── */

interface Picked {
  id: string;
  label: string | null;
}

interface AttachmentDraft {
  fileId: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

/** Inclusive calendar-day span (`null` when the range is incomplete). */
function inclusiveDays(from: string, to: string): number | null {
  if (!from || !to) return null;
  const f = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const t = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t) || t < f) return null;
  return Math.round((t - f) / 86_400_000) + 1;
}

function formatBytes(size: number | null | undefined): string | null {
  if (size == null || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function statusDef(value: string) {
  return LEAVE_STATUSES.find((s) => s.value === value);
}

/** Read-only stat row inside detail views. */
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-xs font-medium opacity-70">{label}</dt>
      <dd className="m-0 text-right text-sm">{children}</dd>
    </div>
  );
}

/* ─── Application columns (full LeaveApplication coverage) ────── */

const APPLICATION_COLUMNS: DocListColumn<SabcrmLeaveApplicationRow>[] = [
  {
    key: 'employee',
    header: 'Employee',
    kind: 'party',
    value: (r) => r.employeeLabel,
  },
  {
    key: 'leaveType',
    header: 'Leave type',
    kind: 'party',
    value: (r) => r.leaveTypeLabel,
  },
  { key: 'from', header: 'From', kind: 'date', value: (r) => r.from },
  { key: 'to', header: 'To', kind: 'date', value: (r) => r.to },
  {
    key: 'days',
    header: 'Days',
    kind: 'text',
    value: (r) => String(r.days),
  },
  {
    key: 'halfDay',
    header: 'Half day',
    kind: 'badge',
    value: (r) => (r.halfDay ? 'Half day' : null),
    tone: () => 'info',
  },
  {
    key: 'balance',
    header: 'Balance',
    kind: 'text',
    value: (r) =>
      r.balanceSnapshot != null ? String(r.balanceSnapshot) : null,
  },
  {
    key: 'attachments',
    header: 'Files',
    kind: 'badge',
    value: (r) => (r.attachmentCount > 0 ? String(r.attachmentCount) : null),
    tone: () => 'neutral',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Type columns (all nine catalog fields per WI-26) ────────── */

const TYPE_COLUMNS: DocListColumn<SabcrmLeaveTypeRow>[] = [
  { key: 'code', header: 'Code', kind: 'text', value: (r) => r.code },
  { key: 'name', header: 'Name', kind: 'text', value: (r) => r.name },
  {
    key: 'paid',
    header: 'Paid',
    kind: 'badge',
    value: (r) => (r.paid ? 'Paid' : 'Unpaid'),
    tone: (r) => (r.paid ? 'success' : 'neutral'),
  },
  {
    key: 'accrualRule',
    header: 'Accrual',
    kind: 'text',
    value: (r) => r.accrualRule,
  },
  {
    key: 'maxBalance',
    header: 'Max balance',
    kind: 'text',
    value: (r) => (r.maxBalance != null ? String(r.maxBalance) : null),
  },
  {
    key: 'carryForward',
    header: 'Carry forward',
    kind: 'badge',
    value: (r) => (r.carryForward ? 'Carries' : null),
    tone: () => 'info',
  },
  {
    key: 'encashable',
    header: 'Encashable',
    kind: 'badge',
    value: (r) => (r.encashable ? 'Encashable' : null),
    tone: () => 'info',
  },
  {
    key: 'genderRestricted',
    header: 'Gender',
    kind: 'text',
    value: (r) => r.genderRestricted,
  },
  {
    key: 'minServiceMonths',
    header: 'Min service',
    kind: 'text',
    value: (r) =>
      r.minServiceMonths != null ? `${r.minServiceMonths} mo` : null,
  },
];

/* ═══ Application drawer (create / pending-edit / decided view) ══ */

interface ApplicationFormState {
  leaveType: Picked | null;
  employee: Picked | null;
  from: string;
  to: string;
  halfDay: boolean;
  reason: string;
  attachments: AttachmentDraft[];
}

function emptyApplicationForm(): ApplicationFormState {
  return {
    leaveType: null,
    employee: null,
    from: '',
    to: '',
    halfDay: false,
    reason: '',
    attachments: [],
  };
}

function formFromDetail(d: SabcrmLeaveApplicationDetail): ApplicationFormState {
  return {
    leaveType: { id: d.leaveTypeId, label: d.leaveTypeLabel },
    employee: d.employeeId
      ? { id: d.employeeId, label: d.employeeLabel }
      : null,
    from: d.from.slice(0, 10),
    to: d.to.slice(0, 10),
    halfDay: d.halfDay,
    reason: d.reason ?? '',
    attachments: d.attachments.map((a) => ({
      fileId: a.fileId,
      name: a.name ?? undefined,
      mimeType: a.mimeType ?? undefined,
      size: a.size ?? undefined,
    })),
  };
}

interface ApplicationDrawerProps {
  open: boolean;
  /** Null = create mode. */
  detail: SabcrmLeaveApplicationDetail | null;
  onClose: () => void;
  onSaved: () => void;
}

function ApplicationDrawer({
  open,
  detail,
  onClose,
  onSaved,
}: ApplicationDrawerProps): React.JSX.Element {
  const [form, setForm] = React.useState<ApplicationFormState>(
    emptyApplicationForm,
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const [approveOpen, setApproveOpen] = React.useState(false);
  const [approveComment, setApproveComment] = React.useState('');
  const [approving, setApproving] = React.useState(false);

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const busy = pending || approving || deleting;
  const editable = !detail || detail.status === 'pending';
  const mode = !detail ? 'create' : editable ? 'edit' : 'view';

  React.useEffect(() => {
    if (!open) return;
    setForm(detail ? formFromDetail(detail) : emptyApplicationForm());
    setErrors({});
    setFormError(null);
    setApproveOpen(false);
    setApproveComment('');
  }, [open, detail]);

  const patch = (p: Partial<ApplicationFormState>): void =>
    setForm((prev) => ({ ...prev, ...p }));

  const previewDays = inclusiveDays(form.from, form.to);
  const previewText =
    previewDays === null
      ? 'Pick both dates to preview the day count.'
      : form.halfDay && previewDays === 1
        ? '0.5 day (half day) — the engine computes the final figure.'
        : `${previewDays} day${previewDays === 1 ? '' : 's'}${form.halfDay ? ' (half-day flag set)' : ''} — the engine computes the final figure.`;

  const submit = (): void => {
    setFormError(null);
    const next: Record<string, string> = {};
    if (!form.leaveType) next.leaveType = 'Pick a leave type.';
    if (!form.from) next.from = 'Start date is required.';
    if (!form.to) next.to = 'End date is required.';
    if (form.from && form.to && form.to < form.from) {
      next.to = 'The end date must be on or after the start date.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      if (!detail) {
        const input: SabcrmLeaveApplicationInput = {
          leaveTypeId: form.leaveType?.id ?? '',
          from: form.from,
          to: form.to,
          halfDay: form.halfDay,
          reason: form.reason || undefined,
          employeeId: form.employee?.id || undefined,
          attachments: form.attachments.length ? form.attachments : undefined,
        };
        const res = await createSabcrmLeaveApplication(input);
        if (!res.ok) {
          setFormError(res.error);
          return;
        }
        toast.success('Leave application submitted.');
        onSaved();
        return;
      }

      const res = await updateSabcrmLeaveApplication(detail.id, {
        leaveTypeId: form.leaveType?.id,
        from: form.from,
        to: form.to,
        halfDay: form.halfDay,
        reason: form.reason,
        attachments: form.attachments,
      });
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success('Application updated.');
      onSaved();
    });
  };

  const approve = async (): Promise<void> => {
    if (!detail) return;
    setApproving(true);
    try {
      const res = await approveSabcrmLeaveApplication(
        detail.id,
        approveComment || undefined,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Application approved.');
      setApproveOpen(false);
      onSaved();
    } finally {
      setApproving(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!detail) return;
    setDeleting(true);
    try {
      const res = await deleteSabcrmLeaveApplication(detail.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Application deleted.');
      setConfirmDelete(false);
      onSaved();
    } finally {
      setDeleting(false);
    }
  };

  const menuItems: ConvertMenuItem[] = detail
    ? [
        {
          key: 'approve',
          label: 'Approve…',
          icon: CheckCircle2,
          description: 'Adds you to the approver chain',
          disabled: detail.status !== 'pending' || busy,
          onSelect: () => {
            setApproveComment('');
            setApproveOpen(true);
          },
        },
        {
          key: 'reject',
          label: 'Reject',
          icon: XCircle,
          description: 'Engine exposes approve only today',
          danger: true,
          disabled: true,
          onSelect: () => undefined,
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          danger: true,
          disabled: busy,
          group: true,
          onSelect: () => setConfirmDelete(true),
        },
      ]
    : [];

  const chain = detail?.approverChain ?? [];

  const approverChainBlock = detail ? (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
        Approver chain
      </h3>
      {chain.length === 0 ? (
        <p className="m-0 text-sm opacity-70">
          No decisions yet — the chain fills as approvers act.
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {chain.map((step, i) => (
            <li
              key={`${step.approverId ?? 'unassigned'}-${i}`}
              className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <Badge tone={statusDef(step.status)?.tone ?? 'neutral'} dot>
                {statusDef(step.status)?.label ?? step.status}
              </Badge>
              <span className="font-medium">
                {step.approverLabel ?? 'Unresolved approver'}
              </span>
              {step.decidedAt ? (
                <span className="text-xs opacity-70">
                  {formatDocDate(step.decidedAt)}
                </span>
              ) : null}
              {step.comment ? (
                <span className="w-full text-xs opacity-80">
                  “{step.comment}”
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  ) : null;

  const attachmentsEditor = (
    <Field
      label="Attachments"
      help="Medical certificates, travel documents — everything lives in SabFiles."
    >
      <div className="flex flex-col gap-2">
        <div>
          <SabFilePickerButton
            onPick={(p) => {
              if (form.attachments.some((a) => a.fileId === p.id)) return;
              patch({
                attachments: [
                  ...form.attachments,
                  { fileId: p.id, name: p.name, mimeType: p.mime, size: p.size },
                ],
              });
            }}
          >
            Attach a file
          </SabFilePickerButton>
        </div>
        {form.attachments.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {form.attachments.map((a) => (
              <li
                key={a.fileId}
                className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
              >
                <Paperclip size={14} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  {a.name ?? 'Attachment'}
                </span>
                {formatBytes(a.size) ? (
                  <span className="text-xs opacity-70">
                    {formatBytes(a.size)}
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={`Remove ${a.name ?? 'attachment'}`}
                  disabled={busy}
                  onClick={() =>
                    patch({
                      attachments: form.attachments.filter(
                        (x) => x.fileId !== a.fileId,
                      ),
                    })
                  }
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Field>
  );

  return (
    <Drawer open={open} onOpenChange={(next) => !next && !busy && onClose()} side="right">
      <DrawerContent
        aria-describedby="leave-application-desc"
        className="fdoc-form-drawer"
      >
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create'
              ? 'New leave application'
              : `Application — ${detail?.employeeLabel ?? 'employee'}`}
          </DrawerTitle>
          <DrawerDescription id="leave-application-desc">
            {mode === 'create'
              ? 'Apply for leave — pick the type, the inclusive date range and attach any documents.'
              : mode === 'edit'
                ? 'Pending applications stay editable; decide them from the actions menu.'
                : 'This application has been decided and is read-only.'}
          </DrawerDescription>
        </DrawerHeader>

        {detail ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3">
            <StatusFlow
              flow={LEAVE_FLOW}
              statuses={LEAVE_STATUSES}
              current={detail.status}
            />
            <ConvertMenu label="Actions" items={menuItems} disabled={busy} />
          </div>
        ) : null}

        {editable ? (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div className="fdoc-form-grid">
                <div className="fdoc-form-grid__full">
                  <Field label="Leave type" required error={errors.leaveType}>
                    <EntityPicker
                      value={form.leaveType?.id ?? null}
                      valueLabel={form.leaveType?.label ?? null}
                      onChange={(opt) =>
                        patch({
                          leaveType: opt
                            ? { id: opt.id, label: opt.label }
                            : null,
                        })
                      }
                      search={async (q) => {
                        const res = await searchSabcrmLeaveTypes(q);
                        return res.ok ? res.data : [];
                      }}
                      placeholder="Search the catalog…"
                      disabled={busy}
                      invalid={Boolean(errors.leaveType)}
                      aria-label="Leave type"
                    />
                  </Field>
                </div>

                <div className="fdoc-form-grid__full">
                  <Field
                    label="Employee"
                    help={
                      detail
                        ? 'The applicant cannot be changed after submission.'
                        : 'Leave empty to apply for yourself; pick someone to apply on their behalf.'
                    }
                  >
                    <EntityPicker
                      value={form.employee?.id ?? null}
                      valueLabel={form.employee?.label ?? null}
                      onChange={(opt) =>
                        patch({
                          employee: opt
                            ? { id: opt.id, label: opt.label }
                            : null,
                        })
                      }
                      search={async (q) => {
                        const res = await searchSabcrmLeaveEmployees(q);
                        return res.ok ? res.data : [];
                      }}
                      placeholder="Search the roster…"
                      disabled={busy || Boolean(detail)}
                      aria-label="Employee (on behalf)"
                    />
                  </Field>
                </div>

                <Field label="From" required error={errors.from}>
                  <Input
                    type="date"
                    value={form.from}
                    onChange={(e) => patch({ from: e.target.value })}
                    disabled={busy}
                  />
                </Field>
                <Field label="To" required error={errors.to}>
                  <Input
                    type="date"
                    value={form.to}
                    onChange={(e) => patch({ to: e.target.value })}
                    disabled={busy}
                  />
                </Field>

                <Field label="Half day">
                  <Switch
                    label="Only half of the day is taken"
                    checked={form.halfDay}
                    onCheckedChange={(v) => patch({ halfDay: v })}
                    disabled={busy}
                  />
                </Field>
                <Field label="Days" help="Server-computed on save.">
                  <p className="m-0 py-1.5 text-sm opacity-80" aria-live="polite">
                    {previewText}
                  </p>
                </Field>

                <div className="fdoc-form-grid__full">
                  <Field label="Reason">
                    <Textarea
                      value={form.reason}
                      onChange={(e) => patch({ reason: e.target.value })}
                      rows={3}
                      placeholder="Why the leave is needed…"
                      disabled={busy}
                    />
                  </Field>
                </div>

                <div className="fdoc-form-grid__full">{attachmentsEditor}</div>
              </div>

              {detail ? (
                <>
                  {detail.balanceSnapshot != null ? (
                    <p className="mt-3 text-sm opacity-80">
                      Balance at application time: {detail.balanceSnapshot}
                    </p>
                  ) : null}
                  {approverChainBlock}
                </>
              ) : null}

              {formError ? (
                <div className="mt-3">
                  <Alert tone="danger" role="alert">
                    {formError}
                  </Alert>
                </div>
              ) : null}
            </div>

            <DrawerFooter>
              <Button
                type="button"
                variant="ghost"
                iconLeft={X}
                disabled={busy}
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={pending}
                disabled={busy && !pending}
              >
                {mode === 'create' ? 'Submit application' : 'Save changes'}
              </Button>
            </DrawerFooter>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <dl className="m-0 divide-y divide-[var(--u20-border,rgba(0,0,0,0.08))]">
                <DetailRow label="Employee">
                  {detail?.employeeLabel ?? 'Unresolved employee'}
                </DetailRow>
                <DetailRow label="Leave type">
                  {detail?.leaveTypeLabel ?? 'Unresolved type'}
                </DetailRow>
                <DetailRow label="From">{formatDocDate(detail?.from)}</DetailRow>
                <DetailRow label="To">{formatDocDate(detail?.to)}</DetailRow>
                <DetailRow label="Days">
                  {detail ? String(detail.days) : '—'}
                </DetailRow>
                <DetailRow label="Half day">
                  {detail?.halfDay ? 'Yes' : 'No'}
                </DetailRow>
                <DetailRow label="Balance snapshot">
                  {detail?.balanceSnapshot != null
                    ? String(detail.balanceSnapshot)
                    : '—'}
                </DetailRow>
                <DetailRow label="Reason">{detail?.reason ?? '—'}</DetailRow>
                <DetailRow label="Applied on">
                  {detail?.createdAt ? formatDocDate(detail.createdAt) : '—'}
                </DetailRow>
                <DetailRow label="Last update">
                  {detail?.updatedAt ? formatDocDate(detail.updatedAt) : '—'}
                </DetailRow>
              </dl>

              {detail && detail.attachments.length > 0 ? (
                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                    Attachments
                  </h3>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {detail.attachments.map((a) => (
                      <li
                        key={a.fileId}
                        className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                      >
                        <Paperclip size={14} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">
                          {a.name ?? 'Attachment'}
                        </span>
                        {formatBytes(a.size) ? (
                          <span className="text-xs opacity-70">
                            {formatBytes(a.size)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {approverChainBlock}
            </div>
            <DrawerFooter>
              <Button
                type="button"
                variant="ghost"
                iconLeft={X}
                disabled={busy}
                onClick={onClose}
              >
                Close
              </Button>
            </DrawerFooter>
          </div>
        )}

        {/* Approve dialog (decision comment). */}
        <AlertDialog
          open={approveOpen}
          onOpenChange={(next) => !next && !approving && setApproveOpen(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve this application?</AlertDialogTitle>
              <AlertDialogDescription>
                {detail?.employeeLabel ?? 'The employee'} takes{' '}
                {detail ? `${detail.days} day${detail.days === 1 ? '' : 's'}` : 'leave'}{' '}
                of {detail?.leaveTypeLabel ?? 'leave'} from{' '}
                {formatDocDate(detail?.from)} to {formatDocDate(detail?.to)}.
                You are appended to the approver chain.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-1 pb-2">
              <Field label="Comment">
                <Textarea
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  rows={3}
                  placeholder="Optional note for the applicant…"
                  disabled={approving}
                />
              </Field>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary" disabled={approving}>
                  Back
                </Button>
              </AlertDialogCancel>
              <Button
                variant="primary"
                loading={approving}
                onClick={() => void approve()}
              >
                Approve
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete confirm. */}
        <AlertDialog
          open={confirmDelete}
          onOpenChange={(next) => !next && !deleting && setConfirmDelete(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this application?</AlertDialogTitle>
              <AlertDialogDescription>
                The application is removed permanently, including its approver
                chain. Approved balances are not re-credited automatically.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary" disabled={deleting}>
                  Keep it
                </Button>
              </AlertDialogCancel>
              <Button variant="danger" loading={deleting} onClick={() => void remove()}>
                Delete application
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}

/* ═══ Leave-type editor drawer (all nine catalog fields) ═════════ */

interface TypeFormState {
  code: string;
  name: string;
  paid: boolean;
  accrualRule: string;
  maxBalance: string;
  carryForward: boolean;
  encashable: boolean;
  genderRestricted: string;
  minServiceMonths: string;
}

function emptyTypeForm(): TypeFormState {
  return {
    code: '',
    name: '',
    paid: true,
    accrualRule: 'none',
    maxBalance: '',
    carryForward: false,
    encashable: false,
    genderRestricted: '',
    minServiceMonths: '',
  };
}

function typeFormFromRow(row: SabcrmLeaveTypeRow): TypeFormState {
  return {
    code: row.code,
    name: row.name,
    paid: row.paid,
    accrualRule: row.accrualRule,
    maxBalance: row.maxBalance != null ? String(row.maxBalance) : '',
    carryForward: row.carryForward,
    encashable: row.encashable,
    genderRestricted: row.genderRestricted ?? '',
    minServiceMonths:
      row.minServiceMonths != null ? String(row.minServiceMonths) : '',
  };
}

function numOrUndefined(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

const GENDER_OPTIONS: SelectOption[] = [
  { value: '', label: 'No restriction' },
  { value: 'male', label: 'Male only' },
  { value: 'female', label: 'Female only' },
  { value: 'other', label: 'Other' },
];

interface TypeDrawerProps {
  open: boolean;
  /** Null = create mode. */
  row: SabcrmLeaveTypeRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function LeaveTypeDrawer({
  open,
  row,
  onClose,
  onSaved,
}: TypeDrawerProps): React.JSX.Element {
  const [form, setForm] = React.useState<TypeFormState>(emptyTypeForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const busy = pending || deleting;
  const mode = row ? 'edit' : 'create';

  React.useEffect(() => {
    if (!open) return;
    setForm(row ? typeFormFromRow(row) : emptyTypeForm());
    setErrors({});
    setFormError(null);
  }, [open, row]);

  const patch = (p: Partial<TypeFormState>): void =>
    setForm((prev) => ({ ...prev, ...p }));

  const submit = (): void => {
    setFormError(null);
    const next: Record<string, string> = {};
    if (!form.code.trim()) next.code = 'Code is required.';
    if (!form.name.trim()) next.name = 'Name is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: SabcrmLeaveTypeInput = {
      code: form.code,
      name: form.name,
      paid: form.paid,
      accrualRule: form.accrualRule,
      maxBalance: numOrUndefined(form.maxBalance),
      carryForward: form.carryForward,
      encashable: form.encashable,
      genderRestricted: form.genderRestricted || undefined,
      minServiceMonths: numOrUndefined(form.minServiceMonths),
    };

    startTransition(async () => {
      const res = await saveSabcrmLeaveType(input, row?.id);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        row
          ? `${res.data.name} updated.`
          : `${res.data.name} added to the catalog.`,
      );
      onSaved();
    });
  };

  const remove = async (): Promise<void> => {
    if (!row) return;
    setDeleting(true);
    try {
      const res = await deleteSabcrmLeaveType(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${row.name} deleted.`);
      setConfirmDelete(false);
      onSaved();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(next) => !next && !busy && onClose()} side="right">
      <DrawerContent aria-describedby="leave-type-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? 'New leave type' : `Edit ${row?.name ?? 'leave type'}`}
          </DrawerTitle>
          <DrawerDescription id="leave-type-desc">
            {mode === 'create'
              ? 'Define the catalog entry — paid flag, accrual, balances and restrictions.'
              : 'Every stored field is editable.'}
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="fdoc-form-grid">
              <Field label="Code" required error={errors.code} help="Short identifier (e.g. CL, SL, PL).">
                <Input
                  value={form.code}
                  onChange={(e) => patch({ code: e.target.value })}
                  placeholder="CL"
                  disabled={busy}
                />
              </Field>
              <Field label="Name" required error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Casual leave"
                  disabled={busy}
                />
              </Field>

              <Field
                label="Accrual rule"
                help="How balance accrues — e.g. none, monthly:1.5, yearly:12."
              >
                <Input
                  value={form.accrualRule}
                  onChange={(e) => patch({ accrualRule: e.target.value })}
                  placeholder="monthly:1.5"
                  disabled={busy}
                />
              </Field>
              <Field label="Max balance" help="Cap on the accrued balance (empty = uncapped).">
                <Input
                  type="number"
                  min={0}
                  value={form.maxBalance}
                  onChange={(e) => patch({ maxBalance: e.target.value })}
                  placeholder="30"
                  disabled={busy}
                />
              </Field>

              <Field label="Flags">
                <div className="flex flex-col gap-2">
                  <Switch
                    label="Paid leave"
                    checked={form.paid}
                    onCheckedChange={(v) => patch({ paid: v })}
                    disabled={busy}
                  />
                  <Switch
                    label="Carries forward year to year"
                    checked={form.carryForward}
                    onCheckedChange={(v) => patch({ carryForward: v })}
                    disabled={busy}
                  />
                  <Switch
                    label="Encashable on exit"
                    checked={form.encashable}
                    onCheckedChange={(v) => patch({ encashable: v })}
                    disabled={busy}
                  />
                </div>
              </Field>

              <Field label="Gender restriction">
                <SelectField
                  value={form.genderRestricted}
                  onChange={(v) => patch({ genderRestricted: v ?? '' })}
                  options={GENDER_OPTIONS}
                  aria-label="Gender restriction"
                />
              </Field>

              <Field
                label="Min service (months)"
                help="Employees become eligible after this tenure."
              >
                <Input
                  type="number"
                  min={0}
                  value={form.minServiceMonths}
                  onChange={(e) => patch({ minServiceMonths: e.target.value })}
                  placeholder="6"
                  disabled={busy}
                />
              </Field>
            </div>

            {formError ? (
              <div className="mt-3">
                <Alert tone="danger" role="alert">
                  {formError}
                </Alert>
              </div>
            ) : null}
          </div>

          <DrawerFooter>
            <Button type="button" variant="ghost" iconLeft={X} disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            {row ? (
              <Button
                type="button"
                variant="danger"
                iconLeft={Trash2}
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : null}
            <Button type="submit" variant="primary" loading={pending} disabled={deleting}>
              {mode === 'create' ? 'Create leave type' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>

        <AlertDialog
          open={confirmDelete}
          onOpenChange={(next) => !next && !deleting && setConfirmDelete(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this leave type?</AlertDialogTitle>
              <AlertDialogDescription>
                {row?.name} is removed from the catalog. Existing applications
                keep their stored type id.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary" disabled={deleting}>
                  Keep it
                </Button>
              </AlertDialogCancel>
              <Button variant="danger" loading={deleting} onClick={() => void remove()}>
                Delete leave type
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}

/* ═══ Tabbed surface client ══════════════════════════════════════ */

export interface LeaveClientProps {
  initialTab: LeaveTab;
  initialApplicationRows: SabcrmLeaveApplicationRow[];
  initialApplicationsHasMore: boolean;
  initialApplicationsError: string | null;
  initialTypeRows: SabcrmLeaveTypeRow[];
  initialTypesHasMore: boolean;
  initialTypesError: string | null;
  kpis: SabcrmLeaveKpis | null;
  /** `?open=<id>` deep link — opens the application drawer. */
  initialOpenApplicationId: string | null;
  /** `?type=<id>` deep link — opens the leave-type editor. */
  initialOpenTypeId: string | null;
}

export function LeaveClient({
  initialTab,
  initialApplicationRows,
  initialApplicationsHasMore,
  initialApplicationsError,
  initialTypeRows,
  initialTypesHasMore,
  initialTypesError,
  kpis,
  initialOpenApplicationId,
  initialOpenTypeId,
}: LeaveClientProps): React.JSX.Element {
  const router = useRouter();
  const [tab, setTab] = React.useState<LeaveTab>(initialTab);

  const [appsRefreshToken, setAppsRefreshToken] = React.useState(0);
  const [typesRefreshToken, setTypesRefreshToken] = React.useState(0);

  const [appDrawerOpen, setAppDrawerOpen] = React.useState(false);
  const [appDetail, setAppDetail] =
    React.useState<SabcrmLeaveApplicationDetail | null>(null);

  const [typeDrawerOpen, setTypeDrawerOpen] = React.useState(false);
  const [typeRow, setTypeRow] = React.useState<SabcrmLeaveTypeRow | null>(null);

  const hadDeepLink = Boolean(initialOpenApplicationId || initialOpenTypeId);

  /* ---- deep links ---- */

  React.useEffect(() => {
    if (!initialOpenApplicationId) return;
    let stale = false;
    void (async () => {
      const res = await getSabcrmLeaveApplication(initialOpenApplicationId);
      if (stale) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAppDetail(res.data);
      setAppDrawerOpen(true);
    })();
    return () => {
      stale = true;
    };
  }, [initialOpenApplicationId]);

  React.useEffect(() => {
    if (!initialOpenTypeId) return;
    let stale = false;
    void (async () => {
      // Catalog rows have no single-get on the kit row shape — find the
      // row within the (bounded) catalog instead.
      const res = await listSabcrmLeaveTypesPage({ page: 1, limit: 100 });
      if (stale) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const found = res.data.rows.find((r) => r.id === initialOpenTypeId);
      if (!found) {
        toast.error('Leave type not found.');
        return;
      }
      setTypeRow(found);
      setTypeDrawerOpen(true);
    })();
    return () => {
      stale = true;
    };
  }, [initialOpenTypeId]);

  /* ---- tab + drawer plumbing ---- */

  const switchTab = React.useCallback(
    (next: string) => {
      const value: LeaveTab = next === 'types' ? 'types' : 'applications';
      setTab(value);
      router.replace(`${LEAVE_PATH}?tab=${value}`, { scroll: false });
    },
    [router],
  );

  const closeAppDrawer = React.useCallback(() => {
    setAppDrawerOpen(false);
    setAppDetail(null);
    if (hadDeepLink) {
      router.replace(`${LEAVE_PATH}?tab=applications`, { scroll: false });
    }
  }, [hadDeepLink, router]);

  const closeTypeDrawer = React.useCallback(() => {
    setTypeDrawerOpen(false);
    setTypeRow(null);
    if (hadDeepLink) {
      router.replace(`${LEAVE_PATH}?tab=types`, { scroll: false });
    }
  }, [hadDeepLink, router]);

  const onAppSaved = React.useCallback(() => {
    setAppsRefreshToken((t) => t + 1);
    closeAppDrawer();
    router.refresh();
  }, [closeAppDrawer, router]);

  const onTypeSaved = React.useCallback(() => {
    setTypesRefreshToken((t) => t + 1);
    closeTypeDrawer();
    router.refresh();
  }, [closeTypeDrawer, router]);

  /* ---- DocListPage configs ---- */

  const applicationsConfig = React.useMemo<
    DocListPageConfig<SabcrmLeaveApplicationRow>
  >(
    () => ({
      title: 'Leave',
      description:
        'Leave applications across the roster — dates, balances and the approval trail.',
      icon: CalendarOff,
      entity: { singular: 'application', plural: 'applications' },
      columns: APPLICATION_COLUMNS,
      statuses: LEAVE_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmLeaveApplicationsPage(
          toLeaveApplicationFilters(filters),
        );
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      csvFileName: 'leave-applications.csv',
      rowHref: (row) => leaveApplicationOpenHref(row.id),
      rowLabel: (row) =>
        `leave application by ${row.employeeLabel ?? row.employeeId ?? 'unknown'}`,
      partyFilter: {
        placeholder: 'Any employee',
        search: async (q) => {
          const res = await searchSabcrmLeaveEmployees(q);
          return res.ok ? res.data : [];
        },
      },
    }),
    [],
  );

  const typesConfig = React.useMemo<DocListPageConfig<SabcrmLeaveTypeRow>>(
    () => ({
      title: 'Leave types',
      description:
        'The leave catalog — paid flags, accrual rules, balance caps and eligibility restrictions.',
      icon: Layers,
      entity: { singular: 'leave type', plural: 'leave types' },
      columns: TYPE_COLUMNS,
      statuses: [],
      fetchPage: async (filters) => {
        const res = await listSabcrmLeaveTypesPage({
          page: filters.page,
          q: filters.q || undefined,
        });
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      csvFileName: 'leave-types.csv',
      rowHref: (row) => leaveTypeOpenHref(row.id),
      rowLabel: (row) => `leave type ${row.name}`,
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Pending approvals"
        icon={Hourglass}
        value={String(kpis.pendingCount)}
        delta={kpis.sampled ? 'Across the latest 100 applications' : 'Awaiting a decision'}
        deltaTone={kpis.pendingCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Approved this month"
        icon={CheckCircle2}
        value={String(kpis.approvedThisMonth)}
        delta="Decisions made"
        deltaTone={kpis.approvedThisMonth > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="On leave today"
        icon={CalendarOff}
        value={String(kpis.onLeaveToday)}
        delta="Approved and in range"
      />
      <KpiCard
        label="Leave types"
        icon={Layers}
        value={String(kpis.typeCount)}
        delta="In the catalog"
      />
    </>
  ) : null;

  return (
    <>
      <Tabs value={tab} onValueChange={switchTab}>
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-6">
          <TabsList aria-label="Leave sections">
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="types">Types</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="applications">
          <DocListPage
            config={applicationsConfig}
            kpis={kpiStrip}
            primaryAction={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => {
                  setAppDetail(null);
                  setAppDrawerOpen(true);
                }}
              >
                New application
              </Button>
            }
            initialRows={initialApplicationRows}
            initialHasMore={initialApplicationsHasMore}
            initialError={initialApplicationsError}
            refreshToken={appsRefreshToken}
          />
        </TabsContent>

        <TabsContent value="types">
          <DocListPage
            config={typesConfig}
            primaryAction={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => {
                  setTypeRow(null);
                  setTypeDrawerOpen(true);
                }}
              >
                New leave type
              </Button>
            }
            initialRows={initialTypeRows}
            initialHasMore={initialTypesHasMore}
            initialError={initialTypesError}
            refreshToken={typesRefreshToken}
          />
        </TabsContent>
      </Tabs>

      <ApplicationDrawer
        open={appDrawerOpen}
        detail={appDetail}
        onClose={closeAppDrawer}
        onSaved={onAppSaved}
      />
      <LeaveTypeDrawer
        open={typeDrawerOpen}
        row={typeRow}
        onClose={closeTypeDrawer}
        onSaved={onTypeSaved}
      />
    </>
  );
}
