"use client";

import * as React from "react";
import { Check, Clock, Plus, Search, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
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
  Switch,
  useToast,
  type DataTableColumn,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell } from "@/components/sabhrm/page-toolkit";
import {
  approveTimeLog,
  createTimeLog,
  deleteTimeLog,
  listTimeLogs,
  type TimeLogFormValues,
  type TimeLogPickerOptions,
} from "@/app/actions/sabhrm/time-logs.actions";
import type { TimeLogRow, Paginated } from "@/lib/sabhrm/types";

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: TimeLogFormValues = {
  employeeId: "",
  date: todayISO(),
  project: "",
  task: "",
  hours: 0,
  billable: false,
};

export function TimeLogsClient({
  initial,
  options,
  loadError,
}: {
  initial: Paginated<TimeLogRow>;
  options: TimeLogPickerOptions;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<TimeLogRow[]>(initial.rows);
  const [q, setQ] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<TimeLogFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const employeeOptions: SelectOption[] = React.useMemo(
    () => [{ value: "", label: "Select employee…" }, ...options.employees],
    [options.employees],
  );

  const refresh = React.useCallback(
    async (nextQ = q, nextFrom = from, nextTo = to) => {
      setLoading(true);
      const res = await listTimeLogs({
        q: nextQ || undefined,
        from: nextFrom || undefined,
        to: nextTo || undefined,
        pageSize: 50,
      });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load time logs", description: res.error, variant: "destructive" });
    },
    [q, from, to, toast],
  );

  // Debounced search + date filter.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(q, from, to), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, from, to]);

  const patch = (p: Partial<TimeLogFormValues>) => setForm((f) => ({ ...f, ...p }));

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const res = await createTimeLog(form);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    toast({ title: "Time logged", description: `${res.data.hours}h logged for ${res.data.employeeName}.` });
    setOpen(false);
    setForm(EMPTY_FORM);
    setRows((r) => [res.data, ...r]);
  }, [form, toast]);

  const approve = React.useCallback(
    async (row: TimeLogRow) => {
      const res = await approveTimeLog(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't approve", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.map((x) => (x.id === row.id ? res.data : x)));
      toast({ title: "Time log approved" });
    },
    [toast],
  );

  const remove = React.useCallback(
    async (row: TimeLogRow) => {
      if (!window.confirm(`Delete this time log for ${row.employeeName}?`)) return;
      const res = await deleteTimeLog(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Time log deleted" });
    },
    [toast],
  );

  const columns: DataTableColumn<TimeLogRow>[] = [
    {
      key: "employeeName",
      header: "Employee",
      render: (r) => <span className="text-sm font-medium text-[var(--st-text)]">{r.employeeName}</span>,
    },
    { key: "date", header: "Date", render: (r) => <span className="text-sm tabular-nums">{r.date || "—"}</span> },
    { key: "project", header: "Project", render: (r) => r.project ?? "—" },
    { key: "task", header: "Task", render: (r) => r.task ?? "—" },
    {
      key: "hours",
      header: "Hours",
      align: "right",
      render: (r) => <span className="text-sm tabular-nums">{r.hours}</span>,
    },
    {
      key: "billable",
      header: "Billable",
      render: (r) =>
        r.billable ? (
          <Badge variant={TONE_BADGE.positive}>Billable</Badge>
        ) : (
          <Badge variant="outline">Non-billable</Badge>
        ),
    },
    {
      key: "approved",
      header: "Approved",
      render: (r) =>
        r.approved ? (
          <Badge variant={TONE_BADGE.positive}>Approved</Badge>
        ) : (
          <Badge variant={TONE_BADGE.warning}>Pending</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {!r.approved ? (
            <Button
              variant="outline"
              size="sm"
              iconLeft={Check}
              onClick={(e) => {
                e.stopPropagation();
                void approve(r);
              }}
            >
              Approve
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            aria-label={`Delete time log for ${r.employeeName}`}
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
      title="Timesheets"
      description="Track the hours your team logs against projects and tasks, mark them billable, and approve them."
      actions={
        <Button
          variant="primary"
          size="sm"
          iconLeft={Plus}
          onClick={() => {
            setForm({ ...EMPTY_FORM, date: todayISO() });
            setFormErr(null);
            setOpen(true);
          }}
        >
          Log time
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employee, project, task…"
            className="pl-8"
          />
        </div>
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<Clock aria-hidden />}
            title={loadError ? "Couldn't load time logs" : "No time logged yet"}
            description={loadError ?? "Log your team's hours against projects and tasks to start tracking effort."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
                  Log time
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

      {/* Log time dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log time</DialogTitle>
            <DialogDescription>
              Record hours an employee worked on a project or task. New logs start as pending approval.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Employee">
              <SelectField
                value={form.employeeId}
                options={employeeOptions}
                onChange={(v) => patch({ employeeId: String(v) })}
              />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} />
            </Field>
            <Field label="Project">
              <Input
                value={form.project ?? ""}
                onChange={(e) => patch({ project: e.target.value })}
                placeholder="e.g. Website revamp"
              />
            </Field>
            <Field label="Task">
              <Input
                value={form.task ?? ""}
                onChange={(e) => patch({ task: e.target.value })}
                placeholder="e.g. Homepage layout"
              />
            </Field>
            <Field label="Hours">
              <Input
                type="number"
                min="0"
                max="24"
                step="0.25"
                value={form.hours ? String(form.hours) : ""}
                onChange={(e) => patch({ hours: e.target.value ? Number(e.target.value) : 0 })}
                placeholder="0"
              />
            </Field>
            <Field label="Billable">
              <div className="flex h-9 items-center">
                <Switch
                  checked={Boolean(form.billable)}
                  onCheckedChange={(checked) => patch({ billable: checked })}
                />
              </div>
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
              iconLeft={Plus}
              loading={saving}
              disabled={saving || !form.employeeId || !form.date || !form.hours || form.hours <= 0}
              onClick={() => void submit()}
            >
              Log time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
