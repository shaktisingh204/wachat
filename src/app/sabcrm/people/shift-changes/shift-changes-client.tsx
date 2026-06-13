'use client';

/**
 * SabCRM People — Shift change requests list client
 * (`/sabcrm/people/shift-changes`, WI-30).
 *
 * Doc-surface adopter for the shift-change approval queue: KPI strip
 * (pending / approved this month / rejected), config-driven list
 * (search + status + employee + effective-date filters, server
 * pagination, CSV export) and a right-side request drawer:
 *
 *   - create / pending-edit mode carries the FULL create field set —
 *     employee (picker, name cached onto the document), current +
 *     requested shifts (pickers, names cached), effective date and
 *     reason;
 *   - the drawer header shows the `StatusFlow` rail
 *     (pending → approved; rejected / cancelled render off-path) and a
 *     `ConvertMenu` with the decision actions — Approve / Reject (with
 *     response notes, via `approveSabcrmShiftChange`), Cancel request
 *     and Delete;
 *   - decided requests render read-only with the approver / decided-at
 *     / response-notes stamps.
 *
 * Employees and shifts are picked through the kit `EntityPicker`
 * (gated search actions) and render as RESOLVED labels — never raw
 * ObjectIds. `?open=<id>` deep-links the drawer.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Hourglass,
  Plus,
  Shuffle,
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
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

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
  SHIFT_CHANGE_FLOW,
  SHIFT_CHANGE_STATUSES,
  SHIFT_CHANGES_PATH,
  shiftChangeOpenHref,
  toShiftChangeFilters,
} from './shift-change-config';

import {
  approveSabcrmShiftChange,
  cancelSabcrmShiftChange,
  createSabcrmShiftChange,
  deleteSabcrmShiftChange,
  getSabcrmShiftChange,
  listSabcrmShiftChangesPage,
  searchSabcrmShiftChangeEmployees,
  searchSabcrmShiftChangeShifts,
  updateSabcrmShiftChange,
} from '@/app/actions/sabcrm-people-shift-changes.actions';
import type {
  SabcrmShiftChangeDecision,
  SabcrmShiftChangeInput,
  SabcrmShiftChangeKpis,
  SabcrmShiftChangeRow,
} from '@/app/actions/sabcrm-people-shift-changes.actions.types';

/* ─── Columns (full CrmShiftChangeRequest coverage per WI-30) ─── */

