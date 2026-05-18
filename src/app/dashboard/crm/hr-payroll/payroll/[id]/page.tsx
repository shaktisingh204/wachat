import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
    Calculator,
  FileText,
  Mail,
  Pencil,
  Archive as ArchiveIcon,
  History,
  } from 'lucide-react';

/**
 * Payroll run detail page.
 *
 * Server component — fetches the run via the Rust-backed
 * `getPayrollRun()` action and composes the standard CRM detail shell
 * with:
 *   • main column: summary + totals card, employees-included table,
 *     per-employee earnings/deductions micro-rows.
 *   • right rail: KPI stats (employees, gross, deductions, net).
 *   • footer: <EntityAuditTimeline entityKind="payroll_run" />.
 *
 * Action group: Edit · Compute · Print · Email all · Archive · Activity.
 * Print/Email-all are intentionally `<a>`/intent stubs — the underlying
 * Rust crate doesn't expose bulk PDF / mail endpoints today.
 */

import Link from 'next/link';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

import { getSession } from '@/app/actions/user.actions';
import { getPayrollRun } from '@/app/actions/crm/payroll-runs.actions';
import type {
    CrmPayrollRunDoc,
    CrmPayrollRunEmployeeRow,
    CrmPayrollRunStatus,
} from '@/lib/rust-client/crm-payroll-runs';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr-payroll/payroll';

const STATUS_TONE: Record<CrmPayrollRunStatus, EntityStatusTone> = {
    draft: 'amber',
    processing: 'blue',
    approved: 'green',
    disbursed: 'green',
    closed: 'neutral',
};

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtRange(from?: string, to?: string): string {
    if (!from && !to) return '—';
    return `${fmtDate(from)} → ${fmtDate(to)}`;
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PayrollRunDetailPage({ params }: PageProps) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const { run, error } = await getPayrollRun(id);
    if (!run && !error) notFound();
    if (!run) {
        // Permission / fetch error — surface as a not-found rather than
        // crashing the route.
        notFound();
    }

    const r: CrmPayrollRunDoc = run;
    const status = (r.status ?? 'draft') as CrmPayrollRunStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';

    const employees = r.employees ?? [];
    const totals = r.totals ?? {
        gross: 0,
        net: 0,
        ctc: 0,
        employeeCount: employees.length,
    };
    const totalDeductions = employees.reduce((s, row) => {
        const d = row.deductions ?? [];
        return s + d.reduce((a, line) => a + (Number(line.amount) || 0), 0);
    }, 0);

    const periodLabel = fmtRange(r.periodFrom, r.periodTo);

    return (
        <EntityDetailShell
            title={`Payroll · ${periodLabel}`}
            eyebrow="PAYROLL RUN"
            status={{ label: status.replace(/_/g, ' '), tone }}
            back={{ href: BASE, label: 'All payroll runs' }}
            actions={
                <>
                    <ZoruButton variant="outline" size="sm" asChild>
                        <Link href={`${BASE}/${id}/edit`}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                        </Link>
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" disabled title="Compute via the Rust BFF — coming soon">
                        <Calculator className="mr-1.5 h-3.5 w-3.5" />
                        Run
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" disabled title="Bulk PDF export pending">
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Print
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" disabled title="Bulk email pending">
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        Email all
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" disabled title="Archive via status field on the edit page">
                        <ArchiveIcon className="mr-1.5 h-3.5 w-3.5" />
                        Archive
                    </ZoruButton>
                    <ZoruButton variant="ghost" size="sm" asChild>
                        <Link href={`${BASE}/${id}/edit`}>
                            <History className="mr-1.5 h-3.5 w-3.5" />
                            Activity
                        </Link>
                    </ZoruButton>
                </>
            }
            rightRail={
                <>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Stats</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="space-y-3 text-sm">
                            <Stat label="Employees" value={String(totals.employeeCount ?? employees.length)} />
                            <Stat label="Total gross" value={inr.format(totals.gross ?? 0)} />
                            <Stat label="Total deductions" value={inr.format(totalDeductions)} />
                            <Stat label="Total net" value={inr.format(totals.net ?? 0)} />
                            <Stat label="Total CTC" value={inr.format(totals.ctc ?? 0)} />
                        </ZoruCardContent>
                    </ZoruCard>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Period</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="space-y-2 text-sm">
                            <Stat label="From" value={fmtDate(r.periodFrom)} />
                            <Stat label="To" value={fmtDate(r.periodTo)} />
                            <Stat label="Pay date" value={fmtDate(r.payDate)} />
                            <Stat label="Lock date" value={fmtDate(r.lockDate)} />
                            <Stat
                                label="Bank file"
                                value={(r.bankFileFormat ?? '').toUpperCase() || '—'}
                            />
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            }
            audit={<EntityAuditTimeline entityKind="payroll_run" entityId={id} />}
        >
            {/* Summary card */}
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Summary</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                        <Row label="Period" value={periodLabel} />
                        <Row label="Pay date" value={fmtDate(r.payDate)} />
                        <Row label="Lock date" value={fmtDate(r.lockDate)} />
                        <Row label="Status" value={status.replace(/_/g, ' ')} />
                        <Row
                            label="Bank file format"
                            value={(r.bankFileFormat ?? '').toUpperCase() || '—'}
                        />
                        <Row label="Created at" value={fmtDate(r.createdAt)} />
                    </dl>
                </ZoruCardContent>
            </ZoruCard>

            {/* Employees included */}
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>
                        Employees included · {employees.length}
                    </ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Employee
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                                        Earnings
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                                        Deductions
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                                        Gross
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                                        Net
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {employees.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={5}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No employees in this run yet. Use “Run”
                                            to compute payslips.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    employees.map((row, idx) => (
                                        <EmployeeRow
                                            key={`${row.employeeId}-${idx}`}
                                            row={row}
                                        />
                                    ))
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}

/* ─── Presentational helpers ─────────────────────────────────────── */

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-zoru-ink-muted">{label}</dt>
            <dd className="capitalize text-zoru-ink">{value || '—'}</dd>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className="text-zoru-ink-muted">{label}</span>
            <span className="font-mono text-zoru-ink">{value}</span>
        </div>
    );
}

function EmployeeRow({ row }: { row: CrmPayrollRunEmployeeRow }) {
    const earningsTotal = (row.earnings ?? []).reduce(
        (a, e) => a + (Number(e.amount) || 0),
        0,
    );
    const deductionsTotal = (row.deductions ?? []).reduce(
        (a, d) => a + (Number(d.amount) || 0),
        0,
    );
    return (
        <ZoruTableRow className="border-zoru-line">
            <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                {row.employeeId}
            </ZoruTableCell>
            <ZoruTableCell className="text-right font-mono text-zoru-ink">
                {inr.format(earningsTotal)}
            </ZoruTableCell>
            <ZoruTableCell className="text-right font-mono text-zoru-ink">
                {inr.format(deductionsTotal)}
            </ZoruTableCell>
            <ZoruTableCell className="text-right font-mono text-zoru-ink">
                {inr.format(row.gross ?? 0)}
            </ZoruTableCell>
            <ZoruTableCell className="text-right font-mono text-zoru-ink">
                {inr.format(row.net ?? 0)}
            </ZoruTableCell>
        </ZoruTableRow>
    );
}
