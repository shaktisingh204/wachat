'use client';

/**
 * SabCRM People — Attendance list client
 * (`/sabcrm/people/attendance`, spec WI-25).
 *
 * Doc-surface adopter for the attendance register: KPI strip (present /
 * absent / late / marked today), config-driven list (employee + status
 * + date-range filters, server pagination, CSV export), header
 * **Punch in / Punch out** mini-drawers (employee picker + optional
 * SabFiles selfie + geolocation consent) and a row-expand DETAIL drawer
 * (no separate route) rendering every stored field — both PunchPoints,
 * the breaks table, derived totals, approver and audit trail — with an
 * EDIT mode carrying the full `CreateAttendanceInput` surface.
 *
 * Every FK renders as a RESOLVED label (employee / shift / approver) —
 * never a raw ObjectId. `?open=<id>` deep-links the drawer.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlarmClock,
  CalendarCheck,
  FilePenLine,
  Fingerprint,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  Trash2,
  UserCheck,
  UserX,
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
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';
import { SabFilePickerButton } from '@/components/sabfiles';

import {
  DocListPage,
  EntityPicker,
  formatDocDate,
  type DocListColumn,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';
import {
  ATTENDANCE_SOURCES,
  ATTENDANCE_STATUSES,
  PEOPLE_ATTENDANCE_PATH,
  attendanceOpenHref,
  attendanceSourceLabel,
  attendanceSourceTone,
  attendanceStatusLabel,
  toAttendanceFilters,
} from './attendance-config';

import {
  createSabcrmAttendance,
  deleteSabcrmAttendance,
  exportSabcrmAttendanceRows,
  getSabcrmAttendance,
  listSabcrmAttendancePage,
  punchInSabcrm,
  punchOutSabcrm,
  updateSabcrmAttendance,
} from '@/app/actions/sabcrm-people-attendance.actions';
import {
  searchSabcrmEmployees,
  searchSabcrmEmployeeShifts,
} from '@/app/actions/sabcrm-people-employees.actions';
import type {
  CrmPunchPoint,
  SabcrmAttendanceDetail,
  SabcrmAttendanceFormValues,
  SabcrmAttendanceKpis,
  SabcrmAttendanceListRow,
  SabcrmPunchPointValues,
} from '@/app/actions/sabcrm-people-attendance.actions.types';
import type {
  CrmAttendanceSource,
  CrmAttendanceStatus,
} from '@/lib/rust-client/crm-attendance';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../../finance/_components/doc-surface/doc-surface.css';

/* ─── Columns (full WI-25 coverage) ───────────────────────────── */

