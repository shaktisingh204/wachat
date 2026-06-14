"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Plus, Wallet } from "lucide-react";

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
import { SabHrmPageShell, statusTone, formatMoney } from "@/components/sabhrm/page-toolkit";
import {
  createPayrollRun,
  type PayrollRunFormValues,
} from "@/app/actions/sabhrm/payroll.actions";
import { type PayrollRunRow, type Paginated } from "@/lib/sabhrm/types";

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

const PAYROLL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  computed: "Computed",
  approved: "Approved",
  paid: "Paid",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_OPTIONS: SelectOption[] = MONTHS.map((label, i) => ({
  value: String(i + 1),
  label,
}));

function periodLabel(month: number, year: number): string {
  const m = MONTH_SHORT[Math.min(11, Math.max(0, month - 1))] ?? "Jan";
  return `${m} ${year}`;
}

const NOW = new Date();
const EMPTY_FORM: PayrollRunFormValues = {
  label: "",
  periodMonth: NOW.getMonth() + 1,
  periodYear: NOW.getFullYear(),
};

export function PayrollRunsClient({
  initial,
  loadError,
}: {
  initial: Paginated<PayrollRunRow>;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<PayrollRunRow[]>(initial.rows);

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<PayrollRunFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const patch = (p: Partial<PayrollRunFormValues>) => setForm((f) => ({ ...f, ...p }));

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const res = await createPayrollRun(form);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    toast({ title: "Payroll run created", description: `${res.data.label} is ready to compute.` });
    setOpen(false);
    setForm(EMPTY_FORM);
    setRows((r) => [res.data, ...r]);
  }, [form, toast]);

  const columns: DataTableColumn<PayrollRunRow>[] = [
    {
      key: "label",
      header: "Run",
      render: (r) => (
        <Link
          href={`/sabhrm/payroll-runs/${r.id}`}
          className="block truncate text-sm font-medium text-[var(--st-text)] hover:underline"
        >
          {r.label}
        </Link>
      ),
    },
    {
      key: "period",
      header: "Period",
      render: (r) => <span className="text-sm tabular-nums">{periodLabel(r.periodMonth, r.periodYear)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={TONE_BADGE[statusTone(r.status)]}>
          {PAYROLL_STATUS_LABELS[r.status] ?? r.status}
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
      key: "netTotal",
      header: "Net total",
      align: "right",
      render: (r) => <span className="text-sm tabular-nums">{formatMoney(r.netTotal)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Button variant="ghost" size="sm" iconRight={ArrowRight} asChild>
          <Link href={`/sabhrm/payroll-runs/${r.id}`} aria-label={`Open ${r.label}`}>
            Open
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <SabHrmPageShell
      title="Payroll runs"
      description="Create a monthly payroll run, compute salaries from each active employee's CTC, then approve and disburse."
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
          New run
        </Button>
      }
    >
      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<Wallet aria-hidden />}
            title={loadError ? "Couldn't load payroll runs" : "No payroll runs yet"}
            description={loadError ?? "Create your first payroll run to compute salaries for this month."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
                  New run
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

      {/* New run dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New payroll run</DialogTitle>
            <DialogDescription>
              A run starts as a draft. Compute it to generate a payslip for every active employee.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Label" className="sm:col-span-2">
              <Input
                value={form.label}
                onChange={(e) => patch({ label: e.target.value })}
                placeholder="e.g. June 2026 payroll"
                autoFocus
              />
            </Field>
            <Field label="Month">
              <SelectField
                value={String(form.periodMonth)}
                options={MONTH_OPTIONS}
                onChange={(v) => patch({ periodMonth: Number(v) || NOW.getMonth() + 1 })}
              />
            </Field>
            <Field label="Year">
              <Input
                type="number"
                value={String(form.periodYear)}
                onChange={(e) => patch({ periodYear: e.target.value ? Number(e.target.value) : NOW.getFullYear() })}
                placeholder={String(NOW.getFullYear())}
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
              disabled={saving || !form.label.trim()}
              onClick={() => void submit()}
            >
              Create run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
