import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, TrendingDown, Users } from "lucide-react";

import { Badge, Button, Card } from "@/components/sabcrm/20ui";
import { SabHrmPageShell, StatCard, statusTone, formatMoney } from "@/components/sabhrm/page-toolkit";
import { getPayrollRun } from "@/app/actions/sabhrm/payroll.actions";

import { PayrollRunActions } from "./_actions-client";

export const dynamic = "force-dynamic";

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

const PAYSLIP_STATUS_LABELS: Record<string, string> = {
  generated: "Generated",
  sent: "Sent",
};

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function periodLabel(month: number, year: number): string {
  const m = MONTH_SHORT[Math.min(11, Math.max(0, month - 1))] ?? "Jan";
  return `${m} ${year}`;
}

export default async function SabHrmPayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getPayrollRun(id);
  if (!res.ok) notFound();

  const { run, payslips } = res.data;

  return (
    <SabHrmPageShell
      title={run.label}
      description={
        <span className="inline-flex items-center gap-2">
          <span>{periodLabel(run.periodMonth, run.periodYear)}</span>
          <span aria-hidden>·</span>
          <Badge variant={TONE_BADGE[statusTone(run.status)]}>
            {PAYROLL_STATUS_LABELS[run.status] ?? run.status}
          </Badge>
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" iconLeft={ArrowLeft} asChild>
            <Link href="/sabhrm/payroll-runs">Back</Link>
          </Button>
          <PayrollRunActions runId={run.id} status={run.status} />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Employees" value={run.employeeCount} icon={Users} />
        <StatCard label="Gross total" value={formatMoney(run.grossTotal)} icon={Banknote} tone="positive" />
        <StatCard label="Deductions" value={formatMoney(run.deductionTotal)} icon={TrendingDown} tone="warning" />
        <StatCard label="Net total" value={formatMoney(run.netTotal)} icon={Banknote} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--st-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--st-text)]">Payslips</h2>
          <p className="text-xs text-[var(--st-text-secondary)]">
            {payslips.length} {payslips.length === 1 ? "payslip" : "payslips"} for {periodLabel(run.periodMonth, run.periodYear)}
          </p>
        </div>

        {payslips.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--st-text-secondary)]">
            No payslips yet. Compute this run to generate a payslip for every active employee.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 text-right font-medium">Gross</th>
                  <th className="px-4 py-2 text-right font-medium">Deductions</th>
                  <th className="px-4 py-2 text-right font-medium">Net</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--st-border)] last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-[var(--st-text)]">{p.employeeName}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(p.gross)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(p.deductions)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(p.net)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={TONE_BADGE[statusTone(p.status)]}>
                        {PAYSLIP_STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </SabHrmPageShell>
  );
}
