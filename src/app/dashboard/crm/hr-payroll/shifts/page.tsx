'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCheckbox,
  ZoruColorPicker,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Archive,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  ListChecks,
  LoaderCircle,
  Plus,
  Trash2,
  UserX,
  XCircle,
} from 'lucide-react';

/**
 * Shifts — settings-style master-data page.
 *
 * Adds KPI strip (total / active / archived / unassigned), bulk archive,
 * bulk delete with confirm, and CSV export. Keeps the inline CRUD dialog.
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  deleteShift,
  getShifts,
  saveShift,
} from '@/app/actions/crm-shifts.actions';
import type { CrmShiftDoc, CrmShiftStatus } from '@/lib/rust-client/crm-shifts';

const BASE = '/dashboard/crm/hr-payroll/shifts';

const WEEKDAYS: Array<{ value: string; label: string }> = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const STATUS_OPTIONS: Array<{ value: CrmShiftStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmShiftStatus, StatusTone> = {
  active: 'green',
  archived: 'neutral',
};

const saveInitial: { message?: string; error?: string; id?: string } = {};

interface ShiftKpi {
  total: number;
  active: number;
  archived: number;
  unassigned: number;
}

function computeKpi(shifts: CrmShiftDoc[]): ShiftKpi {
  const total = shifts.length;
  const active = shifts.filter((s) => (s.status ?? 'active') === 'active').length;
  const archived = shifts.filter((s) => s.status === 'archived').length;
  // "unassigned" = no departmentIds + not default (rough heuristic)
  const unassigned = shifts.filter(
    (s) => (!s.departmentIds || s.departmentIds.length === 0) && !s.isDefault,
  ).length;
  return { total, active, archived, unassigned };
}

interface KpiPillProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

function KpiPill({ icon, label, value }: KpiPillProps) {
  return (
    <ZoruCard>
      <ZoruCardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink-muted">
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            {label}
          </p>
          <p className="text-[18px] font-semibold leading-tight text-zoru-ink">
            {value}
          </p>
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      {isEditing ? 'Save changes' : 'Create shift'}
    </ZoruButton>
  );
}

function ShiftDialog({
  open,
  onOpenChange,
  onSaved,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initial: CrmShiftDoc | null;
}) {
  const isEditing = !!initial;
  const [state, formAction] = useActionState(saveShift, saveInitial);
  const { toast } = useZoruToast();

  const [color, setColor] = React.useState<string>(initial?.color ?? '#EAB308');
  const [isNight, setIsNight] = React.useState<boolean>(!!initial?.isNightShift);
  const [isDefault, setIsDefault] = React.useState<boolean>(!!initial?.isDefault);
  const [days, setDays] = React.useState<string[]>(
    initial?.workingDays ?? [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
    ],
  );
  const [status, setStatus] = React.useState<CrmShiftStatus>(
    (initial?.status as CrmShiftStatus) ?? 'active',
  );

  React.useEffect(() => {
    if (!open) return;
    setColor(initial?.color ?? '#EAB308');
    setIsNight(!!initial?.isNightShift);
    setIsDefault(!!initial?.isDefault);
    setDays(
      initial?.workingDays ?? [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
      ],
    );
    setStatus((initial?.status as CrmShiftStatus) ?? 'active');
  }, [open, initial]);

  React.useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      onSaved();
      onOpenChange(false);
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const toggleDay = (value: string, on: boolean) => {
    setDays((prev) =>
      on
        ? Array.from(new Set([...prev, value]))
        : prev.filter((d) => d !== value),
    );
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-[560px]">
        <form action={formAction} className="flex flex-col gap-4">
          {isEditing ? (
            <input type="hidden" name="shiftId" value={initial!._id} />
          ) : null}
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="isNightShift" value={isNight ? 'true' : 'false'} />
          <input type="hidden" name="isDefault" value={isDefault ? 'true' : 'false'} />
          {days.map((d) => (
            <input key={d} type="hidden" name="workingDays" value={d} />
          ))}
          {isEditing ? (
            <input type="hidden" name="status" value={status} />
          ) : null}

          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {isEditing ? 'Edit shift' : 'New shift'}
            </ZoruDialogTitle>
          </ZoruDialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <ZoruLabel htmlFor="name">Name *</ZoruLabel>
              <ZoruInput
                id="name"
                name="name"
                required
                placeholder="Morning Shift"
                defaultValue={initial?.name ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="code">Code</ZoruLabel>
              <ZoruInput
                id="code"
                name="code"
                placeholder="MORN"
                defaultValue={initial?.code ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel>Color</ZoruLabel>
              <ZoruColorPicker value={color} onChange={setColor} />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="startTime">Start time *</ZoruLabel>
              <ZoruInput
                id="startTime"
                name="startTime"
                type="time"
                required
                defaultValue={initial?.startTime ?? '09:00'}
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="endTime">End time *</ZoruLabel>
              <ZoruInput
                id="endTime"
                name="endTime"
                type="time"
                required
                defaultValue={initial?.endTime ?? '18:00'}
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="breakMinutes">Break (minutes)</ZoruLabel>
              <ZoruInput
                id="breakMinutes"
                name="breakMinutes"
                type="number"
                min="0"
                step="1"
                defaultValue={initial?.breakMinutes ?? 60}
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="graceMinutes">Grace (minutes)</ZoruLabel>
              <ZoruInput
                id="graceMinutes"
                name="graceMinutes"
                type="number"
                min="0"
                step="1"
                defaultValue={initial?.graceMinutes ?? 15}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <ZoruLabel>Working days</ZoruLabel>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const checked = days.includes(d.value);
                return (
                  <label
                    key={d.value}
                    className="flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-bg px-2.5 py-1.5 text-[12.5px] text-zoru-ink"
                  >
                    <ZoruCheckbox
                      checked={checked}
                      onCheckedChange={(v) => toggleDay(d.value, Boolean(v))}
                    />
                    <span>{d.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="departmentIds">
              Department IDs (comma-separated)
            </ZoruLabel>
            <ZoruInput
              id="departmentIds"
              name="departmentIds"
              placeholder="Optional — leave blank for all departments"
              defaultValue={(initial?.departmentIds ?? []).join(', ')}
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="description">Description</ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              rows={2}
              defaultValue={initial?.description ?? ''}
              placeholder="Optional notes about this shift."
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
              <ZoruCheckbox
                checked={isNight}
                onCheckedChange={(v) => setIsNight(Boolean(v))}
              />
              Night shift (crosses midnight)
            </label>
            <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
              <ZoruCheckbox
                checked={isDefault}
                onCheckedChange={(v) => setIsDefault(Boolean(v))}
              />
              Default shift
            </label>
            {isEditing ? (
              <div className="ml-auto flex items-center gap-2">
                <ZoruLabel htmlFor="status-trigger" className="text-[12.5px]">
                  Status
                </ZoruLabel>
                <ZoruSelect
                  value={status}
                  onValueChange={(v) => setStatus(v as CrmShiftStatus)}
                >
                  <ZoruSelectTrigger id="status-trigger" className="h-9 w-[140px]">
                    <ZoruSelectValue placeholder="Status" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="active">Active</ZoruSelectItem>
                    <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            ) : null}
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton isEditing={isEditing} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

function dayBadges(days: string[] | undefined): React.ReactNode {
  const list = days ?? [];
  if (list.length === 0) {
    return <span className="text-[12.5px] text-zoru-ink-muted">—</span>;
  }
  if (list.length === 7) {
    return <ZoruBadge variant="info">All days</ZoruBadge>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((d) => (
        <ZoruBadge key={d} variant="info">
          {d.slice(0, 3)}
        </ZoruBadge>
      ))}
    </div>
  );
}

export default function ShiftsListPage() {
  const [shifts, setShifts] = React.useState<CrmShiftDoc[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CrmShiftStatus | 'all'>(
    'all',
  );
  const [editing, setEditing] = React.useState<CrmShiftDoc | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<CrmShiftDoc | null>(null);
  const [deletePending, startDeleteTransition] = React.useTransition();

  // Bulk
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);
  const [bulkAction, setBulkAction] = React.useState<'archive' | 'delete' | null>(
    null,
  );
  const [bulkPending, startBulkTransition] = React.useTransition();

  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getShifts({
        q: search.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 200,
      });
      setShifts(res.items ?? []);
    } catch {
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  React.useEffect(() => {
    setSelected(new Set());
  }, [shifts]);

  const kpi = React.useMemo(() => computeKpi(shifts), [shifts]);

  /* ── Selection ── */
  const headChecked =
    shifts.length > 0 && shifts.every((s) => selected.has(s._id));

  const toggleAll = (all: boolean) =>
    setSelected(all ? new Set(shifts.map((s) => s._id)) : new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleOpenDialog = (s: CrmShiftDoc | null) => {
    setEditing(s);
    setDialogOpen(true);
  };

  /* ── Single delete ── */
  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    startDeleteTransition(async () => {
      const result = await deleteShift(id);
      if (result.success) {
        toast({ title: 'Shift deleted' });
        setPendingDelete(null);
        await refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Could not delete shift.',
          variant: 'destructive',
        });
      }
    });
  };

  /* ── Bulk actions ── */
  const openBulkArchive = () => {
    setBulkAction('archive');
    setBulkConfirmOpen(true);
  };

  const openBulkDelete = () => {
    setBulkAction('delete');
    setBulkConfirmOpen(true);
  };

  const runBulkAction = () => {
    if (!bulkAction || selected.size === 0) return;
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    startBulkTransition(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        // archive = update status to 'archived'; delete = hard delete
        let res: { success: boolean; error?: string };
        if (bulkAction === 'archive') {
          // We use saveShift via a synthetic FormData to flip status
          const fd = new FormData();
          const shift = shifts.find((s) => s._id === id);
          if (!shift) { failed += 1; continue; }
          fd.set('shiftId', id);
          fd.set('name', shift.name);
          fd.set('startTime', shift.startTime ?? '09:00');
          fd.set('endTime', shift.endTime ?? '18:00');
          fd.set('status', 'archived');
          const outcome = await saveShift(undefined, fd);
          res = { success: !outcome.error, error: outcome.error };
        } else {
          res = await deleteShift(id);
        }
        if (res.success) ok += 1;
        else failed += 1;
      }
      const verb = bulkAction === 'archive' ? 'archived' : 'deleted';
      toast({
        title:
          failed === 0
            ? `${ok} shift${ok === 1 ? '' : 's'} ${verb}`
            : `${ok} ${verb} · ${failed} failed`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      setSelected(new Set());
      setBulkAction(null);
      await refresh();
    });
  };

  /* ── Export CSV ── */
  const handleExportCsv = () => {
    const headers = [
      'Name',
      'Code',
      'Start time',
      'End time',
      'Break (min)',
      'Grace (min)',
      'Days',
      'Status',
    ];
    const exportRows = shifts.map((s) => ({
      Name: s.name,
      Code: s.code ?? '',
      'Start time': s.startTime ?? '',
      'End time': s.endTime ?? '',
      'Break (min)': s.breakMinutes ?? 0,
      'Grace (min)': s.graceMinutes ?? 0,
      Days: (s.workingDays ?? []).join(', '),
      Status: s.status ?? 'active',
    }));
    downloadCsv(`shifts-${dateStamp()}.csv`, headers, exportRows);
  };

  return (
    <>
      <ShiftDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={refresh}
        initial={editing}
      />

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiPill icon={<Clock className="h-4 w-4" />} label="Total shifts" value={kpi.total} />
        <KpiPill
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Active"
          value={kpi.active}
        />
        <KpiPill
          icon={<XCircle className="h-4 w-4" />}
          label="Archived"
          value={kpi.archived}
        />
        <KpiPill
          icon={<UserX className="h-4 w-4" />}
          label="No dept assigned"
          value={kpi.unassigned}
        />
      </div>

      <EntityListShell
        title="Shifts"
        subtitle="Master shift definitions used across attendance, payroll and rotations."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </ZoruButton>
            <ZoruButton onClick={() => handleOpenDialog(null)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New shift
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search shifts…',
        }}
        filters={
          <ZoruSelect
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as CrmShiftStatus | 'all')}
          >
            <ZoruSelectTrigger className="h-9 w-[180px]">
              <ZoruSelectValue placeholder="Status" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {STATUS_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <ListChecks className="h-4 w-4 text-zoru-primary" />
                {selected.size} selected
              </div>
              <div className="flex items-center gap-2">
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={openBulkArchive}
                  disabled={bulkPending}
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={openBulkDelete}
                  disabled={bulkPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set())}
                  aria-label="Clear selection"
                >
                  {/* X from lucide — already imported as part of shifts page */ }
                  ×
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && shifts.length === 0}
      >
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-8">
                  <ZoruCheckbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Code</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Window</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Break / Grace</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Days</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={8} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : shifts.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-zoru-ink-muted"
                  >
                    No shifts match this filter.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                shifts.map((s) => {
                  const status = (s.status ?? 'active') as CrmShiftStatus;
                  const tone = STATUS_TONE[status] ?? 'neutral';
                  const checked = selected.has(s._id);
                  return (
                    <ZoruTableRow key={s._id} className="border-zoru-line">
                      <ZoruTableCell>
                        <ZoruCheckbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(s._id)}
                          aria-label={`Select ${s.name}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="inline-block h-4 w-4 rounded-[4px] border border-zoru-line"
                            style={{ backgroundColor: s.color || '#EAB308' }}
                          />
                          <EntityRowLink
                            href={`${BASE}/${s._id}`}
                            label={s.name}
                          />
                          {s.isDefault ? (
                            <ZoruBadge variant="info">default</ZoruBadge>
                          ) : null}
                          {s.isNightShift ? (
                            <ZoruBadge variant="secondary">night</ZoruBadge>
                          ) : null}
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                        {s.code || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {s.startTime} – {s.endTime}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {s.breakMinutes ?? 0}m break · {s.graceMinutes ?? 0}m grace
                      </ZoruTableCell>
                      <ZoruTableCell>{dayBadges(s.workingDays)}</ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill label={status} tone={tone} />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(s)}
                          aria-label="Edit shift"
                        >
                          <Edit className="h-4 w-4" />
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete(s)}
                          aria-label="Delete shift"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </ZoruButton>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </EntityListShell>

      {/* Single delete confirm */}
      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete shift?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Deleting &ldquo;{pendingDelete?.name}&rdquo; will remove it from the
              shift master list. Employees currently assigned to this shift will
              need to be re-mapped.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
              {deletePending ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk confirm */}
      <ZoruAlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              {bulkAction === 'archive'
                ? `Archive ${selected.size} shift${selected.size === 1 ? '' : 's'}?`
                : `Delete ${selected.size} shift${selected.size === 1 ? '' : 's'}?`}
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {bulkAction === 'archive'
                ? 'Archived shifts remain visible but cannot be assigned to new employees.'
                : 'This permanently removes the selected shifts. Employees assigned to them will need to be re-mapped.'}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={runBulkAction} disabled={bulkPending}>
              {bulkPending
                ? 'Saving…'
                : bulkAction === 'archive'
                  ? 'Archive all'
                  : 'Delete all'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
