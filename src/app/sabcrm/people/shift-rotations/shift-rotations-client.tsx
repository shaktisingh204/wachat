'use client';

/**
 * SabCRM People — Shift rotations list client
 * (`/sabcrm/people/shift-rotations`, WI-29).
 *
 * Doc-surface adopter for rotation schedules: KPI strip (total /
 * active / paused / completed), config-driven list (search + status +
 * employee filters, server pagination, CSV export) and a right-side
 * drawer carrying the FULL `CreateRotationInput` field set — name,
 * description, the exactly-one-of employee / department / team target
 * (segmented picker), cycle length, start / end dates, the per-day
 * pattern repeater ({dayOffset, shift, isOff} rows validated against
 * `cycleDays`), the active toggle and the lifecycle status on edit.
 *
 * Employees / departments / shifts are picked through the kit
 * `EntityPicker` (gated search actions) and render as RESOLVED labels
 * — never raw ObjectIds. `?open=<id>` deep-links the edit drawer.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Flag,
  PauseCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  SegmentedControl,
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
  ROTATION_STATUSES,
  ROTATION_TARGET_LABELS,
  ROTATIONS_PATH,
  rotationOpenHref,
  toRotationFilters,
} from './shift-rotation-config';

import {
  createSabcrmShiftRotation,
  deleteSabcrmShiftRotation,
  getSabcrmShiftRotation,
  listSabcrmShiftRotationsPage,
  searchSabcrmRotationDepartments,
  searchSabcrmRotationEmployees,
  searchSabcrmRotationShifts,
  updateSabcrmShiftRotation,
} from '@/app/actions/sabcrm-people-shift-rotations.actions';
import type {
  CrmShiftRotationStatus,
  SabcrmRotationInput,
  SabcrmRotationKpis,
  SabcrmRotationRow,
  SabcrmRotationTargetKind,
} from '@/app/actions/sabcrm-people-shift-rotations.actions.types';

/* ─── Columns (full CrmShiftRotation coverage per WI-29) ──────── */