const COLUMNS: DocListColumn<SabcrmShiftChangeRow>[] = [
  {
    key: 'employee',
    header: 'Employee',
    kind: 'party',
    value: (r) => r.employeeName,
  },
  {
    key: 'currentShift',
    header: 'Current shift',
    kind: 'text',
    value: (r) => r.currentShiftName ?? 'Unresolved shift',
  },
  {
    key: 'requestedShift',
    header: 'Requested shift',
    kind: 'text',
    value: (r) => r.requestedShiftName ?? 'Unresolved shift',
  },
  {
    key: 'effectiveDate',
    header: 'Effective',
    kind: 'date',
    value: (r) => r.effectiveDate,
  },
  {
    key: 'reason',
    header: 'Reason',
    kind: 'text',
    value: (r) => r.reason,
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
  {
    key: 'approver',
    header: 'Approver',
    kind: 'text',
    value: (r) => r.approverLabel,
  },
  {
    key: 'approvedAt',
    header: 'Decided',
    kind: 'date',
    value: (r) => r.approvedAt ?? undefined,
  },
];

/* ─── Request drawer (create / pending-edit / decided detail) ─── */

interface Picked {
  id: string;
  label: string | null;
}

interface RequestFormState {
  employee: Picked | null;
  currentShift: Picked | null;
  requestedShift: Picked | null;
  effectiveDate: string;
  reason: string;
}

function emptyForm(): RequestFormState {
  return {
    employee: null,
    currentShift: null,
    requestedShift: null,
    effectiveDate: '',
    reason: '',
  };
}

function formFromRow(row: SabcrmShiftChangeRow): RequestFormState {
  return {
    employee: { id: row.employeeId, label: row.employeeName },
    currentShift: { id: row.currentShiftId, label: row.currentShiftName },
    requestedShift: { id: row.requestedShiftId, label: row.requestedShiftName },
    effectiveDate: row.effectiveDate.slice(0, 10),
    reason: row.reason ?? '',
  };
}

/** Read-only stat row inside the decided-request view. */
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

interface RequestDrawerProps {
  open: boolean;
  /** Null = create mode. */
  row: SabcrmShiftChangeRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function ShiftChangeDrawer({
  open,
  row,
  onClose,
  onSaved,
}: RequestDrawerProps): React.JSX.Element {
  const [form, setForm] = React.useState<RequestFormState>(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const [decision, setDecision] =
    React.useState<SabcrmShiftChangeDecision | null>(null);
  const [responseNotes, setResponseNotes] = React.useState('');
  const [deciding, setDeciding] = React.useState(false);

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  const busy = pending || deleting || deciding || cancelling;
  const editable = !row || row.status === 'pending';
  const mode = !row ? 'create' : editable ? 'edit' : 'view';

  React.useEffect(() => {
    if (!open) return;
    setForm(row ? formFromRow(row) : emptyForm());
    setErrors({});
    setFormError(null);
    setDecision(null);
    setResponseNotes('');
  }, [open, row]);

  const patch = (p: Partial<RequestFormState>): void =>
    setForm((prev) => ({ ...prev, ...p }));

  const submit = (): void => {
    setFormError(null);
    const next: Record<string, string> = {};
    if (!form.employee) next.employee = 'Pick an employee.';
    if (!form.currentShift) next.currentShift = 'Pick the current shift.';
    if (!form.requestedShift) next.requestedShift = 'Pick the requested shift.';
    if (
      form.currentShift &&
      form.requestedShift &&
      form.currentShift.id === form.requestedShift.id
    ) {
      next.requestedShift =
        'The requested shift must differ from the current shift.';
    }
    if (!form.effectiveDate) next.effectiveDate = 'Effective date is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: SabcrmShiftChangeInput = {
      employeeId: form.employee?.id ?? '',
      employeeName: form.employee?.label ?? undefined,
      currentShiftId: form.currentShift?.id ?? '',
      currentShiftName: form.currentShift?.label ?? undefined,
      requestedShiftId: form.requestedShift?.id ?? '',
      requestedShiftName: form.requestedShift?.label ?? undefined,
      effectiveDate: form.effectiveDate,
      reason: form.reason || undefined,
    };

    startTransition(async () => {
      const res = row
        ? await updateSabcrmShiftChange(row.id, input)
        : await createSabcrmShiftChange(input);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(row ? 'Request updated.' : 'Shift change requested.');
      onSaved();
    });
  };

  const decide = async (): Promise<void> => {
    if (!row || !decision) return;
    setDeciding(true);
    try {
      const res = await approveSabcrmShiftChange(
        row.id,
        decision,
        responseNotes || undefined,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        decision === 'approved' ? 'Request approved.' : 'Request rejected.',
      );
      setDecision(null);
      onSaved();
    } finally {
      setDeciding(false);
    }
  };

  const cancelRequest = async (): Promise<void> => {
    if (!row) return;
    setCancelling(true);
    try {
      const res = await cancelSabcrmShiftChange(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Request cancelled.');
      onSaved();
    } finally {
      setCancelling(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!row) return;
    setDeleting(true);
    try {
      const res = await deleteSabcrmShiftChange(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Request deleted.');
      setConfirmDelete(false);
      onSaved();
    } finally {
      setDeleting(false);
    }
  };

  const menuItems: ConvertMenuItem[] = row
    ? [
        {
          key: 'approve',
          label: 'Approve…',
          icon: CheckCircle2,
          description: 'Move the employee to the requested shift',
          disabled: row.status !== 'pending' || busy,
          onSelect: () => {
            setResponseNotes('');
            setDecision('approved');
          },
        },
        {
          key: 'reject',
          label: 'Reject…',
          icon: XCircle,
          description: 'Decline with response notes',
          danger: true,
          disabled: row.status !== 'pending' || busy,
          onSelect: () => {
            setResponseNotes('');
            setDecision('rejected');
          },
        },
        {
          key: 'cancel',
          label: 'Cancel request',
          icon: X,
          description: 'Withdraw on behalf of the applicant',
          disabled: row.status !== 'pending' || busy,
          group: true,
          onSelect: () => void cancelRequest(),
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

  return (
    <Drawer open={open} onOpenChange={(next) => !next && !busy && onClose()} side="right">
      <DrawerContent
        aria-describedby="shift-change-form-desc"
        className="fdoc-form-drawer"
      >
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create'
              ? 'New shift change request'
              : `Request — ${row?.employeeName ?? 'employee'}`}
          </DrawerTitle>
          <DrawerDescription id="shift-change-form-desc">
            {mode === 'create'
              ? 'Ask to move an employee from their current shift to another one.'
              : mode === 'edit'
                ? 'Pending requests stay editable; decide them from the actions menu.'
                : 'This request has been decided and is read-only.'}
          </DrawerDescription>
        </DrawerHeader>

        {row ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3">
            <StatusFlow
              flow={SHIFT_CHANGE_FLOW}
              statuses={SHIFT_CHANGE_STATUSES}
              current={row.status}
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
                  <Field label="Employee" required error={errors.employee}>
                    <EntityPicker
                      value={form.employee?.id ?? null}
                      valueLabel={form.employee?.label ?? null}
                      onChange={(opt) =>
                        patch({
                          employee: opt ? { id: opt.id, label: opt.label } : null,
                        })
                      }
                      search={async (q) => {
                        const res = await searchSabcrmShiftChangeEmployees(q);
                        return res.ok ? res.data : [];
                      }}
                      placeholder="Search the roster…"
                      disabled={busy}
                      invalid={Boolean(errors.employee)}
                      aria-label="Employee"
                    />
                  </Field>
                </div>

                <Field label="Current shift" required error={errors.currentShift}>
                  <EntityPicker
                    value={form.currentShift?.id ?? null}
                    valueLabel={form.currentShift?.label ?? null}
                    onChange={(opt) =>
                      patch({
                        currentShift: opt
                          ? { id: opt.id, label: opt.label }
                          : null,
                      })
                    }
                    search={async (q) => {
                      const res = await searchSabcrmShiftChangeShifts(q);
                      return res.ok ? res.data : [];
                    }}
                    placeholder="Pick a shift…"
                    disabled={busy}
                    invalid={Boolean(errors.currentShift)}
                    aria-label="Current shift"
                  />
                </Field>
                <Field
                  label="Requested shift"
                  required
                  error={errors.requestedShift}
                >
                  <EntityPicker
                    value={form.requestedShift?.id ?? null}
                    valueLabel={form.requestedShift?.label ?? null}
                    onChange={(opt) =>
                      patch({
                        requestedShift: opt
                          ? { id: opt.id, label: opt.label }
                          : null,
                      })
                    }
                    search={async (q) => {
                      const res = await searchSabcrmShiftChangeShifts(q);
                      return res.ok ? res.data : [];
                    }}
                    placeholder="Pick a shift…"
                    disabled={busy}
                    invalid={Boolean(errors.requestedShift)}
                    aria-label="Requested shift"
                  />
                </Field>

                <Field
                  label="Effective date"
                  required
                  error={errors.effectiveDate}
                  help="The first day on the requested shift."
                >
                  <Input
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) => patch({ effectiveDate: e.target.value })}
                    disabled={busy}
                  />
                </Field>

                <div className="fdoc-form-grid__full">
                  <Field label="Reason">
                    <Textarea
                      value={form.reason}
                      onChange={(e) => patch({ reason: e.target.value })}
                      rows={3}
                      placeholder="Why the change is needed…"
                      disabled={busy}
                    />
                  </Field>
                </div>
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
              <Button
                type="button"
                variant="ghost"
                iconLeft={X}
                disabled={busy}
                onClick={onClose}
              >
                Close
              </Button>
              <Button type="submit" variant="primary" loading={pending} disabled={busy && !pending}>
                {mode === 'create' ? 'Submit request' : 'Save changes'}
              </Button>
            </DrawerFooter>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <dl className="m-0 divide-y divide-[var(--u20-border,rgba(0,0,0,0.08))]">
                <DetailRow label="Employee">
                  {row?.employeeName ?? 'Unresolved employee'}
                </DetailRow>
                <DetailRow label="Current shift">
                  {row?.currentShiftName ?? 'Unresolved shift'}
                </DetailRow>
                <DetailRow label="Requested shift">
                  {row?.requestedShiftName ?? 'Unresolved shift'}
                </DetailRow>
                <DetailRow label="Effective date">
                  {formatDocDate(row?.effectiveDate)}
                </DetailRow>
                <DetailRow label="Reason">{row?.reason ?? '—'}</DetailRow>
                <DetailRow label="Decision">
                  {row ? (
                    <Badge
                      tone={
                        SHIFT_CHANGE_STATUSES.find(
                          (s) => s.value === row.status,
                        )?.tone ?? 'neutral'
                      }
                      dot
                    >
                      {SHIFT_CHANGE_STATUSES.find((s) => s.value === row.status)
                        ?.label ?? row.status}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="Approver">
                  {row?.approverLabel ?? '—'}
                </DetailRow>
                <DetailRow label="Decided at">
                  {row?.approvedAt ? formatDocDate(row.approvedAt) : '—'}
                </DetailRow>
                <DetailRow label="Response notes">
                  {row?.responseNotes ?? '—'}
                </DetailRow>
                <DetailRow label="Requested on">
                  {row?.createdAt ? formatDocDate(row.createdAt) : '—'}
                </DetailRow>
              </dl>
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

        {/* Decision dialog (approve / reject + response notes). */}
        <AlertDialog
          open={decision !== null}
          onOpenChange={(next) => !next && !deciding && setDecision(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {decision === 'approved'
                  ? 'Approve this request?'
                  : 'Reject this request?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {decision === 'approved'
                  ? `${row?.employeeName ?? 'The employee'} moves to ${row?.requestedShiftName ?? 'the requested shift'} from ${formatDocDate(row?.effectiveDate)}.`
                  : 'The applicant sees your response notes with the rejection.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-1 pb-2">
              <Field label="Response notes">
                <Textarea
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    decision === 'approved'
                      ? 'Optional note for the applicant…'
                      : 'Why the request is declined…'
                  }
                  disabled={deciding}
                />
              </Field>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary" disabled={deciding}>
                  Back
                </Button>
              </AlertDialogCancel>
              <Button
                variant={decision === 'rejected' ? 'danger' : 'primary'}
                loading={deciding}
                onClick={() => void decide()}
              >
                {decision === 'approved' ? 'Approve' : 'Reject'}
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
              <AlertDialogTitle>Delete this request?</AlertDialogTitle>
              <AlertDialogDescription>
                The request for {row?.employeeName ?? 'this employee'} is
                removed permanently, including its decision trail.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary" disabled={deleting}>
                  Keep it
                </Button>
              </AlertDialogCancel>
              <Button variant="danger" loading={deleting} onClick={() => void remove()}>
                Delete request
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── List client ─────────────────────────────────────────────── */

export interface ShiftChangesClientProps {
  initialRows: SabcrmShiftChangeRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmShiftChangeKpis | null;
  /** `?open=<id>` deep link — opens the request drawer. */
  initialOpenId: string | null;
}

export function ShiftChangesClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialOpenId,
}: ShiftChangesClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [active, setActive] = React.useState<SabcrmShiftChangeRow | null>(null);

  // Deep link / row navigation: `?open=<id>` → load + open the drawer.
  React.useEffect(() => {
    if (!initialOpenId) return;
    let stale = false;
    void (async () => {
      const res = await getSabcrmShiftChange(initialOpenId);
      if (stale) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setActive(res.data);
      setDrawerOpen(true);
    })();
    return () => {
      stale = true;
    };
  }, [initialOpenId]);

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
    setActive(null);
    if (initialOpenId) router.replace(SHIFT_CHANGES_PATH, { scroll: false });
  }, [initialOpenId, router]);

  const onSaved = React.useCallback(() => {
    setRefreshToken((t) => t + 1);
    closeDrawer();
    router.refresh();
  }, [closeDrawer, router]);

  const config = React.useMemo<DocListPageConfig<SabcrmShiftChangeRow>>(
    () => ({
      title: 'Shift changes',
      description:
        'The shift-change approval queue — who wants to move, where to, from when, and the decision trail.',
      icon: Shuffle,
      entity: { singular: 'request', plural: 'requests' },
      columns: COLUMNS,
      statuses: SHIFT_CHANGE_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmShiftChangesPage(
          toShiftChangeFilters(filters),
        );
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      csvFileName: 'shift-change-requests.csv',
      rowHref: (row) => shiftChangeOpenHref(row.id),
      rowLabel: (row) =>
        `shift change request for ${row.employeeName ?? row.employeeId}`,
      partyFilter: {
        placeholder: 'Any employee',
        search: async (q) => {
          const res = await searchSabcrmShiftChangeEmployees(q);
          return res.ok ? res.data : [];
        },
      },
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Pending"
        icon={Hourglass}
        value={String(kpis.pending)}
        delta={kpis.sampled ? 'Across the latest 100 requests' : 'Awaiting a decision'}
        deltaTone={kpis.pending > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Approved this month"
        icon={CheckCircle2}
        value={String(kpis.approvedThisMonth)}
        delta="Decisions made"
        deltaTone={kpis.approvedThisMonth > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Rejected"
        icon={XCircle}
        value={String(kpis.rejected)}
        delta="Declined requests"
      />
    </>
  ) : null;

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => {
              setActive(null);
              setDrawerOpen(true);
            }}
          >
            New request
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />
      <ShiftChangeDrawer
        open={drawerOpen}
        row={active}
        onClose={closeDrawer}
        onSaved={onSaved}
      />
    </>
  );
}
