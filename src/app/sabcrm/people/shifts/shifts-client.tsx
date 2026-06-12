'use client';

/**
 * SabCRM People — Shifts list client (`/sabcrm/people/shifts`, WI-28).
 *
 * Doc-surface adopter for the shift catalog: KPI strip (total / active /
 * night / default), config-driven list (search + status + department
 * filters, server pagination, CSV export) and a right-side drawer
 * carrying the FULL `CreateShiftInput` field set — name, code, start /
 * end times, break + grace minutes, night-shift flag, Mon–Sun working
 * days, colour, description, default flag, department multi-picker and
 * the active toggle (plus the `status` transition on edit).
 *
 * Departments are picked through the kit `EntityPicker` (gated search
 * action) and render as RESOLVED labels — never raw ObjectIds.
 * `?open=<id>` deep-links the edit drawer (the list rows navigate
 * there, so a drawer is shareable/bookmarkable).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Moon, Plus, Star, Trash2, X } from 'lucide-react';

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
  Checkbox,
  ColorPicker,
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
  type DocListColumn,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';
import {
  SHIFT_DAY_CODES,
  SHIFT_STATUSES,
  SHIFTS_PATH,
  shiftOpenHref,
  toShiftFilters,
} from './shift-config';

import {
  createSabcrmShift,
  deleteSabcrmShift,
  getSabcrmShift,
  listSabcrmShiftsPage,
  searchSabcrmShiftDepartments,
  updateSabcrmShift,
} from '@/app/actions/sabcrm-people-shifts.actions';
import type {
  CrmShiftStatus,
  SabcrmShiftInput,
  SabcrmShiftKpis,
  SabcrmShiftRow,
} from '@/app/actions/sabcrm-people-shifts.actions.types';

/* ─── Columns (full CrmShift coverage per WI-28) ──────────────── */

