"use client";

import * as React from "react";
import { Building2, Pencil, Plus, Search, Trash2 } from "lucide-react";

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
  useToast,
  type DataTableColumn,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell } from "@/components/sabhrm/page-toolkit";
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
  type DepartmentFormValues,
  type DepartmentPickerOptions,
} from "@/app/actions/sabhrm/departments.actions";
import type { DepartmentRow, Paginated } from "@/lib/sabhrm/types";

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

const EMPTY_FORM: DepartmentFormValues = {
  name: "",
  code: "",
  headEmployeeId: "",
};

export function DepartmentsClient({
  initial,
  options,
  loadError,
}: {
  initial: Paginated<DepartmentRow>;
  options: DepartmentPickerOptions;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<DepartmentRow[]>(initial.rows);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<DepartmentFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const headOptions: SelectOption[] = React.useMemo(
    () => [{ value: "", label: "—" }, ...options.heads],
    [options.heads],
  );

  const refresh = React.useCallback(
    async (nextQ = q) => {
      setLoading(true);
      const res = await listDepartments({ q: nextQ || undefined, pageSize: 50 });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load departments", description: res.error, variant: "destructive" });
    },
    [q, toast],
  );

  // Debounced search.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const patch = (p: Partial<DepartmentFormValues>) => setForm((f) => ({ ...f, ...p }));

  const openCreate = React.useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErr(null);
    setOpen(true);
  }, []);

  const openEdit = React.useCallback((row: DepartmentRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      code: row.code ?? "",
      headEmployeeId: row.headEmployeeId ?? "",
    });
    setFormErr(null);
    setOpen(true);
  }, []);

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const res = editingId
      ? await updateDepartment(editingId, form)
      : await createDepartment(form);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    if (editingId) {
      toast({ title: "Department updated", description: res.data.name });
      setRows((r) => r.map((x) => (x.id === res.data.id ? res.data : x)));
    } else {
      toast({ title: "Department added", description: res.data.name });
      setRows((r) => [res.data, ...r]);
    }
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }, [editingId, form, toast]);

  const remove = React.useCallback(
    async (row: DepartmentRow) => {
      if (!window.confirm(`Delete the "${row.name}" department?`)) return;
      const res = await deleteDepartment(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Department deleted" });
    },
    [toast],
  );

  const columns: DataTableColumn<DepartmentRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
            <Building2 className="h-4 w-4" aria-hidden />
          </span>
          <span className="truncate text-sm font-medium text-[var(--st-text)]">{r.name}</span>
        </div>
      ),
    },
    {
      key: "code",
      header: "Code",
      render: (r) => <span className="text-sm tabular-nums">{r.code ?? "—"}</span>,
    },
    { key: "headEmployeeName", header: "Head", render: (r) => r.headEmployeeName ?? "—" },
    {
      key: "employeeCount",
      header: "Employees",
      render: (r) => <Badge variant={TONE_BADGE.default}>{r.employeeCount}</Badge>,
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
      title="Departments"
      description="Organize your team into departments and assign a department head."
      actions={
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
          Add department
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="pl-8"
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<Building2 aria-hidden />}
            title={loadError ? "Couldn't load departments" : "No departments yet"}
            description={loadError ?? "Add your first department to start organizing your team."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
                  Add department
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

      {/* Add / edit department dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit department" : "Add department"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this department's details."
                : "Create a department and optionally assign a department head."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} autoFocus placeholder="Engineering" />
            </Field>
            <Field label="Code">
              <Input
                value={form.code ?? ""}
                onChange={(e) => patch({ code: e.target.value })}
                placeholder="ENG"
              />
            </Field>
            <Field label="Department head">
              <SelectField
                value={form.headEmployeeId ?? ""}
                options={headOptions}
                onChange={(v) => patch({ headEmployeeId: String(v) || undefined })}
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
              iconLeft={editingId ? Pencil : Plus}
              loading={saving}
              disabled={saving || !form.name.trim()}
              onClick={() => void submit()}
            >
              {editingId ? "Save changes" : "Add department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
