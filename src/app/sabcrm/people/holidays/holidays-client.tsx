'use client';

/**
 * SabCRM People — Holidays list client
 * (`/sabcrm/people/holidays`, spec WI-27).
 *
 * Doc-surface adopter for the holiday calendar: config-driven list
 * (search + type + date-range/year filters, server pagination, CSV
 * export), a right-side drawer carrying the FULL `CreateHolidayInput`
 * field set — date, name, classification, recurring flag, applicable
 * locations (tag input; empty = project-wide) and notes — plus the
 * spec'd bulk DELETE action over selected rows.
 *
 * No detail route (per spec): `?open=<id>` deep-links the edit drawer,
 * so individual holidays stay shareable/bookmarkable.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Plus, Trash2, X } from 'lucide-react';

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
  SelectField,
  Switch,
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  DocListPage,
  type DocListColumn,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';
import {
  HOLIDAY_TYPES,
  PEOPLE_HOLIDAYS_PATH,
  holidayOpenHref,
  toHolidayFilters,
} from './holidays-config';

import {
  createSabcrmHoliday,
  deleteSabcrmHoliday,
  exportSabcrmHolidayRows,
  getSabcrmHoliday,
  listSabcrmHolidaysPage,
  updateSabcrmHoliday,
} from '@/app/actions/sabcrm-people-holidays.actions';
import type {
  SabcrmHolidayFormValues,
  SabcrmHolidayListRow,
} from '@/app/actions/sabcrm-people-holidays.actions.types';
import type { CrmHolidayType } from '@/lib/rust-client/crm-holidays';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../../finance/_components/doc-surface/doc-surface.css';

/* ─── Columns (full WI-27 coverage) ───────────────────────────── */

const COLUMNS: DocListColumn<SabcrmHolidayListRow>[] = [
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  { key: 'name', header: 'Holiday', kind: 'text', value: (r) => r.name },
  {
    key: 'holidayType',
    header: 'Type',
    kind: 'status',
    value: (r) => r.holidayType,
  },
  {
    key: 'recurring',
    header: 'Recurring',
    kind: 'badge',
    value: (r) => (r.recurring ? 'Every year' : null),
    tone: () => 'info',
  },
  {
    key: 'locations',
    header: 'Locations',
    kind: 'text',
    value: (r) => r.locations || 'Project-wide',
  },
  { key: 'notes', header: 'Notes', kind: 'text', value: (r) => r.notes },
];

/* ─── Editor drawer (full CreateHolidayInput) ─────────────────── */

const TYPE_OPTIONS: SelectOption[] = HOLIDAY_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

interface HolidayFormState {
  date: string;
  name: string;
  holidayType: CrmHolidayType;
  recurring: boolean;
  locations: string[];
  locationDraft: string;
  notes: string;
}

function emptyForm(): HolidayFormState {
  return {
    date: '',
    name: '',
    holidayType: 'national',
    recurring: false,
    locations: [],
    locationDraft: '',
    notes: '',
  };
}

function formFromRow(row: SabcrmHolidayListRow): HolidayFormState {
  return {
    date: (row.date ?? '').slice(0, 10),
    name: row.name,
    holidayType: row.holidayType,
    recurring: row.recurring,
    locations: [...row.locationsList],
    locationDraft: '',
    notes: row.notes,
  };
}

