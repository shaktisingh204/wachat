import {
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

/**
 * Payslip detail page.
 *
 * Server component: fetches the payslip via `getPayslipDoc()` (Rust BFF)
 * and composes the standard CRM detail shell with:
 *   • main column: earnings table + deductions table + totals card.
 *   • right rail: stats (employee, pay period, gross/net headline).
 *   • footer: <EntityAuditTimeline entityKind="payslip" />.
 *
 * Action group lives in <PayslipActions> (client island).
 */

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

import { getSession } from '@/app/actions/user.actions';
import { getPayslipDoc } from '@/app/actions/crm-payslips.actions';
import type { CrmPayslipStatus } from '@/lib/rust-client/crm-payslips';

import { PayslipActions } from '../_components/payslip-actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr-payroll/payslips';

const STATUS_TONE: Record<CrmPayslipStatus, EntityStatusTone> = {
    draft: 'amber',
    issued: 'blue',
    paid: 'green',
    archived: 'neutral',
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

function fmtPeriod(p: string | undefined): string {
    if (!p) return '—';
    const m = /^(\d{4})-(\d{2})/.exec(p);
    if (!m) return p;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PayslipDetailPage({ params }: PageProps) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const payslip = await getPayslipDoc(id);
    if (!payslip) notFound();

    const status = (payslip.status ?? 'draft') as CrmPayslipStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';

    // Build the line tables from the flat DTO fields. The Rust client
    // returns scalar amounts rather than line objects, so we synthesise
    // the rows here.
    const earningsRows: { label: string; amount: number }[] = [
        { label: 'Basic', amount: payslip.basic ?? 0 },
        { label: 'HRA', amount: payslip.hra ?? 0 },
        { label: 'Allowances', amount: payslip.allowances ?? 0 },
    ];
    const deductionRows: { label: string; amount: number }[] = [
        { label: 'PF', amount: payslip.pf ?? 0 },
        { label: 'ESI', amount: payslip.esi ?? 0 },
        { label: 'Tax', amount: payslip.tax ?? 0 },
        { label: 'Other', amount: payslip.deductions ?? 0 },
    ];
    const earningsTotal = earningsRows.reduce(
        (s, r) => s + (Number(r.amount) || 0),
        0,
    );
    const deductionsTotal = deductionRows.reduce(
        (s, r) => s + (Number(r.amount) || 0),
        0,
    );
    const gross = payslip.gross ?? earningsTotal;
    const net = payslip.net ?? gross - deductionsTotal;

    const title = payslip.employeeName ?? payslip.employeeId ?? 'Payslip';

    return (
        <EntityDetailShell
            title={title}
            eyebrow={`PAYSLIP · ${fmtPeriod(payslip.payPeriod)}`}
            status={{ label: status, tone }}
            back={{ href: BASE, label: 'All payslips' }}
            actions={
                <PayslipActions
                    id={id}
                    archived={status === 'archived'}
                    acknowledged={status === 'paid'}
                />
            }
            rightRail={
                <>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Stats</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="space-y-3 text-sm">
                            <Stat label="Gross" value={inr.format(gross)} />
                            <Stat
                                label="Total deductions"
                                value={inr.format(deductionsTotal)}
                            />
                            <Stat label="Net" value={inr.format(net)} />
                        </ZoruCardContent>
                    </ZoruCard>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Identity</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="space-y-2 text-sm">
                            <Stat
                                label="Employee"
                                value={payslip.employeeName ?? '—'}
                            />
                            <Stat
                                label="ID"
                                value={payslip.employeeId ?? '—'}
                                mono
                            />
                            <Stat
                                label="Pay period"
                                value={fmtPeriod(payslip.payPeriod)}
                            />
                            <Stat
                                label="Issued at"
                                value={fmtDate(payslip.issuedAt)}
                            />
                            <Stat
                                label="Created at"
                                value={fmtDate(payslip.createdAt)}
                            />
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            }
            audit={<EntityAuditTimeline entityKind="payslip" entityId={id} />}
        >
            {/* Earnings */}
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Earnings</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <LineTable rows={earningsRows} totalLabel="Gross" total={gross} />
                </ZoruCardContent>
            </ZoruCard>

            {/* Deductions */}
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Deductions</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <LineTable
                        rows={deductionRows}
                        totalLabel="Total deductions"
                        total={deductionsTotal}
                    />
                </ZoruCardContent>
            </ZoruCard>

            {/* Totals card */}
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Totals</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                        <Totals label="Gross" value={inr.format(gross)} />
                        <Totals
                            label="Total deductions"
                            value={inr.format(deductionsTotal)}
                        />
                        <Totals
                            label="Net pay"
                            value={inr.format(net)}
                            emphasize
                        />
                    </dl>
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}

/* ─── Presentational helpers ─────────────────────────────────────── */

function LineTable({
    rows,
    totalLabel,
    total,
}: {
    rows: { label: string; amount: number }[];
    totalLabel: string;
    total: number;
}) {
    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                        <ZoruTableHead className="text-zoru-ink-muted">
                            Component
                        </ZoruTableHead>
                        <ZoruTableHead className="text-right text-zoru-ink-muted">
                            Amount
                        </ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {rows.map((r) => (
                        <ZoruTableRow key={r.label} className="border-zoru-line">
                            <ZoruTableCell className="text-zoru-ink">
                                {r.label}
                            </ZoruTableCell>
                            <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                {inr.format(r.amount)}
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ))}
                    <ZoruTableRow className="border-zoru-line bg-zoru-surface-2">
                        <ZoruTableCell className="font-medium text-zoru-ink">
                            {totalLabel}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right font-mono font-medium text-zoru-ink">
                            {inr.format(total)}
                        </ZoruTableCell>
                    </ZoruTableRow>
                </ZoruTableBody>
            </ZoruTable>
        </div>
    );
}

function Stat({
    label,
    value,
    mono,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className="text-zoru-ink-muted">{label}</span>
            <span
                className={mono ? 'font-mono text-zoru-ink' : 'text-zoru-ink'}
            >
                {value}
            </span>
        </div>
    );
}

function Totals({
    label,
    value,
    emphasize,
}: {
    label: string;
    value: string;
    emphasize?: boolean;
}) {
    return (
        <div
            className={`rounded-[var(--zoru-radius)] border border-zoru-line p-4 ${
                emphasize ? 'bg-zoru-bg' : 'bg-zoru-surface-2'
            }`}
        >
            <div className="text-zoru-ink-muted">{label}</div>
            <div
                className={`mt-1 font-mono ${
                    emphasize
                        ? 'text-[18px] font-medium text-zoru-ink'
                        : 'text-zoru-ink'
                }`}
            >
                {value}
            </div>
        </div>
    );
}
