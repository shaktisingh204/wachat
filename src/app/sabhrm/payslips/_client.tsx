"use client";

import * as React from "react";
import { Receipt, Search, Send, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  SelectField,
  useToast,
  type DataTableColumn,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell, statusTone, formatMoney } from "@/components/sabhrm/page-toolkit";
import {
  deletePayslip,
  listPayslips,
  markPayslipSent,
} from "@/app/actions/sabhrm/payslips.actions";
import type { PayslipRow, Paginated } from "@/lib/sabhrm/types";

const PAYSLIP_STATUS_LABELS: Record<string, string> = {
  generated: "Generated",
  sent: "Sent",
};

const STATUS_OPTIONS: SelectOption[] = Object.entries(PAYSLIP_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

export function PayslipsClient({
  initial,
  loadError,
}: {
  initial: Paginated<PayslipRow>;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<PayslipRow[]>(initial.rows);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    async (nextQ = q, nextStatus = statusFilter) => {
      setLoading(true);
      const res = await listPayslips({ q: nextQ || undefined, status: nextStatus || undefined, pageSize: 50 });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load payslips", description: res.error, variant: "destructive" });
    },
    [q, statusFilter, toast],
  );

  // Debounced search.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(q, statusFilter), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter]);

  const markSent = React.useCallback(
    async (row: PayslipRow) => {
      setBusyId(row.id);
      const res = await markPayslipSent(row.id);
      setBusyId(null);
      if (!res.ok) {
        toast({ title: "Couldn't mark sent", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.map((x) => (x.id === row.id ? res.data : x)));
      toast({ title: "Payslip sent", description: `${row.employeeName} — ${row.periodLabel}` });
    },
    [toast],
  );

  const remove = React.useCallback(
    async (row: PayslipRow) => {
      if (!window.confirm(`Delete the ${row.periodLabel} payslip for ${row.employeeName}?`)) return;
      setBusyId(row.id);
      const res = await deletePayslip(row.id);
      setBusyId(null);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Payslip deleted" });
    },
    [toast],
  );

  const columns: DataTableColumn<PayslipRow>[] = [
    {
      key: "employeeName",
      header: "Employee",
      render: (r) => (
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--st-text)]">{r.employeeName}</span>
        </div>
      ),
    },
    { key: "periodLabel", header: "Period", render: (r) => <span className="text-sm">{r.periodLabel}</span> },
    {
      key: "gross",
      header: "Gross",
      align: "right",
      render: (r) => <span className="text-sm tabular-nums">{formatMoney(r.gross)}</span>,
    },
    {
      key: "deductions",
      header: "Deductions",
      align: "right",
      render: (r) => <span className="text-sm tabular-nums">{formatMoney(r.deductions)}</span>,
    },
    {
      key: "net",
      header: "Net",
      align: "right",
      render: (r) => <span className="text-sm font-medium tabular-nums">{formatMoney(r.net)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={TONE_BADGE[statusTone(r.status)]}>
          {PAYSLIP_STATUS_LABELS[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.status !== "sent" ? (
            <Button
              variant="outline"
              size="sm"
              iconLeft={Send}
              loading={busyId === r.id}
              disabled={busyId === r.id}
              onClick={(e) => {
                e.stopPropagation();
                void markSent(r);
              }}
            >
              Mark sent
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            aria-label={`Delete payslip for ${r.employeeName}`}
            disabled={busyId === r.id}
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
      title="Payslips"
      description="Generated payslips from your payroll runs. Review the breakdown and mark each one as sent to the employee."
    >
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employee or period…"
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
            icon={<Receipt aria-hidden />}
            title={loadError ? "Couldn't load payslips" : "No payslips yet"}
            description={
              loadError ??
              "Payslips appear here once you compute a payroll run. Head to Payroll to run one."
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
    </SabHrmPageShell>
  );
}
