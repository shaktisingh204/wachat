"use client";

import * as React from "react";
import { Pencil, Plus, Search, Target, Trash2 } from "lucide-react";

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
  Textarea,
  useToast,
  type DataTableColumn,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell, statusTone } from "@/components/sabhrm/page-toolkit";
import {
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
  type GoalFormValues,
  type GoalPickerOptions,
} from "@/app/actions/sabhrm/goals.actions";
import {
  type GoalRow,
  type GoalStatus,
  type Paginated,
} from "@/lib/sabhrm/types";

const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  overdue: "Overdue",
};

const STATUS_OPTIONS: SelectOption[] = Object.entries(GOAL_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

const EMPTY_FORM: GoalFormValues = {
  employeeId: "",
  title: "",
  description: "",
  metric: "",
  target: undefined,
  progress: 0,
  dueDate: "",
  status: "not_started",
};

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
        <div
          className="h-full rounded-full bg-[var(--st-accent,#2563eb)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-[var(--st-text-secondary)]">{pct}%</span>
    </div>
  );
}

export function GoalsClient({
  initial,
  options,
  loadError,
}: {
  initial: Paginated<GoalRow>;
  options: GoalPickerOptions;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<GoalRow[]>(initial.rows);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<GoalFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    async (nextQ = q, nextStatus = statusFilter) => {
      setLoading(true);
      const res = await listGoals({ q: nextQ || undefined, status: nextStatus || undefined, pageSize: 50 });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load goals", description: res.error, variant: "destructive" });
    },
    [q, statusFilter, toast],
  );

  // Debounced search + status filter.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(q, statusFilter), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter]);

  const patch = (p: Partial<GoalFormValues>) => setForm((f) => ({ ...f, ...p }));

  const openCreate = React.useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErr(null);
    setOpen(true);
  }, []);

  const openEdit = React.useCallback((row: GoalRow) => {
    setEditingId(row.id);
    setForm({
      employeeId: row.employeeId,
      title: row.title,
      description: row.description ?? "",
      metric: row.metric ?? "",
      target: row.target ?? undefined,
      progress: row.progress,
      dueDate: row.dueDate ?? "",
      status: row.status,
    });
    setFormErr(null);
    setOpen(true);
  }, []);

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const res = editingId ? await updateGoal(editingId, form) : await createGoal(form);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    toast({ title: editingId ? "Goal updated" : "Goal added", description: res.data.title });
    setOpen(false);
    setForm(EMPTY_FORM);
    if (editingId) {
      const saved = res.data;
      setRows((r) => r.map((x) => (x.id === saved.id ? saved : x)));
    } else {
      setRows((r) => [res.data, ...r]);
    }
    setEditingId(null);
  }, [editingId, form, toast]);

  const remove = React.useCallback(
    async (row: GoalRow) => {
      if (!window.confirm(`Delete the goal "${row.title}"?`)) return;
      const res = await deleteGoal(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Goal deleted" });
    },
    [toast],
  );

  const columns: DataTableColumn<GoalRow>[] = [
    {
      key: "employeeName",
      header: "Employee",
      render: (r) => <span className="text-sm font-medium text-[var(--st-text)]">{r.employeeName}</span>,
    },
    {
      key: "title",
      header: "Title",
      render: (r) => (
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--st-text)]">{r.title}</span>
          {r.metric ? (
            <span className="block truncate text-xs text-[var(--st-text-secondary)]">{r.metric}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      render: (r) => <ProgressBar value={r.progress} />,
    },
    { key: "dueDate", header: "Due", render: (r) => r.dueDate ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={TONE_BADGE[statusTone(r.status)]}>{GOAL_STATUS_LABELS[r.status]}</Badge>
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
            aria-label={`Edit ${r.title}`}
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            aria-label={`Delete ${r.title}`}
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
      title="Goals & OKRs"
      description="Track objectives and key results for your team. Set targets, log progress, and keep everyone aligned."
      actions={
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
          Add goal
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search goals, employee, metric…"
            className="pl-8"
          />
        </div>
        <div className="w-44">
          <SelectField
            value={statusFilter}
            options={[{ value: "", label: "All statuses" }, ...STATUS_OPTIONS]}
            onChange={(v) => setStatusFilter(String(v))}
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<Target aria-hidden />}
            title={loadError ? "Couldn't load goals" : "No goals yet"}
            description={loadError ?? "Add your first goal to start tracking objectives and key results."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
                  Add goal
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

      {/* Add / edit goal dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit goal" : "Add goal"}</DialogTitle>
            <DialogDescription>
              Define a goal for an employee, set a measurable target, and track progress over time.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Employee">
              <SelectField
                value={form.employeeId ?? ""}
                options={[{ value: "", label: "—" }, ...options.employees]}
                onChange={(v) => patch({ employeeId: String(v) })}
              />
            </Field>
            <Field label="Status">
              <SelectField
                value={form.status ?? "not_started"}
                options={STATUS_OPTIONS}
                onChange={(v) => patch({ status: v as GoalStatus })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Title">
                <Input value={form.title} onChange={(e) => patch({ title: e.target.value })} autoFocus placeholder="e.g. Ship the Q3 onboarding revamp" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea
                  value={form.description ?? ""}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={3}
                  placeholder="What does success look like?"
                />
              </Field>
            </div>
            <Field label="Metric">
              <Input
                value={form.metric ?? ""}
                onChange={(e) => patch({ metric: e.target.value })}
                placeholder="e.g. Activation rate"
              />
            </Field>
            <Field label="Target">
              <Input
                type="number"
                value={form.target ?? ""}
                onChange={(e) => patch({ target: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0"
              />
            </Field>
            <Field label="Progress (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.progress ?? 0}
                onChange={(e) => patch({ progress: e.target.value ? Number(e.target.value) : 0 })}
                placeholder="0"
              />
            </Field>
            <Field label="Due date">
              <Input type="date" value={form.dueDate ?? ""} onChange={(e) => patch({ dueDate: e.target.value })} />
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
              iconLeft={editingId ? Pencil : Plus}
              loading={saving}
              disabled={saving || !form.title.trim() || !form.employeeId}
              onClick={() => void submit()}
            >
              {editingId ? "Save changes" : "Add goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
