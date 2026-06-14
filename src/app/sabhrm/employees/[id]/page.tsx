import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/sabcrm/20ui";
import { SabHrmPageShell, formatMoney, statusTone } from "@/components/sabhrm/page-toolkit";
import { getEmployee } from "@/app/actions/sabhrm/employees.actions";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/sabhrm/types";

export const dynamic = "force-dynamic";

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">{label}</span>
      <span className="text-sm text-[var(--st-text)]">{value ?? "—"}</span>
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getEmployee(id);

  if (!res.ok) {
    return (
      <SabHrmPageShell title="Employee">
        <Card className="p-10">
          <EmptyState
            title="Employee not found"
            description={res.error}
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/sabhrm/employees">Back to employees</Link>
              </Button>
            }
          />
        </Card>
      </SabHrmPageShell>
    );
  }

  const e = res.data;

  return (
    <SabHrmPageShell
      title={e.displayName}
      description={`${e.employeeCode}${e.designationName ? ` · ${e.designationName}` : ""}`}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/sabhrm/employees">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All employees
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--st-bg-muted)] text-xl font-semibold text-[var(--st-text-secondary)]">
            {(e.firstName[0] ?? "") + (e.lastName[0] ?? "")}
          </span>
          <div>
            <div className="text-base font-semibold text-[var(--st-text)]">{e.displayName}</div>
            <div className="text-sm text-[var(--st-text-secondary)]">{e.designationName ?? "—"}</div>
          </div>
          <Badge variant={TONE_BADGE[statusTone(e.status)]}>{EMPLOYEE_STATUS_LABELS[e.status]}</Badge>
          <div className="mt-2 flex w-full flex-col gap-2 text-sm">
            <a href={`mailto:${e.email}`} className="flex items-center gap-2 text-[var(--st-text)] hover:underline">
              <Mail className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden /> {e.email}
            </a>
            {e.phone ? (
              <span className="flex items-center gap-2 text-[var(--st-text)]">
                <Phone className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden /> {e.phone}
              </span>
            ) : null}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-[var(--st-text)]">Employment</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Detail label="Employee code" value={e.employeeCode} />
            <Detail label="Department" value={e.departmentName} />
            <Detail label="Designation" value={e.designationName} />
            <Detail label="Reporting manager" value={e.reportingManagerName} />
            <Detail label="Employment type" value={EMPLOYMENT_TYPE_LABELS[e.employmentType]} />
            <Detail label="Status" value={EMPLOYEE_STATUS_LABELS[e.status]} />
            <Detail label="Date of joining" value={e.dateOfJoining} />
            <Detail label="Work location" value={e.workLocation} />
            <Detail label="Annual CTC" value={e.ctc != null ? formatMoney(e.ctc) : "—"} />
            <Detail label="Login" value={e.userId ? "Email + password enabled" : "No login"} />
          </div>
        </Card>
      </div>
    </SabHrmPageShell>
  );
}
