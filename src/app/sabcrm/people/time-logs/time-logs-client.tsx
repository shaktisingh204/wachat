'use client';

/**
 * SabCRM People — Time logs (timesheet) client
 * (`/sabcrm/people/time-logs`, WI-34).
 *
 * Doc-surface adopter for time tracking:
 *
 *   - KPI strip — tracked h:mm, billable h:mm + amount, running timers,
 *     pending approvals;
 *   - config-driven list — employee (resolved label), work item
 *     (resolved task/project/issue/ticket label), start/end timestamps,
 *     duration h:mm, billable flag, rate, computed amount, status;
 *   - **Start timer** dialog (employee picker + description + optional
 *     project/task links + billing) → a `running` log stamped now;
 *   - full-DTO editor drawer (`?open=<id>` deep link): employee picker,
 *     work-item pickers (project / task / issue / generic entity),
 *     start / end datetime-locals, duration, description, billing and
 *     the status select — plus **Stop timer** for running logs and
 *     Delete;
 *   - bulk actions: Approve / Reject (signed server-side), Stop timers,
 *     Delete.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  CircleDollarSign,
  Hourglass,
  Play,
  Plus,
  Square,
  Timer,
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
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  EntityPicker,
  formatDocMoney,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';
import {
  TIME_LOGS_PATH,
  TIME_LOG_ENTITY_KINDS,
  TIME_LOG_STATUSES,
  formatDateTime,
  formatDurationMinutes,
  isoToLocalInput,
  timeLogOpenHref,
  toTimeLogFilters,
} from './time-logs-config';

import {
  approveSabcrmTimeLogs,
  deleteSabcrmTimeLog,
  exportSabcrmTimeLogRows,
  getSabcrmTimeLog,
  listSabcrmTimeLogsPage,
  rejectSabcrmTimeLogs,
  saveSabcrmTimeLog,
  searchSabcrmTimeLogEmployees,
  searchSabcrmTimeLogWorkItems,
  startSabcrmTimer,
  stopSabcrmTimer,
} from '@/app/actions/sabcrm-people-time-logs.actions';
import type {
  CrmTimeLogEntityKind,
  CrmTimeLogStatus,
  SabcrmStartTimerInput,
  SabcrmTimeLogInput,
  SabcrmTimeLogKpis,
  SabcrmTimeLogListRow,
  SabcrmTimeLogView,
} from '@/app/actions/sabcrm-people-time-logs.actions.types';

/* ─── Columns (full CrmTimeLog coverage per WI-34) ────────────── */

