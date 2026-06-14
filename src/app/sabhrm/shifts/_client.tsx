"use client";

import * as React from "react";
import { Clock, Pencil, Plus, Search, Trash2 } from "lucide-react";

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
  Switch,
  useToast,
  type DataTableColumn,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell } from "@/components/sabhrm/page-toolkit";
import {
  createShift,
  deleteShift,
  listShifts,
  setShiftActive,
  updateShift,
  type ShiftFormValues,
} from "@/app/actions/sabhrm/shifts.actions";
import type { ShiftRow, Paginated } from "@/lib/sabhrm/types";

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const EMPTY_FORM: ShiftFormValues = {
  name: "",
  startTime: "09:00",
  endTime: "18:00",
  breakMinutes: 60,
  weekOffs: [0],
  active: true,
};

export function ShiftsClient({
  initial,
  loadError,
}: {
  initial: Paginated<ShiftRow>;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<ShiftRow[]>(initial.rows);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<ShiftFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    async (nextQ = q) => {
      setLoading(true);
      const res = await listShifts({ q: nextQ || undefined, pageSize: 50 });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load shifts", description: res.error, variant: "destructive" });
    },
    [q, toast],
  );

  // Debounced search.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const patch = (p: Partial<ShiftFormValues>) => setForm((f) => ({ ...f, ...p }));

  const toggleWeekOff = (day: number) =>
    setForm((f) => ({
      ...f,
      weekOffs: f.weekOffs.includes(day)
        ? f.weekOffs.filter((d) => d !== day)
        : [...f.weekOffs, day].sort((a, b) => a - b),
    }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErr(null);
    setOpen(true);
  };

  const openEdit = (row: ShiftRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      startTime: row.startTime,
      endTime: row.endTime,
      breakMinutes: row.breakMinutes,
      weekOffs: [...row.weekOffs],
      active: row.active,
    });
    setFormErr(null);
    setOpen(true);
  };

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const res = editingId ? await updateShift(editingId, form) : await createShift(form);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    toast({ title: editingId ? "Shift updated" : "Shift added", description: res.data.name });
    setOpen(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setRows((r) =>
      editingId ? r.map((x) => (x.id === res.data.id ? res.data : x)) : [res.data, ...r],
    );
  }, [editingId, form, toast]);

  const remove = React.useCallback(
    async (row: ShiftRow) => {
      if (!window.confirm(`Delete the "${row.name}" shift?`)) return;
      const res = await deleteShift(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Shift deleted" });
    },
    [toast],
  );

  const toggleActive = React.useCallback(
    async (row: ShiftRow, next: boolean) => {
      // Optimistic flip.
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, active: next } : x)));
      const res = await setShiftActive(row.id, next);
      if (!res.ok) {
        setRows((r) => r.map((x) => (x.id === row.id ? { ...x, active: row.active } : x)));
        toast({ title: "Couldn't update", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.map((x) => (x.id === row.id ? res.data : x)));
    },
    [toast],
  );

  const columns: DataTableColumn<ShiftRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--st-text)]">{r.name}</span>
          {r.weekOffs.length > 0 ? (
            <span className="block truncate text-xs text-[var(--st-text-secondary)]">
              Off: {r.weekOffs.map((d) => WEEKDAYS[d]?.label).filter(Boolean).join(", ")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "timing",
      header: "Timing",
      render: (r) => (
        <span className="text-sm tabular-nums">
          {r.startTime}–{r.endTime}
        </span>
      ),
    },
    {
      key: "breakMinutes",
      header: "Break",
      render: (r) => <span className="text-sm tabular-nums">{r.breakMinutes} min</span>,
    },
    {
      key: "employeeCount",
      header: "Employees",
      align: "right",
      render: (r) => <span className="text-sm tabular-nums">{r.employeeCount}</span>,
    },
    {
      key: "active",
      header: "Active",
      render: (r) => (
        <Badge variant={r.active ? "success" : "outline"}>{r.active ? "Active" : "Inactive"}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Switch
            checked={r.active}
            onCheckedChange={(next) => void toggleActive(r, next)}
            aria-label={`Toggle ${r.name}`}
          />
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
            aria-label={`Delete ${r.name}`}
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
      title="Shifts"
      description="Define work shifts with timings, breaks, and weekly off days. Assign them to employees from their profile."
      actions={
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
          Add shift
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search shifts…"
            className="pl-8"
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<Clock aria-hidden />}
            title={loadError ? "Couldn't load shifts" : "No shifts yet"}
            description={loadError ?? "Add your first shift to define standard work timings for your team."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
                  Add shift
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
            density={loading ? "comfortable" : "comfortable"}
          />
        </Card>
      )}

      {/* Add / edit shift dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit shift" : "Add shift"}</DialogTitle>
            <DialogDescription>
              Set the daily timing, paid break, and which days of the week are off.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Shift name">
                <Input
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="e.g. General, Morning, Night"
                  autoFocus
                />
              </Field>
            </div>
            <Field label="Start time">
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => patch({ startTime: e.target.value })}
              />
            </Field>
            <Field label="End time">
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => patch({ endTime: e.target.value })}
              />
            </Field>
            <Field label="Break (minutes)">
              <Input
                type="number"
                min={0}
                value={form.breakMinutes}
                onChange={(e) =>
                  patch({ breakMinutes: e.target.value ? Number(e.target.value) : 0 })
                }
                placeholder="0"
              />
            </Field>
          </div>

          <div className="mt-3">
            <Field label="Weekly offs">
              <div className="flex flex-wrap gap-3 pt-1">
                {WEEKDAYS.map((d) => (
                  <Checkbox
                    key={d.value}
                    label={d.label}
                    checked={form.weekOffs.includes(d.value)}
                    onChange={() => toggleWeekOff(d.value)}
                  />
                ))}
              </div>
            </Field>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-[var(--st-text)]">Active</p>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Inactive shifts can&apos;t be assigned to employees.
              </p>
            </div>
            <Switch
              checked={form.active}
              onCheckedChange={(next) => patch({ active: next })}
              aria-label="Toggle shift active"
            />
          </div>

          {formErr ? (
            <p className="mt-1 text-sm text-[var(--st-status-bad,#dc2626)]">{formErr}</p>
          ) : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={editingId ? Pencil : Plus}
              loading={saving}
              disabled={saving || !form.name.trim() || !form.startTime || !form.endTime}
              onClick={() => void submit()}
            >
              {editingId ? "Save changes" : "Add shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
