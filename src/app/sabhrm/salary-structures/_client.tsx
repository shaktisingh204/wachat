"use client";

import * as React from "react";
import { Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";

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
import { SabHrmPageShell, formatMoney } from "@/components/sabhrm/page-toolkit";
import {
  createSalaryStructure,
  deleteSalaryStructure,
  listSalaryStructures,
  updateSalaryStructure,
  type SalaryStructureFormValues,
} from "@/app/actions/sabhrm/salary-structures.actions";
import type {
  Paginated,
  SalaryComponent,
  SalaryStructureRow,
} from "@/lib/sabhrm/types";

const KIND_OPTIONS: SelectOption[] = [
  { value: "earning", label: "Earning" },
  { value: "deduction", label: "Deduction" },
];

const CALC_OPTIONS: SelectOption[] = [
  { value: "flat", label: "Flat amount" },
  { value: "percent_of_basic", label: "% of basic" },
];

const EMPTY_COMPONENT: SalaryComponent = {
  name: "",
  kind: "earning",
  calc: "flat",
  value: 0,
};

const EMPTY_FORM: SalaryStructureFormValues = {
  name: "",
  ctc: 0,
  components: [],
};

export function SalaryStructuresClient({
  initial,
  loadError,
}: {
  initial: Paginated<SalaryStructureRow>;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SalaryStructureRow[]>(initial.rows);
  const [q, setQ] = React.useState("");
  const [, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<SalaryStructureFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    async (nextQ = q) => {
      setLoading(true);
      const res = await listSalaryStructures({ q: nextQ || undefined, pageSize: 50 });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load salary structures", description: res.error, variant: "destructive" });
    },
    [q, toast],
  );

  // Debounced search.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const patch = (p: Partial<SalaryStructureFormValues>) => setForm((f) => ({ ...f, ...p }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErr(null);
    setOpen(true);
  };

  const openEdit = (row: SalaryStructureRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      ctc: row.ctc,
      components: row.components.map((c) => ({ ...c })),
    });
    setFormErr(null);
    setOpen(true);
  };

  /* ── component editor helpers ──────────────────────────────────────── */

  const addComponent = () =>
    setForm((f) => ({ ...f, components: [...f.components, { ...EMPTY_COMPONENT }] }));

  const updateComponent = (idx: number, p: Partial<SalaryComponent>) =>
    setForm((f) => ({
      ...f,
      components: f.components.map((c, i) => (i === idx ? { ...c, ...p } : c)),
    }));

  const removeComponent = (idx: number) =>
    setForm((f) => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));

  /* ── submit ────────────────────────────────────────────────────────── */

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const payload: SalaryStructureFormValues = {
      name: form.name,
      ctc: form.ctc,
      components: form.components,
    };
    const res = editingId
      ? await updateSalaryStructure(editingId, payload)
      : await createSalaryStructure(payload);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    toast({ title: editingId ? "Salary structure updated" : "Salary structure added" });
    setOpen(false);
    setForm(EMPTY_FORM);
    if (editingId) {
      setRows((r) => r.map((x) => (x.id === res.data.id ? res.data : x)));
    } else {
      setRows((r) => [res.data, ...r]);
    }
    setEditingId(null);
  }, [editingId, form, toast]);

  const remove = React.useCallback(
    async (row: SalaryStructureRow) => {
      if (!window.confirm(`Delete "${row.name}"? This removes the salary structure.`)) return;
      const res = await deleteSalaryStructure(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Salary structure deleted" });
    },
    [toast],
  );

  const columns: DataTableColumn<SalaryStructureRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => <span className="text-sm font-medium text-[var(--st-text)]">{r.name}</span>,
    },
    {
      key: "ctc",
      header: "CTC",
      align: "right",
      render: (r) => <span className="text-sm tabular-nums">{formatMoney(r.ctc)}</span>,
    },
    {
      key: "components",
      header: "Components",
      align: "right",
      render: (r) => (
        <Badge variant="outline">
          {r.components.length} component{r.components.length === 1 ? "" : "s"}
        </Badge>
      ),
    },
    {
      key: "employeeCount",
      header: "Employees",
      align: "right",
      render: (r) => <span className="text-sm tabular-nums">{r.employeeCount}</span>,
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
      title="Salary structures"
      description="Reusable CTC templates with earning and deduction components you can assign to employees."
      actions={
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
          Add structure
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search structures…"
            className="pl-8"
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<Wallet aria-hidden />}
            title={loadError ? "Couldn't load salary structures" : "No salary structures yet"}
            description={loadError ?? "Create your first salary structure to standardize how CTC is split into components."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
                  Add structure
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <DataTable columns={columns} rows={rows} getRowId={(r) => r.id} hover />
        </Card>
      )}

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit salary structure" : "Add salary structure"}</DialogTitle>
            <DialogDescription>
              Define the total CTC and break it into earning and deduction components.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} autoFocus placeholder="e.g. Senior Engineer" />
            </Field>
            <Field label="Annual CTC">
              <Input
                type="number"
                value={Number.isFinite(form.ctc) ? form.ctc : ""}
                onChange={(e) => patch({ ctc: e.target.value ? Number(e.target.value) : 0 })}
                placeholder="0"
              />
            </Field>
          </div>

          {/* Component editor */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--st-text)]">Components</span>
              <Button variant="outline" size="sm" iconLeft={Plus} onClick={addComponent}>
                Add component
              </Button>
            </div>

            {form.components.length === 0 ? (
              <p className="rounded-md border border-dashed border-[var(--st-border)] p-4 text-center text-sm text-[var(--st-text-secondary)]">
                No components yet. Add earnings (Basic, HRA…) or deductions (PF, Tax…).
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {form.components.map((c, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 items-center gap-2 rounded-md border border-[var(--st-border)] p-2 sm:grid-cols-[1fr_8rem_9rem_7rem_auto]"
                  >
                    <Input
                      value={c.name}
                      onChange={(e) => updateComponent(idx, { name: e.target.value })}
                      placeholder="Component name"
                      aria-label={`Component ${idx + 1} name`}
                    />
                    <SelectField
                      value={c.kind}
                      options={KIND_OPTIONS}
                      onChange={(v) => updateComponent(idx, { kind: String(v) as SalaryComponent["kind"] })}
                    />
                    <SelectField
                      value={c.calc}
                      options={CALC_OPTIONS}
                      onChange={(v) => updateComponent(idx, { calc: String(v) as SalaryComponent["calc"] })}
                    />
                    <Input
                      type="number"
                      value={Number.isFinite(c.value) ? c.value : ""}
                      onChange={(e) => updateComponent(idx, { value: e.target.value ? Number(e.target.value) : 0 })}
                      placeholder="0"
                      aria-label={`Component ${idx + 1} value`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      aria-label={`Remove component ${idx + 1}`}
                      onClick={() => removeComponent(idx)}
                    />
                  </div>
                ))}
              </div>
            )}
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
              {editingId ? "Save changes" : "Add structure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