const COLUMNS: DocListColumn<SabcrmShiftRow>[] = [
  { key: 'name', header: 'Shift', kind: 'text', value: (r) => r.name },
  { key: 'code', header: 'Code', kind: 'text', value: (r) => r.code },
  {
    key: 'hours',
    header: 'Hours',
    kind: 'text',
    value: (r) => `${r.startTime}–${r.endTime}`,
  },
  {
    key: 'breakMinutes',
    header: 'Break',
    kind: 'text',
    value: (r) => (r.breakMinutes != null ? `${r.breakMinutes} min` : null),
  },
  {
    key: 'graceMinutes',
    header: 'Grace',
    kind: 'text',
    value: (r) => (r.graceMinutes != null ? `${r.graceMinutes} min` : null),
  },
  {
    key: 'night',
    header: 'Night',
    kind: 'badge',
    value: (r) => (r.isNightShift ? 'Night shift' : null),
    tone: () => 'info',
  },
  {
    key: 'workingDays',
    header: 'Working days',
    kind: 'text',
    value: (r) => (r.workingDays.length ? r.workingDays.join(' ') : null),
  },
  {
    key: 'departments',
    header: 'Departments',
    kind: 'text',
    value: (r) =>
      r.departments.length
        ? r.departments.map((d) => d.label ?? 'Unresolved').join(', ')
        : null,
  },
  {
    key: 'isDefault',
    header: 'Default',
    kind: 'badge',
    value: (r) => (r.isDefault ? 'Default' : null),
    tone: () => 'success',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Editor drawer (full CreateShiftInput) ───────────────────── */

interface DeptPick {
  id: string;
  label: string | null;
}

interface ShiftFormState {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  graceMinutes: string;
  isNightShift: boolean;
  workingDays: string[];
  color: string;
  description: string;
  isDefault: boolean;
  departments: DeptPick[];
  isActive: boolean;
  status: CrmShiftStatus;
}

const WEEKDAYS: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function emptyForm(): ShiftFormState {
  return {
    name: '',
    code: '',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: '',
    graceMinutes: '',
    isNightShift: false,
    workingDays: [...WEEKDAYS],
    color: '',
    description: '',
    isDefault: false,
    departments: [],
    isActive: true,
    status: 'active',
  };
}

function formFromRow(row: SabcrmShiftRow): ShiftFormState {
  return {
    name: row.name,
    code: row.code ?? '',
    startTime: row.startTime,
    endTime: row.endTime,
    breakMinutes: row.breakMinutes != null ? String(row.breakMinutes) : '',
    graceMinutes: row.graceMinutes != null ? String(row.graceMinutes) : '',
    isNightShift: row.isNightShift,
    workingDays: [...row.workingDays],
    color: row.color ?? '',
    description: row.description ?? '',
    isDefault: row.isDefault,
    departments: row.departments.map((d) => ({ id: d.id, label: d.label })),
    isActive: row.isActive,
    status: row.status,
  };
}

function numOrUndefined(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

const STATUS_OPTIONS: SelectOption[] = SHIFT_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

interface ShiftEditorProps {
  open: boolean;
  /** Null = create mode. */
  row: SabcrmShiftRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function ShiftEditorDrawer({
  open,
  row,
  onClose,
  onSaved,
}: ShiftEditorProps): React.JSX.Element {
  const [form, setForm] = React.useState<ShiftFormState>(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const busy = pending || deleting;
  const mode = row ? 'edit' : 'create';

  React.useEffect(() => {
    if (!open) return;
    setForm(row ? formFromRow(row) : emptyForm());
    setErrors({});
    setFormError(null);
  }, [open, row]);

  const patch = (p: Partial<ShiftFormState>): void =>
    setForm((prev) => ({ ...prev, ...p }));

  const toggleDay = (day: string): void => {
    patch({
      workingDays: form.workingDays.includes(day)
        ? form.workingDays.filter((d) => d !== day)
        : [...form.workingDays, day].sort(
            (a, b) => SHIFT_DAY_CODES.indexOf(a as never) - SHIFT_DAY_CODES.indexOf(b as never),
          ),
    });
  };

  const submit = (): void => {
    setFormError(null);
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    if (!form.startTime) next.startTime = 'Start time is required.';
    if (!form.endTime) next.endTime = 'End time is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: SabcrmShiftInput = {
      name: form.name,
      code: form.code || undefined,
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes: numOrUndefined(form.breakMinutes),
      graceMinutes: numOrUndefined(form.graceMinutes),
      isNightShift: form.isNightShift,
      workingDays: form.workingDays,
      color: form.color || undefined,
      description: form.description || undefined,
      isDefault: form.isDefault,
      departmentIds: form.departments.map((d) => d.id),
      isActive: form.isActive,
      ...(row ? { status: form.status } : {}),
    };

    startTransition(async () => {
      const res = row
        ? await updateSabcrmShift(row.id, input)
        : await createSabcrmShift(input);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        row ? `${res.data.name} updated.` : `${res.data.name} added to the catalog.`,
      );
      onSaved();
    });
  };

  const remove = async (): Promise<void> => {
    if (!row) return;
    setDeleting(true);
    try {
      const res = await deleteSabcrmShift(row.id);
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
      <DrawerContent aria-describedby="shift-form-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>{mode === 'create' ? 'New shift' : `Edit ${row?.name ?? 'shift'}`}</DrawerTitle>
          <DrawerDescription id="shift-form-desc">
            {mode === 'create'
              ? 'Define the working window, applicable days and the departments this shift covers.'
              : 'Every stored field is editable, including the lifecycle status.'}
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
              <Field label="Name" required error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="General shift"
                  disabled={busy}
                />
              </Field>
              <Field label="Code" help="Short identifier (e.g. GEN, NGT).">
                <Input
                  value={form.code}
                  onChange={(e) => patch({ code: e.target.value })}
                  placeholder="GEN"
                  disabled={busy}
                />
              </Field>
              <Field label="Start time" required error={errors.startTime}>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => patch({ startTime: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="End time" required error={errors.endTime}>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => patch({ endTime: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Break (minutes)">
                <Input
                  type="number"
                  min={0}
                  value={form.breakMinutes}
                  onChange={(e) => patch({ breakMinutes: e.target.value })}
                  placeholder="60"
                  disabled={busy}
                />
              </Field>
              <Field label="Grace (minutes)" help="Late punch-ins inside this window aren't flagged.">
                <Input
                  type="number"
                  min={0}
                  value={form.graceMinutes}
                  onChange={(e) => patch({ graceMinutes: e.target.value })}
                  placeholder="10"
                  disabled={busy}
                />
              </Field>

              <div className="fdoc-form-grid__full">
                <Field label="Working days">
                  <div className="flex flex-wrap gap-3" role="group" aria-label="Working days">
                    {SHIFT_DAY_CODES.map((day) => (
                      <Checkbox
                        key={day}
                        label={day}
                        checked={form.workingDays.includes(day)}
                        onChange={() => toggleDay(day)}
                        disabled={busy}
                      />
                    ))}
                  </div>
                </Field>
              </div>

              <Field label="Colour" help="Used on rosters and calendars.">
                <div className="flex items-center gap-2">
                  <ColorPicker
                    value={form.color || '#2b6ef2'}
                    onChange={(c) => patch({ color: c })}
                    disabled={busy}
                    aria-label="Shift colour"
                  />
                  {form.color ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => patch({ color: '' })}
                    >
                      Clear
                    </Button>
                  ) : (
                    <span className="text-xs opacity-70">No colour set</span>
                  )}
                </div>
              </Field>

              <Field label="Flags">
                <div className="flex flex-col gap-2">
                  <Switch
                    label="Night shift"
                    checked={form.isNightShift}
                    onCheckedChange={(v) => patch({ isNightShift: v })}
                    disabled={busy}
                  />
                  <Switch
                    label="Default shift for new employees"
                    checked={form.isDefault}
                    onCheckedChange={(v) => patch({ isDefault: v })}
                    disabled={busy}
                  />
                  <Switch
                    label="Active"
                    checked={form.isActive}
                    onCheckedChange={(v) => patch({ isActive: v })}
                    disabled={busy}
                  />
                </div>
              </Field>

              <div className="fdoc-form-grid__full">
                <Field
                  label="Departments"
                  help="Restrict the shift to specific departments (empty = whole org)."
                >
                  <div className="flex flex-col gap-2">
                    <EntityPicker
                      value={null}
                      onChange={(opt) => {
                        if (!opt) return;
                        if (form.departments.some((d) => d.id === opt.id)) return;
                        patch({
                          departments: [
                            ...form.departments,
                            { id: opt.id, label: opt.label },
                          ],
                        });
                      }}
                      search={async (q) => {
                        const res = await searchSabcrmShiftDepartments(q);
                        return res.ok ? res.data : [];
                      }}
                      placeholder="Add a department…"
                      disabled={busy}
                      aria-label="Add department"
                    />
                    {form.departments.length > 0 ? (
                      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                        {form.departments.map((d) => (
                          <li
                            key={d.id}
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                          >
                            {d.label ?? 'Unresolved department'}
                            <button
                              type="button"
                              aria-label={`Remove ${d.label ?? 'department'}`}
                              disabled={busy}
                              onClick={() =>
                                patch({
                                  departments: form.departments.filter(
                                    (x) => x.id !== d.id,
                                  ),
                                })
                              }
                            >
                              <X size={12} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </Field>
              </div>

              {row ? (
                <Field label="Status" help="Archived shifts disappear from pickers.">
                  <SelectField
                    value={form.status}
                    onChange={(v) => patch({ status: (v || 'active') as CrmShiftStatus })}
                    options={STATUS_OPTIONS}
                    aria-label="Status"
                  />
                </Field>
              ) : null}

              <div className="fdoc-form-grid__full">
                <Field label="Description">
                  <Textarea
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    rows={3}
                    placeholder="What this shift covers…"
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
              {mode === 'create' ? 'Create shift' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>

        <AlertDialog
          open={confirmDelete}
          onOpenChange={(next) => !next && !deleting && setConfirmDelete(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this shift?</AlertDialogTitle>
              <AlertDialogDescription>
                {row?.name} is removed permanently. Attendance rows and rotations
                referencing it keep their stored ids.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary" disabled={deleting}>
                  Keep it
                </Button>
              </AlertDialogCancel>
              <Button variant="danger" loading={deleting} onClick={() => void remove()}>
                Delete shift
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── List client ─────────────────────────────────────────────── */

export interface ShiftsClientProps {
  initialRows: SabcrmShiftRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmShiftKpis | null;
  /** `?open=<id>` deep link — opens the edit drawer. */
  initialOpenId: string | null;
}

export function ShiftsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialOpenId,
}: ShiftsClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmShiftRow | null>(null);

  // Deep link / row navigation: `?open=<id>` → load + open the drawer.
  React.useEffect(() => {
    if (!initialOpenId) return;
    let stale = false;
    void (async () => {
      const res = await getSabcrmShift(initialOpenId);
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
    if (initialOpenId) router.replace(SHIFTS_PATH, { scroll: false });
  }, [initialOpenId, router]);

  const onSaved = React.useCallback(() => {
    setRefreshToken((t) => t + 1);
    closeEditor();
    router.refresh();
  }, [closeEditor, router]);

  const config = React.useMemo<DocListPageConfig<SabcrmShiftRow>>(
    () => ({
      title: 'Shifts',
      description:
        'The shift catalog — working windows, breaks, night flags and the departments they cover.',
      icon: Clock,
      entity: { singular: 'shift', plural: 'shifts' },
      columns: COLUMNS,
      statuses: SHIFT_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmShiftsPage(toShiftFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      csvFileName: 'shifts.csv',
      rowHref: (row) => shiftOpenHref(row.id),
      rowLabel: (row) => `shift ${row.name}`,
      partyFilter: {
        placeholder: 'Any department',
        search: async (q) => {
          const res = await searchSabcrmShiftDepartments(q);
          return res.ok ? res.data : [];
        },
      },
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Shifts"
        icon={Clock}
        value={String(kpis.total)}
        delta={kpis.sampled ? 'Across the latest 100 shifts' : 'In the catalog'}
      />
      <KpiCard
        label="Active"
        icon={CheckCircle2}
        value={String(kpis.active)}
        delta="Available in pickers"
        deltaTone={kpis.active > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Night shifts"
        icon={Moon}
        value={String(kpis.nightShifts)}
        delta="Cross-midnight windows"
      />
      <KpiCard
        label="Default shift"
        icon={Star}
        value={kpis.defaultShiftName ?? '—'}
        delta="Assigned to new joiners"
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
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            New shift
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />
      <ShiftEditorDrawer
        open={editorOpen}
        row={editing}
        onClose={closeEditor}
        onSaved={onSaved}
      />
    </>
  );
}
