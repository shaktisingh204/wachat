"use client";

import * as React from "react";
import { BadgeCheck, Pencil, Plus, Search, Trash2 } from "lucide-react";

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
  createDesignation,
  deleteDesignation,
  listDesignations,
  updateDesignation,
  type DesignationFormValues,
  type DesignationPickerOptions,
} from "@/app/actions/sabhrm/designations.actions";
import type { DesignationRow, Paginated } from "@/lib/sabhrm/types";

const EMPTY_FORM: DesignationFormValues = {
  name: "",
};

export function DesignationsClient({
  initial,
  options,
  loadError,
}: {
  initial: Paginated<DesignationRow>;
  options: DesignationPickerOptions;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<DesignationRow[]>(initial.rows);
  const [q, setQ] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<DesignationFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const deptOptions: SelectOption[] = options.departments;

  const refresh = React.useCallback(
    async (nextQ = q, nextDept = deptFilter) => {
      setLoading(true);
      const res = await listDesignations({
        q: nextQ || undefined,
        departmentId: nextDept || undefined,
        pageSize: 50,
      });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load designations", description: res.error, variant: "destructive" });
    },
    [q, deptFilter, toast],
  );

  // Debounced search.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(q, deptFilter), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, deptFilter]);

  const patch = (p: Partial<DesignationFormValues>) => setForm((f) => ({ ...f, ...p }));

  const openCreate = React.useCallback(() => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormErr(null);
    setOpen(true);
  }, []);

  const openEdit = React.useCallback((row: DesignationRow) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      level: row.level ?? undefined,
      departmentId: row.departmentId ?? undefined,
    });
    setFormErr(null);
    setOpen(true);
  }, []);

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const res = editId ? await updateDesignation(editId, form) : await createDesignation(form);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    if (editId) {
      setRows((r) => r.map((x) => (x.id === res.data.id ? res.data : x)));
      toast({ title: "Designation updated", description: res.data.name });
    } else {
      setRows((r) => [res.data, ...r]);
      toast({ title: "Designation added", description: res.data.name });
    }
    setOpen(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }, [editId, form, toast]);

  const remove = React.useCallback(
    async (row: DesignationRow) => {
      if (!window.confirm(`Delete the "${row.name}" designation?`)) return;
      const res = await deleteDesignation(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Designation deleted" });
    },
    [toast],
  );

  const columns: DataTableColumn<DesignationRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => <span className="text-sm font-medium text-[var(--st-text)]">{r.name}</span>,
    },
    {
      key: "level",
      header: "Level",
      render: (r) => (r.level != null ? <span className="text-sm tabular-nums">{r.level}</span> : "—"),
    },
    { key: "departmentName", header: "Department", render: (r) => r.departmentName ?? "—" },
    {
      key: "employeeCount",
      header: "Employees",
      render: (r) => <Badge variant="outline">{r.employeeCount}</Badge>,
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
      title="Designations"
      description="Job titles and seniority levels. Map each designation to a department to structure your org."
      actions={
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
          Add designation
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search designations…"
            className="pl-8"
          />
        </div>
        <div className="w-52">
          <SelectField
            value={deptFilter}
            options={[{ value: "", label: "All departments" }, ...deptOptions]}
            onChange={(v) => setDeptFilter(String(v))}
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<BadgeCheck aria-hidden />}
            title={loadError ? "Couldn't load designations" : "No designations yet"}
            description={loadError ?? "Add your first designation to define job titles across the org."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
                  Add designation
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

      {/* Add / edit designation dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit designation" : "Add designation"}</DialogTitle>
            <DialogDescription>
              A designation is a job title (e.g. Senior Engineer). Level is an optional
              numeric rank to order seniority.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <Input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Senior Engineer"
                autoFocus
              />
            </Field>
            <Field label="Level">
              <Input
                type="number"
                value={form.level ?? ""}
                onChange={(e) => patch({ level: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="optional"
              />
            </Field>
            <Field label="Department">
              <SelectField
                value={form.departmentId ?? ""}
                options={[{ value: "", label: "—" }, ...deptOptions]}
                onChange={(v) => patch({ departmentId: String(v) || undefined })}
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
              disabled={saving || !form.name.trim()}
              onClick={() => void submit()}
            >
              {editId ? "Save changes" : "Add designation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