const COLUMNS: DocListColumn<SabcrmTimeLogListRow>[] = [
  {
    key: 'employee',
    header: 'Employee',
    kind: 'party',
    value: (r) => r.employeeLabel,
  },
  {
    key: 'workItem',
    header: 'Work item',
    kind: 'text',
    value: (r) => r.workItemLabel ?? r.description,
  },
  {
    key: 'startedAt',
    header: 'Started',
    kind: 'text',
    value: (r) => formatDateTime(r.startedAt),
  },
  {
    key: 'endedAt',
    header: 'Ended',
    kind: 'text',
    value: (r) => formatDateTime(r.endedAt),
  },
  {
    key: 'duration',
    header: 'Duration',
    kind: 'text',
    align: 'right',
    value: (r) => r.durationLabel,
  },
  {
    key: 'billable',
    header: 'Billable',
    kind: 'badge',
    value: (r) => (r.isBillable ? 'Billable' : null),
    tone: () => 'info',
  },
  {
    key: 'rate',
    header: 'Rate',
    kind: 'text',
    align: 'right',
    value: (r) =>
      r.hourlyRate != null
        ? `${formatDocMoney(r.hourlyRate, r.currency)}/h`
        : null,
  },
  {
    key: 'amount',
    header: 'Amount',
    kind: 'money',
    value: (r) => r.amount,
    currency: (r) => r.currency,
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

const STATUS_OPTIONS: SelectOption[] = TIME_LOG_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

const KIND_OPTIONS: SelectOption[] = [
  { value: '', label: 'None' },
  ...TIME_LOG_ENTITY_KINDS.map((k) => ({ value: k.value, label: k.label })),
];

interface PickerState {
  id: string | null;
  label: string | null;
}

const EMPTY_PICK: PickerState = { id: null, label: null };

function numOrUndefined(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/* ─── Start-timer dialog ──────────────────────────────────────── */

interface StartTimerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: () => void;
}

function StartTimerDialog({
  open,
  onOpenChange,
  onStarted,
}: StartTimerDialogProps): React.JSX.Element {
  const [employee, setEmployee] = React.useState<PickerState>(EMPTY_PICK);
  const [description, setDescription] = React.useState('');
  const [project, setProject] = React.useState<PickerState>(EMPTY_PICK);
  const [task, setTask] = React.useState<PickerState>(EMPTY_PICK);
  const [isBillable, setIsBillable] = React.useState(false);
  const [hourlyRate, setHourlyRate] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setEmployee(EMPTY_PICK);
    setDescription('');
    setProject(EMPTY_PICK);
    setTask(EMPTY_PICK);
    setIsBillable(false);
    setHourlyRate('');
    setError(null);
  }, [open]);

  const submit = (): void => {
    setError(null);
    const input: SabcrmStartTimerInput = {
      userLogId: employee.id ?? undefined,
      description: description || undefined,
      projectId: project.id ?? undefined,
      taskId: task.id ?? undefined,
      isBillable,
      hourlyRate: numOrUndefined(hourlyRate),
    };
    startTransition(async () => {
      const res = await startSabcrmTimer(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Timer started.');
      onOpenChange(false);
      onStarted();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="start-timer-desc">
        <DialogHeader>
          <DialogTitle>Start a timer</DialogTitle>
          <DialogDescription id="start-timer-desc">
            Creates a running time log stamped now — stop it from the list when
            the work is done.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Employee">
              <EntityPicker
                value={employee.id}
                valueLabel={employee.label}
                onChange={(opt) =>
                  setEmployee({ id: opt?.id ?? null, label: opt?.label ?? null })
                }
                search={async (q) => {
                  const res = await searchSabcrmTimeLogEmployees(q);
                  return res.ok ? res.data : [];
                }}
                placeholder="Search employees…"
                disabled={pending}
                aria-label="Employee"
              />
            </Field>
            <Field label="What are you working on?">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sprint 12 — payroll engine review"
                disabled={pending}
                autoFocus
              />
            </Field>
            <Field label="Project">
              <EntityPicker
                value={project.id}
                valueLabel={project.label}
                onChange={(opt) =>
                  setProject({ id: opt?.id ?? null, label: opt?.label ?? null })
                }
                search={async (q) => {
                  const res = await searchSabcrmTimeLogWorkItems('project', q);
                  return res.ok ? res.data : [];
                }}
                placeholder="Search projects…"
                disabled={pending}
                aria-label="Project"
              />
            </Field>
            <Field label="Task">
              <EntityPicker
                value={task.id}
                valueLabel={task.label}
                onChange={(opt) =>
                  setTask({ id: opt?.id ?? null, label: opt?.label ?? null })
                }
                search={async (q) => {
                  const res = await searchSabcrmTimeLogWorkItems('task', q);
                  return res.ok ? res.data : [];
                }}
                placeholder="Search tasks…"
                disabled={pending}
                aria-label="Task"
              />
            </Field>
            <Field label="Billing">
              <div className="flex items-center gap-3">
                <Switch
                  label="Billable"
                  checked={isBillable}
                  onCheckedChange={setIsBillable}
                  disabled={pending}
                />
                {isBillable ? (
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="Hourly rate"
                    disabled={pending}
                    aria-label="Hourly rate"
                  />
                ) : null}
              </div>
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
            <Button type="submit" variant="primary" iconLeft={Play} loading={pending}>
              Start timer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Editor drawer (full DTO) ────────────────────────────────── */

interface LogFormState {
  employee: PickerState;
  project: PickerState;
  task: PickerState;
  issue: PickerState;
  entityKind: CrmTimeLogEntityKind | '';
  entity: PickerState;
  startedAt: string;
  endedAt: string;
  durationMinutes: string;
  description: string;
  isBillable: boolean;
  hourlyRate: string;
  status: CrmTimeLogStatus;
}

function emptyLogForm(): LogFormState {
  return {
    employee: EMPTY_PICK,
    project: EMPTY_PICK,
    task: EMPTY_PICK,
    issue: EMPTY_PICK,
    entityKind: '',
    entity: EMPTY_PICK,
    startedAt: isoToLocalInput(new Date().toISOString()),
    endedAt: '',
    durationMinutes: '',
    description: '',
    isBillable: false,
    hourlyRate: '',
    status: 'stopped',
  };
}

function formFromView(view: SabcrmTimeLogView): LogFormState {
  const { doc } = view;
  return {
    employee: { id: doc.userLogId ?? null, label: view.employeeLabel },
    project: { id: doc.projectId ?? null, label: view.projectLabel },
    task: { id: doc.taskId ?? null, label: view.taskLabel },
    issue: { id: doc.issueId ?? null, label: view.issueLabel },
    entityKind: doc.entityKind ?? '',
    entity: { id: doc.entityId ?? null, label: doc.entityId ?? null },
    startedAt: isoToLocalInput(doc.startedAt),
    endedAt: isoToLocalInput(doc.endedAt),
    durationMinutes:
      doc.durationMinutes != null ? String(doc.durationMinutes) : '',
    description: doc.description ?? '',
    isBillable: Boolean(doc.isBillable),
    hourlyRate: doc.hourlyRate != null ? String(doc.hourlyRate) : '',
    status: doc.status ?? 'stopped',
  };
}

interface LogEditorProps {
  open: boolean;
  /** Null = create mode. */
  view: SabcrmTimeLogView | null;
  onClose: () => void;
  onSaved: () => void;
}

function TimeLogEditorDrawer({
  open,
  view,
  onClose,
  onSaved,
}: LogEditorProps): React.JSX.Element {
  const [form, setForm] = React.useState<LogFormState>(emptyLogForm);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [stopping, setStopping] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const busy = pending || deleting || stopping;
  const mode = view ? 'edit' : 'create';
  const isRunning = view?.doc.status === 'running';

  React.useEffect(() => {
    if (!open) return;
    setForm(view ? formFromView(view) : emptyLogForm());
    setFormError(null);
  }, [open, view]);

  const patch = (p: Partial<LogFormState>): void =>
    setForm((prev) => ({ ...prev, ...p }));

  const submit = (): void => {
    setFormError(null);
    if (!form.startedAt) {
      setFormError('A start time is required.');
      return;
    }
    const input: SabcrmTimeLogInput = {
      userLogId: form.employee.id ?? undefined,
      projectId: form.project.id ?? undefined,
      taskId: form.task.id ?? undefined,
      issueId: form.issue.id ?? undefined,
      entityKind: form.entityKind,
      entityId: form.entity.id ?? undefined,
      startedAt: form.startedAt,
      endedAt: form.endedAt || undefined,
      durationMinutes: form.durationMinutes.trim()
        ? Number(form.durationMinutes)
        : undefined,
      description: form.description || undefined,
      isBillable: form.isBillable,
      hourlyRate: numOrUndefined(form.hourlyRate),
      status: form.status,
    };
    startTransition(async () => {
      const res = await saveSabcrmTimeLog(view?.doc._id ?? null, input);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(mode === 'create' ? 'Time log added.' : 'Time log updated.');
      onSaved();
    });
  };

  const stop = async (): Promise<void> => {
    if (!view) return;
    setStopping(true);
    try {
      const res = await stopSabcrmTimer(view.doc._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Timer stopped at ${formatDurationMinutes(res.data.durationMinutes)}.`,
      );
      onSaved();
    } finally {
      setStopping(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!view) return;
    setDeleting(true);
    try {
      const res = await deleteSabcrmTimeLog(view.doc._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Time log deleted.');
      setConfirmDelete(false);
      onSaved();
    } finally {
      setDeleting(false);
    }
  };

  const workItemPicker = (
    label: string,
    kind: 'project' | CrmTimeLogEntityKind,
    state: PickerState,
    set: (p: PickerState) => void,
  ): React.JSX.Element => (
    <Field label={label}>
      <EntityPicker
        value={state.id}
        valueLabel={state.label}
        onChange={(opt) => set({ id: opt?.id ?? null, label: opt?.label ?? null })}
        search={async (q) => {
          const res = await searchSabcrmTimeLogWorkItems(kind, q);
          return res.ok ? res.data : [];
        }}
        placeholder={`Search ${label.toLowerCase()}s…`}
        disabled={busy}
        aria-label={label}
      />
    </Field>
  );

  return (
    <Drawer open={open} onOpenChange={(next) => !next && !busy && onClose()} side="right">
      <DrawerContent aria-describedby="timelog-form-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>{mode === 'create' ? 'New time log' : 'Edit time log'}</DrawerTitle>
          <DrawerDescription id="timelog-form-desc">
            {mode === 'create'
              ? 'Record tracked time against an employee and the work it covers.'
              : 'Every stored field is editable, including the approval status.'}
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
              <div className="fdoc-form-grid__full">
                <Field label="Employee">
                  <EntityPicker
                    value={form.employee.id}
                    valueLabel={form.employee.label}
                    onChange={(opt) =>
                      patch({
                        employee: { id: opt?.id ?? null, label: opt?.label ?? null },
                      })
                    }
                    search={async (q) => {
                      const res = await searchSabcrmTimeLogEmployees(q);
                      return res.ok ? res.data : [];
                    }}
                    placeholder="Search employees…"
                    disabled={busy}
                    aria-label="Employee"
                  />
                </Field>
              </div>

              {workItemPicker('Project', 'project', form.project, (p) =>
                patch({ project: p }),
              )}
              {workItemPicker('Task', 'task', form.task, (p) =>
                patch({ task: p }),
              )}
              {workItemPicker('Issue', 'issue', form.issue, (p) =>
                patch({ issue: p }),
              )}

              <Field
                label="Other work item"
                help="Generic link when the work isn't a project/task/issue."
              >
                <SelectField
                  value={form.entityKind}
                  onChange={(v) =>
                    patch({
                      entityKind: (v || '') as CrmTimeLogEntityKind | '',
                      entity: EMPTY_PICK,
                    })
                  }
                  options={KIND_OPTIONS}
                  disabled={busy}
                  aria-label="Work item kind"
                />
              </Field>
              {form.entityKind ? (
                <div className="fdoc-form-grid__full">
                  {workItemPicker(
                    'Linked record',
                    form.entityKind,
                    form.entity,
                    (p) => patch({ entity: p }),
                  )}
                </div>
              ) : null}

              <Field label="Started at" required>
                <Input
                  type="datetime-local"
                  value={form.startedAt}
                  onChange={(e) => patch({ startedAt: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Ended at">
                <Input
                  type="datetime-local"
                  value={form.endedAt}
                  onChange={(e) => patch({ endedAt: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field
                label="Duration (minutes)"
                help="Blank = computed from start/end."
              >
                <Input
                  type="number"
                  min={0}
                  value={form.durationMinutes}
                  onChange={(e) => patch({ durationMinutes: e.target.value })}
                  placeholder="Auto"
                  disabled={busy}
                />
              </Field>
              <Field label="Status">
                <SelectField
                  value={form.status}
                  onChange={(v) =>
                    patch({ status: (v || 'stopped') as CrmTimeLogStatus })
                  }
                  options={STATUS_OPTIONS}
                  disabled={busy}
                  aria-label="Status"
                />
              </Field>

              <Field label="Billing">
                <div className="flex flex-col gap-2">
                  <Switch
                    label="Billable"
                    checked={form.isBillable}
                    onCheckedChange={(v) => patch({ isBillable: v })}
                    disabled={busy}
                  />
                </div>
              </Field>
              <Field label="Hourly rate">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.hourlyRate}
                  onChange={(e) => patch({ hourlyRate: e.target.value })}
                  placeholder="0.00"
                  disabled={busy || !form.isBillable}
                />
              </Field>

              <div className="fdoc-form-grid__full">
                <Field label="Description">
                  <Textarea
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    rows={3}
                    placeholder="What was worked on…"
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
            <Button type="button" variant="ghost" iconLeft={X} disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            {isRunning ? (
              <Button
                type="button"
                variant="secondary"
                iconLeft={Square}
                loading={stopping}
                disabled={pending || deleting}
                onClick={() => void stop()}
              >
                Stop timer
              </Button>
            ) : null}
            {view ? (
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
            <Button type="submit" variant="primary" loading={pending} disabled={deleting || stopping}>
              {mode === 'create' ? 'Add time log' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>

        <AlertDialog
          open={confirmDelete}
          onOpenChange={(next) => !next && !deleting && setConfirmDelete(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this time log?</AlertDialogTitle>
              <AlertDialogDescription>
                The tracked time is removed permanently. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary" disabled={deleting}>
                  Keep it
                </Button>
              </AlertDialogCancel>
              <Button variant="danger" loading={deleting} onClick={() => void remove()}>
                Delete time log
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── List client ─────────────────────────────────────────────── */

export interface TimeLogsClientProps {
  initialRows: SabcrmTimeLogListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmTimeLogKpis | null;
  /** `?open=<id>` deep link — opens the edit drawer. */
  initialOpenId: string | null;
  initialFilters?: Partial<DocListFilters>;
}

export function TimeLogsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialOpenId,
  initialFilters,
}: TimeLogsClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [timerOpen, setTimerOpen] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmTimeLogView | null>(null);

  // Deep link / row navigation: `?open=<id>` → load + open the drawer.
  React.useEffect(() => {
    if (!initialOpenId) return;
    let stale = false;
    void (async () => {
      const res = await getSabcrmTimeLog(initialOpenId);
      if (stale) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEditing(res.data);
      setEditorOpen(true);
    })();
    return () => {
      stale = true;
    };
  }, [initialOpenId]);

  const closeEditor = React.useCallback(() => {
    setEditorOpen(false);
    setEditing(null);
    if (initialOpenId) router.replace(TIME_LOGS_PATH, { scroll: false });
  }, [initialOpenId, router]);

  const onMutated = React.useCallback(() => {
    setRefreshToken((t) => t + 1);
    closeEditor();
    router.refresh();
  }, [closeEditor, router]);

  const config = React.useMemo<DocListPageConfig<SabcrmTimeLogListRow>>(
    () => ({
      title: 'Time logs',
      description:
        'The project timesheet — timers, manual entries, billing and the approval queue.',
      icon: Timer,
      entity: { singular: 'time log', plural: 'time logs' },
      columns: COLUMNS,
      statuses: TIME_LOG_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmTimeLogsPage(toTimeLogFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmTimeLogRows(toTimeLogFilters(filters)),
      csvFileName: 'time-logs.csv',
      rowHref: (row) => timeLogOpenHref(row.id),
      rowLabel: (row) =>
        `time log ${row.employeeLabel ?? 'unassigned'} ${row.durationLabel}`,
      partyFilter: {
        placeholder: 'Any employee',
        search: async (q) => {
          const res = await searchSabcrmTimeLogEmployees(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'approve',
          label: 'Approve',
          icon: BadgeCheck,
          run: async (rows) => {
            const res = await approveSabcrmTimeLogs(rows.map((r) => r.id));
            return res.ok ? { ok: true, data: null } : res;
          },
        },
        {
          key: 'reject',
          label: 'Reject',
          icon: XCircle,
          run: async (rows) => {
            const res = await rejectSabcrmTimeLogs(rows.map((r) => r.id));
            return res.ok ? { ok: true, data: null } : res;
          },
        },
        {
          key: 'stop',
          label: 'Stop timers',
          icon: Square,
          run: async (rows) => {
            const running = rows.filter((r) => r.status === 'running');
            if (running.length === 0) {
              return { ok: false, error: 'No running timers selected.' };
            }
            for (const row of running) {
              const res = await stopSabcrmTimer(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected time logs?',
            description:
              'The tracked time is removed permanently. This action cannot be undone.',
            actionLabel: 'Delete time logs',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmTimeLog(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Time tracked"
        icon={Timer}
        value={formatDurationMinutes(kpis.totalMinutes)}
        delta="h:mm across the latest 100 logs"
      />
      <KpiCard
        label="Billable"
        icon={CircleDollarSign}
        value={formatDocMoney(kpis.billableAmount, kpis.currency)}
        delta={`${formatDurationMinutes(kpis.billableMinutes)} billable time`}
        deltaTone={kpis.billableAmount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Running timers"
        icon={Play}
        value={String(kpis.runningCount)}
        delta={kpis.runningCount === 1 ? 'timer live now' : 'timers live now'}
        deltaTone={kpis.runningCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Awaiting approval"
        icon={Hourglass}
        value={String(kpis.pendingApprovalCount)}
        delta="Stopped logs pending review"
        deltaTone={kpis.pendingApprovalCount > 0 ? 'down' : 'neutral'}
      />
    </>
  ) : null;

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <>
            <Button
              variant="secondary"
              iconLeft={Plus}
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              Log time
            </Button>
            <Button
              variant="primary"
              iconLeft={Play}
              onClick={() => setTimerOpen(true)}
            >
              Start timer
            </Button>
          </>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
        initialFilters={initialFilters}
      />
      <StartTimerDialog
        open={timerOpen}
        onOpenChange={setTimerOpen}
        onStarted={() => {
          setRefreshToken((t) => t + 1);
          router.refresh();
        }}
      />
      <TimeLogEditorDrawer
        open={editorOpen}
        view={editing}
        onClose={closeEditor}
        onSaved={onMutated}
      />
    </>
  );
}