const COLUMNS: DocListColumn<SabcrmAttendanceListRow>[] = [
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  {
    key: 'employee',
    header: 'Employee',
    kind: 'party',
    value: (r) => r.employeeLabel,
  },
  { key: 'shift', header: 'Shift', kind: 'text', value: (r) => r.shiftLabel },
  { key: 'punchIn', header: 'In', kind: 'text', value: (r) => r.punchInAt },
  { key: 'punchOut', header: 'Out', kind: 'text', value: (r) => r.punchOutAt },
  { key: 'totalHours', header: 'Hours', kind: 'text', value: (r) => r.totalHours },
  {
    key: 'overtimeHours',
    header: 'OT',
    kind: 'text',
    value: (r) => r.overtimeHours,
  },
  {
    key: 'lateBy',
    header: 'Late by',
    kind: 'badge',
    value: (r) => (r.lateByMinutes > 0 ? `${r.lateByMinutes} min` : null),
    tone: () => 'warning',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
  {
    key: 'source',
    header: 'Source',
    kind: 'badge',
    value: (r) => attendanceSourceLabel(r.source),
    tone: (r) => attendanceSourceTone(r.source),
  },
];

/* ─── Shared helpers ──────────────────────────────────────────── */

const STATUS_OPTIONS: SelectOption[] = ATTENDANCE_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

const SOURCE_OPTIONS: SelectOption[] = ATTENDANCE_SOURCES.map((s) => ({
  value: s.value,
  label: s.label,
}));

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

/** ISO instant → `datetime-local` input value (UTC wall clock). */
function isoToLocalInput(iso: string | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${m[1]}T${m[2]}` : '';
}

/** ISO instant → `HH:mm` display (UTC wall clock, deterministic). */
function isoToHhMm(iso: string | undefined): string {
  if (!iso) return '—';
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m?.[1] ?? '—';
}

const searchEmployeeOptions = async (q: string) => {
  const res = await searchSabcrmEmployees(q);
  return res.ok ? res.data : [];
};

const searchShiftOptions = async (q: string) => {
  const res = await searchSabcrmEmployeeShifts(q);
  return res.ok ? res.data : [];
};

/* ─── Punch sub-form (the full PunchPoint surface) ────────────── */

interface PunchFormState {
  at: string;
  lat: string;
  lng: string;
  ip: string;
  device: string;
  selfieFileId: string;
  selfieName: string;
}

function emptyPunch(): PunchFormState {
  return { at: '', lat: '', lng: '', ip: '', device: '', selfieFileId: '', selfieName: '' };
}

function punchFromPoint(p: CrmPunchPoint | undefined): PunchFormState {
  if (!p) return emptyPunch();
  return {
    at: isoToLocalInput(p.at),
    lat: p.lat != null ? String(p.lat) : '',
    lng: p.lng != null ? String(p.lng) : '',
    ip: p.ip ?? '',
    device: p.device ?? '',
    selfieFileId: p.selfieFileId ?? '',
    selfieName: p.selfieFileId ? 'Selfie on file' : '',
  };
}

function punchToValues(p: PunchFormState): SabcrmPunchPointValues | null {
  if (!p.at) return null;
  return {
    at: p.at,
    lat: p.lat || undefined,
    lng: p.lng || undefined,
    ip: p.ip || undefined,
    device: p.device || undefined,
    selfieFileId: p.selfieFileId || undefined,
  };
}

function PunchFields({
  legend,
  value,
  onChange,
  busy,
}: {
  legend: string;
  value: PunchFormState;
  onChange: (next: PunchFormState) => void;
  busy: boolean;
}): React.JSX.Element {
  const patch = (p: Partial<PunchFormState>): void => onChange({ ...value, ...p });
  const idBase = legend.toLowerCase().replaceAll(/[^a-z]+/g, '-');
  return (
    <fieldset className="rounded-lg border border-[var(--st-border)] p-3">
      <legend className="px-1 text-xs font-medium text-[var(--st-text-tertiary)]">
        {legend}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Time" help="Leave empty when not punched.">
          <Input
            type="datetime-local"
            value={value.at}
            onChange={(e) => patch({ at: e.target.value })}
            disabled={busy}
            aria-label={`${legend} time`}
          />
        </Field>
        <Field label="Device" help="User-agent or kiosk serial.">
          <Input
            value={value.device}
            onChange={(e) => patch({ device: e.target.value })}
            disabled={busy}
            aria-label={`${legend} device`}
          />
        </Field>
        <Field label="Latitude">
          <Input
            inputMode="decimal"
            value={value.lat}
            onChange={(e) => patch({ lat: e.target.value })}
            placeholder="19.0760"
            disabled={busy}
            aria-label={`${legend} latitude`}
          />
        </Field>
        <Field label="Longitude">
          <Input
            inputMode="decimal"
            value={value.lng}
            onChange={(e) => patch({ lng: e.target.value })}
            placeholder="72.8777"
            disabled={busy}
            aria-label={`${legend} longitude`}
          />
        </Field>
        <Field label="IP address">
          <Input
            value={value.ip}
            onChange={(e) => patch({ ip: e.target.value })}
            placeholder="203.0.113.7"
            disabled={busy}
            aria-label={`${legend} IP address`}
          />
        </Field>
        <Field label="Selfie" help="Captured at punch — lives in SabFiles.">
          <div className="flex items-center gap-2" id={`${idBase}-selfie`}>
            <SabFilePickerButton
              accept="image"
              title="Pick the punch selfie"
              onPick={(pick) =>
                patch({ selfieFileId: pick.id, selfieName: pick.name })
              }
            >
              {value.selfieFileId ? 'Replace selfie' : 'Attach selfie'}
            </SabFilePickerButton>
            {value.selfieFileId ? (
              <>
                <span className="max-w-[10rem] truncate text-xs">
                  {value.selfieName || 'Selfie on file'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => patch({ selfieFileId: '', selfieName: '' })}
                >
                  Clear
                </Button>
              </>
            ) : (
              <span className="text-xs opacity-70">None</span>
            )}
          </div>
        </Field>
      </div>
    </fieldset>
  );
}

/* ─── Editor drawer (full CreateAttendanceInput) ──────────────── */

interface BreakRow {
  rowId: string;
  in: string;
  out: string;
}

interface AttendanceFormState {
  date: string;
  employee: PickerState;
  status: CrmAttendanceStatus;
  shift: PickerState;
  punchIn: PunchFormState;
  punchOut: PunchFormState;
  breaks: BreakRow[];
  totalHours: string;
  overtimeHours: string;
  lateByMinutes: string;
  earlyOutByMinutes: string;
  source: CrmAttendanceSource;
  approver: PickerState;
  notes: string;
}

let breakSeq = 0;
function nextBreakId(): string {
  breakSeq += 1;
  return `brk-${breakSeq}`;
}

function emptyForm(): AttendanceFormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    employee: EMPTY_PICK,
    status: 'present',
    shift: EMPTY_PICK,
    punchIn: emptyPunch(),
    punchOut: emptyPunch(),
    breaks: [],
    totalHours: '',
    overtimeHours: '',
    lateByMinutes: '',
    earlyOutByMinutes: '',
    source: 'manual',
    approver: EMPTY_PICK,
    notes: '',
  };
}

function formFromDetail(detail: SabcrmAttendanceDetail): AttendanceFormState {
  const d = detail.doc;
  return {
    date: (d.date ?? '').slice(0, 10),
    employee: { id: d.employeeId, label: detail.employeeLabel },
    status: d.status ?? 'present',
    shift: d.shiftId
      ? { id: d.shiftId, label: detail.shiftLabel }
      : EMPTY_PICK,
    punchIn: punchFromPoint(d.punchIn),
    punchOut: punchFromPoint(d.punchOut),
    breaks: (d.breaks ?? []).map((b) => ({
      rowId: nextBreakId(),
      in: isoToLocalInput(b.in),
      out: isoToLocalInput(b.out),
    })),
    totalHours: d.totalHours != null ? String(d.totalHours) : '',
    overtimeHours: d.overtimeHours != null ? String(d.overtimeHours) : '',
    lateByMinutes: d.lateByMinutes != null ? String(d.lateByMinutes) : '',
    earlyOutByMinutes:
      d.earlyOutByMinutes != null ? String(d.earlyOutByMinutes) : '',
    source: d.source ?? 'manual',
    approver: d.approverId
      ? { id: d.approverId, label: detail.approverLabel }
      : EMPTY_PICK,
    notes: d.notes ?? '',
  };
}

interface AttendanceEditorProps {
  open: boolean;
  /** Null = create mode. */
  detail: SabcrmAttendanceDetail | null;
  onClose: () => void;
  onSaved: () => void;
}

function AttendanceEditorDrawer({
  open,
  detail,
  onClose,
  onSaved,
}: AttendanceEditorProps): React.JSX.Element {
  const [form, setForm] = React.useState<AttendanceFormState>(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const mode = detail ? 'edit' : 'create';
  const busy = pending;

  React.useEffect(() => {
    if (!open) return;
    setForm(detail ? formFromDetail(detail) : emptyForm());
    setErrors({});
    setFormError(null);
  }, [open, detail]);

  const patch = (p: Partial<AttendanceFormState>): void =>
    setForm((prev) => ({ ...prev, ...p }));

  const submit = (): void => {
    setFormError(null);
    const next: Record<string, string> = {};
    if (!form.date) next.date = 'Date is required.';
    if (!form.employee.id) next.employee = 'Pick an employee.';
    if (!form.status) next.status = 'Pick a status.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const values: SabcrmAttendanceFormValues = {
      date: form.date,
      employeeId: form.employee.id ?? '',
      status: form.status,
      shiftId: form.shift.id ?? undefined,
      punchIn: punchToValues(form.punchIn),
      punchOut: punchToValues(form.punchOut),
      breaks: form.breaks
        .filter((b) => b.in)
        .map((b) => ({ in: b.in, out: b.out || undefined })),
      totalHours: numOrUndefined(form.totalHours),
      overtimeHours: numOrUndefined(form.overtimeHours),
      lateByMinutes: numOrUndefined(form.lateByMinutes),
      earlyOutByMinutes: numOrUndefined(form.earlyOutByMinutes),
      source: form.source,
      approverId: form.approver.id ?? undefined,
      notes: form.notes || undefined,
    };

    startTransition(async () => {
      const res = detail
        ? await updateSabcrmAttendance(detail.doc._id, values)
        : await createSabcrmAttendance(values);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        detail ? 'Attendance record updated.' : 'Attendance record logged.',
      );
      onSaved();
    });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && !busy && onClose()}
      side="right"
    >
      <DrawerContent
        aria-describedby="attendance-form-desc"
        className="fdoc-form-drawer"
      >
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? 'Log attendance' : 'Edit attendance'}
          </DrawerTitle>
          <DrawerDescription id="attendance-form-desc">
            {mode === 'create'
              ? 'The full day record — punches, breaks, derived totals and approval metadata.'
              : 'Every stored field is editable; breaks are replaced wholesale on save.'}
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
              <Field label="Date" required error={errors.date}>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => patch({ date: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Status" required error={errors.status}>
                <SelectField
                  value={form.status}
                  onChange={(v) =>
                    patch({ status: (v || 'present') as CrmAttendanceStatus })
                  }
                  options={STATUS_OPTIONS}
                  aria-label="Status"
                />
              </Field>
              <Field label="Employee" required error={errors.employee}>
                <EntityPicker
                  value={form.employee.id}
                  valueLabel={form.employee.label}
                  onChange={(opt) =>
                    patch({
                      employee: { id: opt?.id ?? null, label: opt?.label ?? null },
                    })
                  }
                  search={searchEmployeeOptions}
                  placeholder="Search employees…"
                  invalid={!!errors.employee}
                  disabled={busy}
                  aria-label="Employee"
                />
              </Field>
              <Field label="Shift" help="Drives late / early-out math.">
                <EntityPicker
                  value={form.shift.id}
                  valueLabel={form.shift.label}
                  onChange={(opt) =>
                    patch({
                      shift: { id: opt?.id ?? null, label: opt?.label ?? null },
                    })
                  }
                  search={searchShiftOptions}
                  placeholder="Search shifts…"
                  disabled={busy}
                  aria-label="Shift"
                />
              </Field>

              <div className="fdoc-form-grid__full">
                <PunchFields
                  legend="Punch in"
                  value={form.punchIn}
                  onChange={(p) => patch({ punchIn: p })}
                  busy={busy}
                />
              </div>
              <div className="fdoc-form-grid__full">
                <PunchFields
                  legend="Punch out"
                  value={form.punchOut}
                  onChange={(p) => patch({ punchOut: p })}
                  busy={busy}
                />
              </div>

              <div className="fdoc-form-grid__full">
                <Field label="Breaks" help="In/out pairs — out stays empty while a break runs.">
                  <div className="flex flex-col gap-2">
                    {form.breaks.map((b, i) => (
                      <div key={b.rowId} className="flex flex-wrap items-end gap-2">
                        <Field label={`Break ${i + 1} in`}>
                          <Input
                            type="datetime-local"
                            value={b.in}
                            onChange={(e) =>
                              patch({
                                breaks: form.breaks.map((row) =>
                                  row.rowId === b.rowId
                                    ? { ...row, in: e.target.value }
                                    : row,
                                ),
                              })
                            }
                            disabled={busy}
                          />
                        </Field>
                        <Field label={`Break ${i + 1} out`}>
                          <Input
                            type="datetime-local"
                            value={b.out}
                            onChange={(e) =>
                              patch({
                                breaks: form.breaks.map((row) =>
                                  row.rowId === b.rowId
                                    ? { ...row, out: e.target.value }
                                    : row,
                                ),
                              })
                            }
                            disabled={busy}
                          />
                        </Field>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          iconLeft={X}
                          disabled={busy}
                          aria-label={`Remove break ${i + 1}`}
                          onClick={() =>
                            patch({
                              breaks: form.breaks.filter(
                                (row) => row.rowId !== b.rowId,
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        iconLeft={Plus}
                        disabled={busy}
                        onClick={() =>
                          patch({
                            breaks: [
                              ...form.breaks,
                              { rowId: nextBreakId(), in: '', out: '' },
                            ],
                          })
                        }
                      >
                        Add break
                      </Button>
                    </div>
                  </div>
                </Field>
              </div>

              <Field label="Total hours" help="Server-computed in the happy path.">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.totalHours}
                  onChange={(e) => patch({ totalHours: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Overtime hours">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.overtimeHours}
                  onChange={(e) => patch({ overtimeHours: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Late by (minutes)">
                <Input
                  type="number"
                  min={0}
                  value={form.lateByMinutes}
                  onChange={(e) => patch({ lateByMinutes: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Early out by (minutes)">
                <Input
                  type="number"
                  min={0}
                  value={form.earlyOutByMinutes}
                  onChange={(e) => patch({ earlyOutByMinutes: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Source">
                <SelectField
                  value={form.source}
                  onChange={(v) =>
                    patch({ source: (v || 'manual') as CrmAttendanceSource })
                  }
                  options={SOURCE_OPTIONS}
                  aria-label="Source"
                />
              </Field>
              <Field label="Approver">
                <EntityPicker
                  value={form.approver.id}
                  valueLabel={form.approver.label}
                  onChange={(opt) =>
                    patch({
                      approver: { id: opt?.id ?? null, label: opt?.label ?? null },
                    })
                  }
                  search={searchEmployeeOptions}
                  placeholder="Search employees…"
                  disabled={busy}
                  aria-label="Approver"
                />
              </Field>
              <div className="fdoc-form-grid__full">
                <Field label="Notes">
                  <Textarea
                    value={form.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    rows={3}
                    placeholder="Correction reason, regularisation context…"
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
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {mode === 'create' ? 'Log attendance' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── Detail drawer (read view of EVERY stored field) ─────────── */

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[var(--st-text-tertiary)]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-[var(--st-text)]">
        {value === undefined || value === null || value === '' ? '—' : value}
      </dd>
    </div>
  );
}

function PunchPointView({
  legend,
  point,
}: {
  legend: string;
  point: CrmPunchPoint | undefined;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--st-border)] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {legend}
      </p>
      {point ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <DetailRow label="Time" value={isoToHhMm(point.at)} />
          <DetailRow
            label="Location"
            value={
              point.lat != null && point.lng != null
                ? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`
                : undefined
            }
          />
          <DetailRow label="IP" value={point.ip} />
          <DetailRow label="Device" value={point.device} />
          <DetailRow
            label="Selfie"
            value={
              point.selfieFileId ? (
                <Badge tone="success">On file</Badge>
              ) : (
                <span className="opacity-70">Not captured</span>
              )
            }
          />
        </dl>
      ) : (
        <p className="text-sm opacity-70">Not punched.</p>
      )}
    </div>
  );
}