interface HolidayEditorProps {
  open: boolean;
  /** Null = create mode. */
  row: SabcrmHolidayListRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function HolidayEditorDrawer({
  open,
  row,
  onClose,
  onSaved,
}: HolidayEditorProps): React.JSX.Element {
  const [form, setForm] = React.useState<HolidayFormState>(emptyForm);
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

  const patch = (p: Partial<HolidayFormState>): void =>
    setForm((prev) => ({ ...prev, ...p }));

  const addLocation = (): void => {
    const raw = form.locationDraft.trim();
    if (!raw) return;
    if (form.locations.some((l) => l.toLowerCase() === raw.toLowerCase())) {
      patch({ locationDraft: '' });
      return;
    }
    patch({ locations: [...form.locations, raw], locationDraft: '' });
  };

  const submit = (): void => {
    setFormError(null);
    const next: Record<string, string> = {};
    if (!form.date) next.date = 'Date is required.';
    if (!form.name.trim()) next.name = 'Name is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const values: SabcrmHolidayFormValues = {
      date: form.date,
      name: form.name,
      holidayType: form.holidayType,
      recurring: form.recurring,
      applicableLocations: form.locations,
      notes: form.notes || undefined,
    };

    startTransition(async () => {
      const res = row
        ? await updateSabcrmHoliday(row.id, values)
        : await createSabcrmHoliday(values);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        row
          ? `${res.data.name} updated.`
          : `${res.data.name} added to the calendar.`,
      );
      onSaved();
    });
  };

  const remove = async (): Promise<void> => {
    if (!row) return;
    setDeleting(true);
    try {
      const res = await deleteSabcrmHoliday(row.id);
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
    <Drawer
      open={open}
      onOpenChange={(next) => !next && !busy && onClose()}
      side="right"
    >
      <DrawerContent
        aria-describedby="holiday-form-desc"
        className="fdoc-form-drawer"
      >
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? 'New holiday' : `Edit ${row?.name ?? 'holiday'}`}
          </DrawerTitle>
          <DrawerDescription id="holiday-form-desc">
            {mode === 'create'
              ? 'Add a date to the calendar — attendance and payroll runs treat it as non-working.'
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
              <Field label="Date" required error={errors.date}>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => patch({ date: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Name" required error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Republic Day"
                  disabled={busy}
                />
              </Field>
              <Field label="Type">
                <SelectField
                  value={form.holidayType}
                  onChange={(v) =>
                    patch({ holidayType: (v || 'national') as CrmHolidayType })
                  }
                  options={TYPE_OPTIONS}
                  aria-label="Holiday type"
                />
              </Field>
              <Field label="Recurring" help="Repeats on this day every year.">
                <Switch
                  label="Every year"
                  checked={form.recurring}
                  onCheckedChange={(v) => patch({ recurring: v })}
                  disabled={busy}
                />
              </Field>

              <div className="fdoc-form-grid__full">
                <Field
                  label="Applicable locations"
                  help="Restrict to specific work locations (empty = project-wide)."
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={form.locationDraft}
                        onChange={(e) => patch({ locationDraft: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addLocation();
                          }
                        }}
                        placeholder="mumbai"
                        disabled={busy}
                        aria-label="Add a location"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        iconLeft={Plus}
                        disabled={busy || !form.locationDraft.trim()}
                        onClick={addLocation}
                      >
                        Add
                      </Button>
                    </div>
                    {form.locations.length > 0 ? (
                      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                        {form.locations.map((l) => (
                          <li
                            key={l}
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                          >
                            {l}
                            <button
                              type="button"
                              aria-label={`Remove ${l}`}
                              disabled={busy}
                              onClick={() =>
                                patch({
                                  locations: form.locations.filter(
                                    (x) => x !== l,
                                  ),
                                })
                              }
                            >
                              <X size={12} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs opacity-70">
                        Applies project-wide.
                      </span>
                    )}
                  </div>
                </Field>
              </div>

              <div className="fdoc-form-grid__full">
                <Field label="Notes">
                  <Textarea
                    value={form.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    rows={3}
                    placeholder="Observed nationally; offices closed…"
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
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={deleting}
            >
              {mode === 'create' ? 'Add holiday' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>

        <AlertDialog
          open={confirmDelete}
          onOpenChange={(next) => !next && !deleting && setConfirmDelete(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this holiday?</AlertDialogTitle>
              <AlertDialogDescription>
                {row?.name} is removed from the calendar permanently.
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
                Delete holiday
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── List client ─────────────────────────────────────────────── */

export interface HolidaysClientProps {
  initialRows: SabcrmHolidayListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  /** `?open=<id>` deep link — opens the edit drawer. */
  initialOpenId: string | null;
}

export function HolidaysClient({
  initialRows,
  initialHasMore,
  initialError,
  initialOpenId,
}: HolidaysClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmHolidayListRow | null>(
    null,
  );

  // Deep link / row navigation: `?open=<id>` → load + open the drawer.
  React.useEffect(() => {
    if (!initialOpenId) return;
    let stale = false;
    void (async () => {
      const res = await getSabcrmHoliday(initialOpenId);
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
    if (initialOpenId) router.replace(PEOPLE_HOLIDAYS_PATH, { scroll: false });
  }, [initialOpenId, router]);

  const onSaved = React.useCallback(() => {
    setRefreshToken((t) => t + 1);
    closeEditor();
    router.refresh();
  }, [closeEditor, router]);

  const config = React.useMemo<DocListPageConfig<SabcrmHolidayListRow>>(
    () => ({
      title: 'Holidays',
      description:
        'The holiday calendar — national, regional and optional days the roster observes.',
      icon: CalendarDays,
      entity: { singular: 'holiday', plural: 'holidays' },
      columns: COLUMNS,
      statuses: HOLIDAY_TYPES,
      fetchPage: async (filters) => {
        const res = await listSabcrmHolidaysPage(toHolidayFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmHolidayRows(toHolidayFilters(filters)),
      csvFileName: 'holidays.csv',
      rowHref: (row) => holidayOpenHref(row.id),
      rowLabel: (row) => `holiday ${row.name}`,
      bulkActions: [
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected holidays?',
            description:
              'The selected days are removed from the calendar permanently.',
            actionLabel: 'Delete holidays',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmHoliday(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [],
  );

  return (
    <>
      <DocListPage
        config={config}
        primaryAction={
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            New holiday
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />
      <HolidayEditorDrawer
        open={editorOpen}
        row={editing}
        onClose={closeEditor}
        onSaved={onSaved}
      />
    </>
  );
}
