"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Trash2, UserRound } from "lucide-react";

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
import { SabHrmPageShell, statusTone } from "@/components/sabhrm/page-toolkit";
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  type EmployeePickerOptions,
} from "@/app/actions/sabhrm/employees.actions";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  type EmployeeRow,
  type EmployeeFormValues,
  type Paginated,
} from "@/lib/sabhrm/types";

const EMPLOYMENT_OPTIONS: SelectOption[] = Object.entries(EMPLOYMENT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const STATUS_OPTIONS: SelectOption[] = Object.entries(EMPLOYEE_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

const EMPTY_FORM: EmployeeFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  employmentType: "full_time",
  status: "active",
};

export function EmployeesClient({
  initial,
  options,
  loadError,
}: {
  initial: Paginated<EmployeeRow>;
  options: EmployeePickerOptions;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<EmployeeRow[]>(initial.rows);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<EmployeeFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    async (nextQ = q, nextStatus = statusFilter) => {
      setLoading(true);
      const res = await listEmployees({ q: nextQ || undefined, status: nextStatus || undefined, pageSize: 50 });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load employees", description: res.error, variant: "destructive" });
    },
    [q, statusFilter, toast],
  );

  // Debounced search.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(q, statusFilter), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter]);

  const patch = (p: Partial<EmployeeFormValues>) => setForm((f) => ({ ...f, ...p }));

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const res = await createEmployee(form);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    toast({ title: "Employee added", description: `${res.data.displayName} can now sign in with their email.` });
    setOpen(false);
    setForm(EMPTY_FORM);
    setRows((r) => [res.data, ...r]);
  }, [form, toast]);

  const remove = React.useCallback(
    async (row: EmployeeRow) => {
      if (!window.confirm(`Remove ${row.displayName}? This deletes their HR record.`)) return;
      const res = await deleteEmployee(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't remove", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Employee removed" });
    },
    [toast],
  );

  const columns: DataTableColumn<EmployeeRow>[] = [
    {
      key: "name",
      header: "Employee",
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--st-bg-muted)] text-xs font-medium text-[var(--st-text-secondary)]">
            {(r.firstName[0] ?? "") + (r.lastName[0] ?? "")}
          </span>
          <div className="min-w-0">
            <Link href={`/sabhrm/employees/${r.id}`} className="block truncate text-sm font-medium text-[var(--st-text)] hover:underline">
              {r.displayName}
            </Link>
            <span className="block truncate text-xs text-[var(--st-text-secondary)]">{r.email}</span>
          </div>
        </div>
      ),
    },
    { key: "employeeCode", header: "Code", render: (r) => <span className="text-sm tabular-nums">{r.employeeCode}</span> },
    { key: "departmentName", header: "Department", render: (r) => r.departmentName ?? "—" },
    { key: "designationName", header: "Designation", render: (r) => r.designationName ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={TONE_BADGE[statusTone(r.status)]}>{EMPLOYEE_STATUS_LABELS[r.status]}</Badge>
      ),
    },
    { key: "dateOfJoining", header: "Joined", render: (r) => r.dateOfJoining ?? "—" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          iconLeft={Trash2}
          aria-label={`Remove ${r.displayName}`}
          onClick={(e) => {
            e.stopPropagation();
            void remove(r);
          }}
        />
      ),
    },
  ];

  return (
    <SabHrmPageShell
      title="Employees"
      description="Your team directory. Add an employee to create their HR record and an email + password login."
      actions={
        <Button
          variant="primary"
          size="sm"
          iconLeft={Plus}
          onClick={() => {
            setForm(EMPTY_FORM);
            setFormErr(null);
            setOpen(true);
          }}
        >
          Add employee
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, code…"
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
            icon={<UserRound aria-hidden />}
            title={loadError ? "Couldn't load employees" : "No employees yet"}
            description={loadError ?? "Add your first employee to start building your team directory."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
                  Add employee
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

      {/* Add employee dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>
              Creates the HR record and a sign-in login (email + password). The
              employee is prompted to change their password on first sign-in.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="First name">
              <Input value={form.firstName} onChange={(e) => patch({ firstName: e.target.value })} autoFocus />
            </Field>
            <Field label="Last name">
              <Input value={form.lastName} onChange={(e) => patch({ lastName: e.target.value })} />
            </Field>
            <Field label="Work email">
              <Input type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} placeholder="name@company.com" />
            </Field>
            <Field label="Temporary password">
              <Input
                type="text"
                value={form.password ?? ""}
                onChange={(e) => patch({ password: e.target.value })}
                placeholder="min 8 characters"
              />
            </Field>
            <Field label="Department">
              <SelectField
                value={form.departmentId ?? ""}
                options={[{ value: "", label: "—" }, ...options.departments]}
                onChange={(v) => patch({ departmentId: String(v) || undefined })}
              />
            </Field>
            <Field label="Designation">
              <SelectField
                value={form.designationId ?? ""}
                options={[{ value: "", label: "—" }, ...options.designations]}
                onChange={(v) => patch({ designationId: String(v) || undefined })}
              />
            </Field>
            <Field label="Reporting manager">
              <SelectField
                value={form.reportingManagerId ?? ""}
                options={[{ value: "", label: "—" }, ...options.managers]}
                onChange={(v) => patch({ reportingManagerId: String(v) || undefined })}
              />
            </Field>
            <Field label="Employment type">
              <SelectField
                value={form.employmentType ?? "full_time"}
                options={EMPLOYMENT_OPTIONS}
                onChange={(v) => patch({ employmentType: v as EmployeeFormValues["employmentType"] })}
              />
            </Field>
            <Field label="Date of joining">
              <Input type="date" value={form.dateOfJoining ?? ""} onChange={(e) => patch({ dateOfJoining: e.target.value })} />
            </Field>
            <Field label="Annual CTC">
              <Input
                type="number"
                value={form.ctc ?? ""}
                onChange={(e) => patch({ ctc: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0"
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
              iconLeft={Plus}
              loading={saving}
              disabled={saving || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !(form.password ?? "").trim()}
              onClick={() => void submit()}
            >
              Add employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
