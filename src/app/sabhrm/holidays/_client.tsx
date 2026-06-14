"use client";

import * as React from "react";
import { CalendarDays, Pencil, Plus, Search, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  SelectField,
  useToast,
  type DataTableColumn,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell } from "@/components/sabhrm/page-toolkit";
import {
  createHoliday,
  deleteHoliday,
  listHolidays,
  updateHoliday,
  type HolidayFormValues,
  type HolidayType,
} from "@/app/actions/sabhrm/holidays.actions";
import type { HolidayRow, Paginated } from "@/lib/sabhrm/types";

const TYPE_LABELS: Record<HolidayType, string> = {
  public: "Public",
  restricted: "Restricted",
  company: "Company",
};

const TYPE_OPTIONS: SelectOption[] = (Object.keys(TYPE_LABELS) as HolidayType[]).map(
  (value) => ({ value, label: TYPE_LABELS[value] }),
);

// Map a SabHRM tone → a valid 20ui Badge variant. NEVER use "danger" (a tone).
const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

const TYPE_BADGE: Record<HolidayType, "default" | "success" | "warning" | "destructive"> = {
  public: TONE_BADGE.positive,
  restricted: TONE_BADGE.warning,
  company: TONE_BADGE.default,
};

const EMPTY_FORM: HolidayFormValues = {
  name: "",
  date: "",
  type: "public",
  recurring: false,
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function HolidaysClient({
  initial,
  loadError,
}: {
  initial: Paginated<HolidayRow>;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<HolidayRow[]>(initial.rows);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<HolidayFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    async (nextQ = q) => {
      setLoading(true);
      const res = await listHolidays({ q: nextQ || undefined, pageSize: 100 });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load holidays", description: res.error, variant: "destructive" });
    },
    [q, toast],
  );

  // Debounced search.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const patch = (p: Partial<HolidayFormValues>) => setForm((f) => ({ ...f, ...p }));

  const openAdd = React.useCallback(() => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormErr(null);
    setOpen(true);
  }, []);

  const openEdit = React.useCallback((row: HolidayRow) => {
    setEditId(row.id);
    setForm({ name: row.name, date: row.date, type: row.type, recurring: row.recurring });
    setFormErr(null);
    setOpen(true);
  }, []);

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const res = editId
      ? await updateHoliday(editId, form)
      : await createHoliday(form);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    const saved = res.data;
    setOpen(false);
    setForm(EMPTY_FORM);
    if (editId) {
      setRows((r) =>
        [...r.map((x) => (x.id === saved.id ? saved : x))].sort((a, b) => a.date.localeCompare(b.date)),
      );
      toast({ title: "Holiday updated", description: saved.name });
    } else {
      setRows((r) => [...r, saved].sort((a, b) => a.date.localeCompare(b.date)));
      toast({ title: "Holiday added", description: saved.name });
    }
    setEditId(null);
  }, [editId, form, toast]);

  const remove = React.useCallback(
    async (row: HolidayRow) => {
      if (!window.confirm(`Remove "${row.name}" from the holiday calendar?`)) return;
      const res = await deleteHoliday(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't remove", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Holiday removed" });
    },
    [toast],
  );

  const columns: DataTableColumn<HolidayRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => <span className="text-sm font-medium text-[var(--st-text)]">{r.name}</span>,
    },
    {
      key: "date",
      header: "Date",
      render: (r) => <span className="text-sm tabular-nums">{formatDate(r.date)}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: (r) => <Badge variant={TYPE_BADGE[r.type]}>{TYPE_LABELS[r.type]}</Badge>,
    },
    {
      key: "recurring",
      header: "Recurring",
      render: (r) =>
        r.recurring ? (
          <Badge variant="outline">Yearly</Badge>
        ) : (
          <span className="text-sm text-[var(--st-text-secondary)]">No</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Pencil}
            aria-label={`Edit ${r.name}`}
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            aria-label={`Remove ${r.name}`}
            onClick={(e) => {
              e.stopPropagation();
              void remove(r);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <SabHrmPageShell
      title="Holidays"
      description="Your organization's holiday calendar. Mark public, restricted, and company holidays — flag the ones that repeat every year."
      actions={
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openAdd}>
          Add holiday
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search holidays…"
            className="pl-8"
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<CalendarDays aria-hidden />}
            title={loadError ? "Couldn't load holidays" : "No holidays yet"}
            description={loadError ?? "Add your first holiday to start building the calendar."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={openAdd}>
                  Add holiday
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            hover
            density="comfortable"
          />
        </Card>
      )}

      {/* Add / edit holiday dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit holiday" : "Add holiday"}</DialogTitle>
            <DialogDescription>
              {editId
                ? "Update the holiday details on your calendar."
                : "Add a holiday to your organization's calendar."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Independence Day"
                autoFocus
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => patch({ date: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <SelectField
                value={form.type}
                options={TYPE_OPTIONS}
                onChange={(v) => patch({ type: String(v) as HolidayType })}
              />
            </Field>
            <Field label="Recurring">
              <Checkbox
                checked={!!form.recurring}
                onChange={(e) => patch({ recurring: e.target.checked })}
                label="Repeats every year"
              />
            </Field>
          </div>

          {formErr ? <p className="mt-1 text-sm text-[var(--st-status-bad,#dc2626)]">{formErr}</p> : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={editId ? Pencil : Plus}
              loading={saving}
              disabled={saving || !form.name.trim() || !form.date}
              onClick={() => void submit()}
            >
              {editId ? "Save changes" : "Add holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