const COLUMNS: DocListColumn<SabcrmRotationRow>[] = [
  { key: 'name', header: 'Rotation', kind: 'text', value: (r) => r.name },
  {
    key: 'target',
    header: 'Applies to',
    kind: 'party',
    value: (r) =>
      r.targetLabel ??
      (r.targetId
        ? `Unresolved ${r.targetKind ?? 'target'}`
        : 'No target'),
    csv: (r) => r.targetLabel ?? r.targetId ?? '',
  },
  {
    key: 'targetKind',
    header: 'Target type',
    kind: 'badge',
    value: (r) => (r.targetKind ? ROTATION_TARGET_LABELS[r.targetKind] : null),
    tone: () => 'neutral',
  },
  {
    key: 'cycleDays',
    header: 'Cycle',
    kind: 'text',
    value: (r) => `${r.cycleDays} day${r.cycleDays === 1 ? '' : 's'}`,
  },
  {
    key: 'pattern',
    header: 'Pattern',
    kind: 'text',
    value: (r) => {
      const off = r.pattern.filter((p) => p.isOff).length;
      return r.pattern.length
        ? `${r.pattern.length} day${r.pattern.length === 1 ? '' : 's'}${off ? ` · ${off} off` : ''}`
        : null;
    },
  },
  {
    key: 'startDate',
    header: 'Starts',
    kind: 'date',
    value: (r) => r.startDate,
  },
  {
    key: 'endDate',
    header: 'Ends',
    kind: 'date',
    value: (r) => r.endDate ?? undefined,
  },
  {
    key: 'isActive',
    header: 'Active',
    kind: 'badge',
    value: (r) => (r.isActive ? 'Active' : null),
    tone: () => 'success',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Editor drawer (full CreateRotationInput) ────────────────── */

interface Picked {
  id: string;
  label: string | null;
}

interface PatternRowDraft {
  rowId: string;
  dayOffset: string;
  shift: Picked | null;
  isOff: boolean;
}

interface RotationFormState {
  name: string;
  description: string;
  targetKind: SabcrmRotationTargetKind;
  employee: Picked | null;
  department: Picked | null;
  teamId: string;
  cycleDays: string;
  startDate: string;
  endDate: string;
  pattern: PatternRowDraft[];
  isActive: boolean;
  status: CrmShiftRotationStatus;
}

let rowSeq = 0;
function nextRowId(): string {
  rowSeq += 1;
  return `rot-row-${rowSeq}`;
}

function emptyForm(): RotationFormState {
  return {
    name: '',
    description: '',
    targetKind: 'employee',
    employee: null,
    department: null,
    teamId: '',
    cycleDays: '7',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    pattern: [{ rowId: nextRowId(), dayOffset: '0', shift: null, isOff: false }],
    isActive: true,
    status: 'active',
  };
}

function formFromRow(row: SabcrmRotationRow): RotationFormState {
  const kind = row.targetKind ?? 'employee';
  const target: Picked | null = row.targetId
    ? { id: row.targetId, label: row.targetLabel }
    : null;
  return {
    name: row.name,
    description: row.description ?? '',
    targetKind: kind,
    employee: kind === 'employee' ? target : null,
    department: kind === 'department' ? target : null,
    teamId: kind === 'team' ? (row.targetId ?? '') : '',
    cycleDays: String(row.cycleDays),
    startDate: row.startDate.slice(0, 10),
    endDate: row.endDate ? row.endDate.slice(0, 10) : '',
    pattern: row.pattern.length
      ? row.pattern.map((p) => ({
          rowId: nextRowId(),
          dayOffset: String(p.dayOffset),
          shift: { id: p.shiftId, label: p.shiftName },
          isOff: p.isOff,
        }))
      : [{ rowId: nextRowId(), dayOffset: '0', shift: null, isOff: false }],
    isActive: row.isActive,
    status: row.status,
  };
}

const STATUS_OPTIONS: SelectOption[] = ROTATION_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

const TARGET_ITEMS = (
  ['employee', 'department', 'team'] as SabcrmRotationTargetKind[]
).map((k) => ({ value: k, label: ROTATION_TARGET_LABELS[k] }));

interface RotationEditorProps {
  open: boolean;
  /** Null = create mode. */
  row: SabcrmRotationRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function RotationEditorDrawer({
  open,
  row,
  onClose,
  onSaved,
}: RotationEditorProps): React.JSX.Element {
  const [form, setForm] = React.useState<RotationFormState>(emptyForm);
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

  const patch = (p: Partial<RotationFormState>): void =>
    setForm((prev) => ({ ...prev, ...p }));

  const patchPatternRow = (
    rowId: string,
    p: Partial<PatternRowDraft>,
  ): void => {
    setForm((prev) => ({
      ...prev,
      pattern: prev.pattern.map((d) =>
        d.rowId === rowId ? { ...d, ...p } : d,
      ),
    }));
  };

  const addPatternRow = (): void => {
    setForm((prev) => {
      const used = new Set(prev.pattern.map((d) => Number(d.dayOffset)));
      let next = 0;
      while (used.has(next)) next += 1;
      return {
        ...prev,
        pattern: [
          ...prev.pattern,
          { rowId: nextRowId(), dayOffset: String(next), shift: null, isOff: false },
        ],
      };
    });
  };

  const removePatternRow = (rowId: string): void => {
    setForm((prev) => ({
      ...prev,
      pattern: prev.pattern.filter((d) => d.rowId !== rowId),
    }));
  };

  const submit = (): void => {
    setFormError(null);
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required.';

    const cycleDays = Number(form.cycleDays);
    if (!Number.isInteger(cycleDays) || cycleDays < 1) {
      next.cycleDays = 'Cycle length must be a whole number of days (≥ 1).';
    }
    if (!form.startDate) next.startDate = 'Start date is required.';
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      next.endDate = 'The end date must be on or after the start date.';
    }

    if (form.targetKind === 'employee' && !form.employee) {
      next.target = 'Pick the employee this rotation applies to.';
    }
    if (form.targetKind === 'department' && !form.department) {
      next.target = 'Pick the department this rotation applies to.';
    }
    if (form.targetKind === 'team' && !form.teamId.trim()) {
      next.target = 'Enter the team identifier this rotation applies to.';
    }

    if (form.pattern.length === 0) {
      next.pattern = 'Add at least one pattern day.';
    } else {
      const offsets: number[] = [];
      for (const day of form.pattern) {
        const off = Number(day.dayOffset);
        if (!Number.isInteger(off) || off < 0) {
          next.pattern = 'Day offsets must be whole numbers (0-based).';
          break;
        }
        if (Number.isInteger(cycleDays) && cycleDays >= 1 && off >= cycleDays) {
          next.pattern = `Day offsets must be smaller than the ${cycleDays}-day cycle.`;
          break;
        }
        if (!day.shift) {
          next.pattern =
            'Every pattern day needs a shift (the engine stores one even on off days).';
          break;
        }
        offsets.push(off);
      }
      if (!next.pattern && new Set(offsets).size !== offsets.length) {
        next.pattern = 'Pattern day offsets must be unique.';
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: SabcrmRotationInput = {
      name: form.name,
      description: form.description || undefined,
      employeeId:
        form.targetKind === 'employee' ? form.employee?.id : undefined,
      departmentId:
        form.targetKind === 'department' ? form.department?.id : undefined,
      teamId: form.targetKind === 'team' ? form.teamId.trim() : undefined,
      pattern: form.pattern.map((d) => ({
        dayOffset: Number(d.dayOffset),
        shiftId: d.shift?.id ?? '',
        shiftName: d.shift?.label ?? undefined,
        isOff: d.isOff,
      })),
      cycleDays,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      isActive: form.isActive,
      ...(row ? { status: form.status } : {}),
    };

    startTransition(async () => {
      const res = row
        ? await updateSabcrmShiftRotation(row.id, input)
        : await createSabcrmShiftRotation(input);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        row ? `${res.data.name} updated.` : `${res.data.name} scheduled.`,
      );
      onSaved();
    });
  };

  const remove = async (): Promise<void> => {
    if (!row) return;
    setDeleting(true);
    try {
      const res = await deleteSabcrmShiftRotation(row.id);
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
      <DrawerContent aria-describedby="rotation-form-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? 'New shift rotation' : `Edit ${row?.name ?? 'rotation'}`}
          </DrawerTitle>
          <DrawerDescription id="rotation-form-desc">
            {mode === 'create'
              ? 'Define who rotates, the cycle length and the shift for every day of the cycle.'
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
              <div className="fdoc-form-grid__full">
                <Field label="Name" required error={errors.name}>
                  <Input
                    value={form.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder="Support 24×7 rotation"
                    disabled={busy}
                  />
                </Field>
              </div>

              <div className="fdoc-form-grid__full">
                <Field
                  label="Applies to"
                  required
                  error={errors.target}
                  help="Exactly one target — an employee, a whole department, or a team."
                >
                  <div className="flex flex-col gap-2">
                    <SegmentedControl
                      items={TARGET_ITEMS}
                      value={form.targetKind}
                      onChange={(v) => patch({ targetKind: v })}
                      aria-label="Rotation target type"
                      fullWidth
                    />
                    {form.targetKind === 'employee' ? (
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
                          const res = await searchSabcrmRotationEmployees(q);
                          return res.ok ? res.data : [];
                        }}
                        placeholder="Search the roster…"
                        disabled={busy}
                        invalid={Boolean(errors.target)}
                        aria-label="Target employee"
                      />
                    ) : null}
                    {form.targetKind === 'department' ? (
                      <EntityPicker
                        value={form.department?.id ?? null}
                        valueLabel={form.department?.label ?? null}
                        onChange={(opt) =>
                          patch({
                            department: opt
                              ? { id: opt.id, label: opt.label }
                              : null,
                          })
                        }
                        search={async (q) => {
                          const res = await searchSabcrmRotationDepartments(q);
                          return res.ok ? res.data : [];
                        }}
                        placeholder="Search departments…"
                        disabled={busy}
                        invalid={Boolean(errors.target)}
                        aria-label="Target department"
                      />
                    ) : null}
                    {form.targetKind === 'team' ? (
                      <Input
                        value={form.teamId}
                        onChange={(e) => patch({ teamId: e.target.value })}
                        placeholder="Team identifier"
                        disabled={busy}
                        aria-label="Target team identifier"
                      />
                    ) : null}
                  </div>
                </Field>
              </div>

              <Field
                label="Cycle (days)"
                required
                error={errors.cycleDays}
                help="The pattern repeats every this-many days."
              >
                <Input
                  type="number"
                  min={1}
                  value={form.cycleDays}
                  onChange={(e) => patch({ cycleDays: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Active">
                <Switch
                  label="Rotation is live"
                  checked={form.isActive}
                  onCheckedChange={(v) => patch({ isActive: v })}
                  disabled={busy}
                />
              </Field>
              <Field label="Start date" required error={errors.startDate}>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => patch({ startDate: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="End date" error={errors.endDate} help="Leave empty for an open-ended rotation.">
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => patch({ endDate: e.target.value })}
                  disabled={busy}
                />
              </Field>

              <div className="fdoc-form-grid__full">
                <Field
                  label="Pattern"
                  required
                  error={errors.pattern}
                  help="One row per cycle day (0-based offset). Off days still store a fallback shift."
                >
                  <div className="flex flex-col gap-2">
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {form.pattern.map((day) => (
                        <li key={day.rowId} className="flex flex-wrap items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            value={day.dayOffset}
                            onChange={(e) =>
                              patchPatternRow(day.rowId, {
                                dayOffset: e.target.value,
                              })
                            }
                            disabled={busy}
                            aria-label={`Day offset for pattern row ${day.rowId}`}
                            className="w-20"
                          />
                          <div className="min-w-48 flex-1">
                            <EntityPicker
                              value={day.shift?.id ?? null}
                              valueLabel={day.shift?.label ?? null}
                              onChange={(opt) =>
                                patchPatternRow(day.rowId, {
                                  shift: opt
                                    ? { id: opt.id, label: opt.label }
                                    : null,
                                })
                              }
                              search={async (q) => {
                                const res = await searchSabcrmRotationShifts(q);
                                return res.ok ? res.data : [];
                              }}
                              placeholder="Pick a shift…"
                              disabled={busy}
                              aria-label={`Shift for day offset ${day.dayOffset}`}
                            />
                          </div>
                          <Switch
                            label="Off"
                            checked={day.isOff}
                            onCheckedChange={(v) =>
                              patchPatternRow(day.rowId, { isOff: v })
                            }
                            disabled={busy}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            iconLeft={X}
                            disabled={busy || form.pattern.length <= 1}
                            onClick={() => removePatternRow(day.rowId)}
                            aria-label={`Remove pattern day ${day.dayOffset}`}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        iconLeft={Plus}
                        disabled={busy}
                        onClick={addPatternRow}
                      >
                        Add day
                      </Button>
                    </div>
                  </div>
                </Field>
              </div>

              {row ? (
                <Field label="Status" help="Paused rotations stop generating assignments.">
                  <SelectField
                    value={form.status}
                    onChange={(v) =>
                      patch({ status: (v || 'active') as CrmShiftRotationStatus })
                    }
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
                    placeholder="What this rotation covers…"
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
              {mode === 'create' ? 'Create rotation' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>

        <AlertDialog
          open={confirmDelete}
          onOpenChange={(next) => !next && !deleting && setConfirmDelete(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this rotation?</AlertDialogTitle>
              <AlertDialogDescription>
                {row?.name} is removed permanently. Attendance already written
                from it is untouched.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary" disabled={deleting}>
                  Keep it
                </Button>
              </AlertDialogCancel>
              <Button variant="danger" loading={deleting} onClick={() => void remove()}>
                Delete rotation
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── List client ─────────────────────────────────────────────── */

export interface ShiftRotationsClientProps {
  initialRows: SabcrmRotationRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmRotationKpis | null;
  /** `?open=<id>` deep link — opens the edit drawer. */
  initialOpenId: string | null;
}

export function ShiftRotationsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialOpenId,
}: ShiftRotationsClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmRotationRow | null>(null);

  // Deep link / row navigation: `?open=<id>` → load + open the drawer.
  React.useEffect(() => {
    if (!initialOpenId) return;
    let stale = false;
    void (async () => {
      const res = await getSabcrmShiftRotation(initialOpenId);
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
    if (initialOpenId) router.replace(ROTATIONS_PATH, { scroll: false });
  }, [initialOpenId, router]);

  const onSaved = React.useCallback(() => {
    setRefreshToken((t) => t + 1);
    closeEditor();
    router.refresh();
  }, [closeEditor, router]);

  const config = React.useMemo<DocListPageConfig<SabcrmRotationRow>>(
    () => ({
      title: 'Shift rotations',
      description:
        'Repeating shift schedules — who rotates, the cycle length and the shift for every day of the cycle.',
      icon: RefreshCw,
      entity: { singular: 'rotation', plural: 'rotations' },
      columns: COLUMNS,
      statuses: ROTATION_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmShiftRotationsPage(
          toRotationFilters(filters),
        );
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      csvFileName: 'shift-rotations.csv',
      rowHref: (row) => rotationOpenHref(row.id),
      rowLabel: (row) => `rotation ${row.name}`,
      partyFilter: {
        placeholder: 'Any employee',
        search: async (q) => {
          const res = await searchSabcrmRotationEmployees(q);
          return res.ok ? res.data : [];
        },
      },
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Rotations"
        icon={RefreshCw}
        value={String(kpis.total)}
        delta={kpis.sampled ? 'Across the latest 100 rotations' : 'In the schedule'}
      />
      <KpiCard
        label="Active"
        icon={CheckCircle2}
        value={String(kpis.active)}
        delta="Generating assignments"
        deltaTone={kpis.active > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Paused"
        icon={PauseCircle}
        value={String(kpis.paused)}
        delta="Temporarily stopped"
        deltaTone={kpis.paused > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Completed"
        icon={Flag}
        value={String(kpis.completed)}
        delta="Past their end date"
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
            New rotation
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />
      <RotationEditorDrawer
        open={editorOpen}
        row={editing}
        onClose={closeEditor}
        onSaved={onSaved}
      />
    </>
  );
}