interface AttendanceDetailProps {
  open: boolean;
  detail: SabcrmAttendanceDetail | null;
  loading: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}

function AttendanceDetailDrawer({
  open,
  detail,
  loading,
  onClose,
  onEdit,
  onDeleted,
}: AttendanceDetailProps): React.JSX.Element {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const doc = detail?.doc ?? null;
  const statusDef = doc
    ? ATTENDANCE_STATUSES.find((s) => s.value === doc.status)
    : null;

  const remove = async (): Promise<void> => {
    if (!doc) return;
    setDeleting(true);
    try {
      const res = await deleteSabcrmAttendance(doc._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Attendance record deleted.');
      setConfirmDelete(false);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && !deleting && onClose()}
      side="right"
    >
      <DrawerContent
        aria-describedby="attendance-detail-desc"
        className="fdoc-form-drawer"
      >
        <DrawerHeader>
          <DrawerTitle>
            {doc
              ? `${detail?.employeeLabel ?? 'Employee'} — ${formatDocDate(doc.date)}`
              : 'Attendance record'}
          </DrawerTitle>
          <DrawerDescription id="attendance-detail-desc">
            Every stored field of the day record, including both punch points
            and the breaks table.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {loading ? (
            <p className="text-sm opacity-70">Loading the record…</p>
          ) : doc ? (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <DetailRow label="Date" value={formatDocDate(doc.date)} />
                <DetailRow
                  label="Status"
                  value={
                    <Badge tone={statusDef?.tone ?? 'neutral'}>
                      {attendanceStatusLabel(doc.status)}
                    </Badge>
                  }
                />
                <DetailRow
                  label="Employee"
                  value={detail?.employeeLabel ?? 'Unknown'}
                />
                <DetailRow
                  label="Shift"
                  value={doc.shiftId ? (detail?.shiftLabel ?? 'Unknown') : undefined}
                />
                <DetailRow
                  label="Source"
                  value={
                    <Badge tone={attendanceSourceTone(doc.source)}>
                      {attendanceSourceLabel(doc.source)}
                    </Badge>
                  }
                />
                <DetailRow
                  label="Approver"
                  value={doc.approverId ? (detail?.approverLabel ?? 'Unknown') : undefined}
                />
              </dl>

              <PunchPointView legend="Punch in" point={doc.punchIn} />
              <PunchPointView legend="Punch out" point={doc.punchOut} />

              <div className="rounded-lg border border-[var(--st-border)] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Breaks
                </p>
                {doc.breaks?.length ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[var(--st-text-tertiary)]">
                        <th scope="col" className="py-1 font-medium">#</th>
                        <th scope="col" className="py-1 font-medium">In</th>
                        <th scope="col" className="py-1 font-medium">Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.breaks.map((b, i) => (
                        <tr key={`${b.in}-${i}`}>
                          <td className="py-1">{i + 1}</td>
                          <td className="py-1">{isoToHhMm(b.in)}</td>
                          <td className="py-1">
                            {b.out ? isoToHhMm(b.out) : 'Running'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm opacity-70">No breaks recorded.</p>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <DetailRow
                  label="Total hours"
                  value={doc.totalHours != null ? `${doc.totalHours}h` : undefined}
                />
                <DetailRow
                  label="Overtime hours"
                  value={
                    doc.overtimeHours != null ? `${doc.overtimeHours}h` : undefined
                  }
                />
                <DetailRow
                  label="Late by"
                  value={
                    doc.lateByMinutes ? `${doc.lateByMinutes} min` : undefined
                  }
                />
                <DetailRow
                  label="Early out by"
                  value={
                    doc.earlyOutByMinutes
                      ? `${doc.earlyOutByMinutes} min`
                      : undefined
                  }
                />
                <DetailRow label="Notes" value={doc.notes} />
                <DetailRow
                  label="Logged"
                  value={
                    doc.createdAt ?? doc.audit?.createdAt
                      ? formatDocDate(doc.createdAt ?? doc.audit?.createdAt)
                      : undefined
                  }
                />
                <DetailRow
                  label="Last updated"
                  value={
                    doc.updatedAt ?? doc.audit?.updatedAt
                      ? formatDocDate(doc.updatedAt ?? doc.audit?.updatedAt)
                      : undefined
                  }
                />
              </dl>
            </div>
          ) : (
            <Alert tone="danger" role="alert">
              The attendance record could not be loaded.
            </Alert>
          )}
        </div>

        <DrawerFooter>
          <Button type="button" variant="ghost" iconLeft={X} onClick={onClose}>
            Close
          </Button>
          {doc ? (
            <>
              <Button
                type="button"
                variant="danger"
                iconLeft={Trash2}
                disabled={deleting}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
              <Button
                type="button"
                variant="primary"
                iconLeft={FilePenLine}
                onClick={onEdit}
              >
                Edit
              </Button>
            </>
          ) : null}
        </DrawerFooter>

        <AlertDialog
          open={confirmDelete}
          onOpenChange={(next) => !next && !deleting && setConfirmDelete(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this attendance record?</AlertDialogTitle>
              <AlertDialogDescription>
                The day record is removed permanently — payroll runs computed
                later will no longer see it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary" disabled={deleting}>
                  Keep it
                </Button>
              </AlertDialogCancel>
              <Button
                variant="danger"
                loading={deleting}
                onClick={() => void remove()}
              >
                Delete record
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── Punch mini-drawer (employee + selfie + geolocation consent) ── */

interface PunchDrawerProps {
  open: boolean;
  mode: 'in' | 'out';
  onClose: () => void;
  onDone: () => void;
}

function PunchDrawer({
  open,
  mode,
  onClose,
  onDone,
}: PunchDrawerProps): React.JSX.Element {
  const [employee, setEmployee] = React.useState<PickerState>(EMPTY_PICK);
  const [selfieFileId, setSelfieFileId] = React.useState('');
  const [selfieName, setSelfieName] = React.useState('');
  const [useLocation, setUseLocation] = React.useState(false);
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locError, setLocError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setEmployee(EMPTY_PICK);
    setSelfieFileId('');
    setSelfieName('');
    setUseLocation(false);
    setCoords(null);
    setLocError(null);
    setError(null);
  }, [open]);

  const requestLocation = (next: boolean): void => {
    setUseLocation(next);
    setLocError(null);
    if (!next) {
      setCoords(null);
      return;
    }
    if (!('geolocation' in navigator)) {
      setLocError('Geolocation is not available in this browser.');
      setUseLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setLocError('Location permission was denied — punching without it.');
        setUseLocation(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const submit = (): void => {
    setError(null);
    if (!employee.id) {
      setError('Pick an employee.');
      return;
    }
    startTransition(async () => {
      const action = mode === 'in' ? punchInSabcrm : punchOutSabcrm;
      const res = await action({
        employeeId: employee.id ?? '',
        lat: coords?.lat,
        lng: coords?.lng,
        device:
          typeof navigator !== 'undefined'
            ? navigator.userAgent.slice(0, 120)
            : undefined,
        selfieFileId: selfieFileId || undefined,
        source: 'web',
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        mode === 'in'
          ? `${employee.label ?? 'Employee'} punched in.`
          : `${employee.label ?? 'Employee'} punched out.`,
      );
      onDone();
    });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && !pending && onClose()}
      side="right"
    >
      <DrawerContent aria-describedby="punch-desc">
        <DrawerHeader>
          <DrawerTitle>{mode === 'in' ? 'Punch in' : 'Punch out'}</DrawerTitle>
          <DrawerDescription id="punch-desc">
            Stamps today&apos;s record in one step — the engine fills the
            punch instant with the current time.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <div className="grid gap-3">
            <Field label="Employee" required>
              <EntityPicker
                value={employee.id}
                valueLabel={employee.label}
                onChange={(opt) =>
                  setEmployee({ id: opt?.id ?? null, label: opt?.label ?? null })
                }
                search={searchEmployeeOptions}
                placeholder="Search employees…"
                disabled={pending}
                aria-label="Employee"
              />
            </Field>

            <Field label="Selfie (optional)" help="Lives in SabFiles.">
              <div className="flex items-center gap-2">
                <SabFilePickerButton
                  accept="image"
                  title="Pick the punch selfie"
                  onPick={(pick) => {
                    setSelfieFileId(pick.id);
                    setSelfieName(pick.name);
                  }}
                >
                  {selfieFileId ? 'Replace selfie' : 'Attach selfie'}
                </SabFilePickerButton>
                {selfieFileId ? (
                  <>
                    <span className="max-w-[10rem] truncate text-xs">
                      {selfieName}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        setSelfieFileId('');
                        setSelfieName('');
                      }}
                    >
                      Clear
                    </Button>
                  </>
                ) : null}
              </div>
            </Field>

            <Field
              label="Location"
              help="Attaches your current coordinates to the punch — asks the browser for consent."
            >
              <div className="flex flex-col gap-1">
                <Switch
                  label="Use my current location"
                  checked={useLocation}
                  onCheckedChange={requestLocation}
                  disabled={pending}
                />
                {coords ? (
                  <span className="inline-flex items-center gap-1 text-xs opacity-80">
                    <MapPin size={12} aria-hidden="true" />
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </span>
                ) : null}
                {locError ? (
                  <span className="text-xs text-[var(--st-danger,#b42318)]">
                    {locError}
                  </span>
                ) : null}
              </div>
            </Field>

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>
        </div>

        <DrawerFooter>
          <Button
            type="button"
            variant="ghost"
            iconLeft={X}
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            iconLeft={Fingerprint}
            loading={pending}
            onClick={submit}
          >
            {mode === 'in' ? 'Punch in' : 'Punch out'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── List client ─────────────────────────────────────────────── */

export interface AttendanceClientProps {
  initialRows: SabcrmAttendanceListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmAttendanceKpis | null;
  /** `?open=<id>` deep link — opens the detail drawer. */
  initialOpenId: string | null;
}

export function AttendanceClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialOpenId,
}: AttendanceClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken, setRefreshToken] = React.useState(0);

  const [detail, setDetail] = React.useState<SabcrmAttendanceDetail | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmAttendanceDetail | null>(
    null,
  );
  const [punch, setPunch] = React.useState<'in' | 'out' | null>(null);

  const loadDetail = React.useCallback(async (id: string): Promise<void> => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await getSabcrmAttendance(id);
      if (!res.ok) {
        toast.error(res.error);
        setDetail(null);
        return;
      }
      setDetail(res.data);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Deep link / row navigation: `?open=<id>` → load + open the drawer.
  React.useEffect(() => {
    if (!initialOpenId) return;
    void loadDetail(initialOpenId);
  }, [initialOpenId, loadDetail]);

  const closeAll = React.useCallback(() => {
    setDetailOpen(false);
    setEditorOpen(false);
    setEditing(null);
    setDetail(null);
    if (initialOpenId) {
      router.replace(PEOPLE_ATTENDANCE_PATH, { scroll: false });
    }
  }, [initialOpenId, router]);

  const refetch = React.useCallback(() => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  }, [router]);

  const onSaved = React.useCallback(() => {
    refetch();
    closeAll();
  }, [closeAll, refetch]);

  const config = React.useMemo<DocListPageConfig<SabcrmAttendanceListRow>>(
    () => ({
      title: 'Attendance',
      description:
        'The daily register — punches, breaks, derived hours and day verdicts across the roster.',
      icon: CalendarCheck,
      entity: { singular: 'attendance record', plural: 'attendance records' },
      columns: COLUMNS,
      statuses: ATTENDANCE_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmAttendancePage(toAttendanceFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmAttendanceRows(toAttendanceFilters(filters)),
      csvFileName: 'attendance.csv',
      rowHref: (row) => attendanceOpenHref(row.id),
      rowLabel: (row) =>
        `attendance for ${row.employeeLabel ?? 'employee'} on ${row.date?.slice(0, 10) ?? 'unknown date'}`,
      partyFilter: {
        placeholder: 'Any employee',
        search: searchEmployeeOptions,
      },
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Present today"
        icon={UserCheck}
        value={String(kpis.presentToday)}
        delta="Present, WFH or half-day"
        deltaTone={kpis.presentToday > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Absent today"
        icon={UserX}
        value={String(kpis.absentToday)}
        delta="Marked absent"
        deltaTone={kpis.absentToday > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Late today"
        icon={AlarmClock}
        value={String(kpis.lateToday)}
        delta="Punched in after grace"
        deltaTone={kpis.lateToday > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Marked today"
        icon={CalendarCheck}
        value={String(kpis.markedToday)}
        delta="Day records stamped"
      />
    </>
  ) : null;

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              iconLeft={LogIn}
              onClick={() => setPunch('in')}
            >
              Punch in
            </Button>
            <Button
              variant="secondary"
              iconLeft={LogOut}
              onClick={() => setPunch('out')}
            >
              Punch out
            </Button>
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              Log attendance
            </Button>
          </div>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <AttendanceDetailDrawer
        open={detailOpen && !editorOpen}
        detail={detail}
        loading={detailLoading}
        onClose={closeAll}
        onEdit={() => {
          setEditing(detail);
          setEditorOpen(true);
        }}
        onDeleted={onSaved}
      />

      <AttendanceEditorDrawer
        open={editorOpen}
        detail={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
          if (!detailOpen) closeAll();
        }}
        onSaved={onSaved}
      />

      <PunchDrawer
        open={punch !== null}
        mode={punch ?? 'in'}
        onClose={() => setPunch(null)}
        onDone={() => {
          setPunch(null);
          refetch();
        }}
      />
    </>
  );
}
