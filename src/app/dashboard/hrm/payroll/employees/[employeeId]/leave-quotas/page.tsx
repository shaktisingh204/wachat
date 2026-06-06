import {
  Badge,
  Button,
  Card,
  Progress,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  CalendarDays,
  Plus,
  } from 'lucide-react';

/**
 * Employee leave-quotas sub-tab —
 *   `/dashboard/hrm/payroll/employees/[employeeId]/leave-quotas`.
 *
 * Lists `crm_leave_balances` filtered to this employee. Shows allotted
 * / used / pending / carry-forward per leave type. Uses the same
 * collection (`crm_leave_balances`) as the global Leave Balances page
 * — this is a read-focused view scoped to one employee.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getEmployee } from '@/app/actions/crm/employees.actions';
import { getCrmLeaveBalances } from '@/app/actions/crm-leave-balances.actions';
import { requirePermission } from '@/lib/rbac-server';

export const dynamic = 'force-dynamic';

function pct(used: number, total: number): number {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}

export default async function EmployeeLeaveQuotasSubPage({
    params,
}: {
    params: Promise<{ employeeId: string }>;
}) {
    const { employeeId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const guard = await requirePermission('crm_leave_balance', 'view');
    if (!guard.ok) {
        return (
            <p className="p-6 text-[13px] text-[var(--st-text-secondary)]">{guard.error}</p>
        );
    }

    const [{ employee }, balances] = await Promise.all([
        getEmployee(employeeId),
        getCrmLeaveBalances({ employeeId, limit: 100 }),
    ]);
    if (!employee) notFound();

    const fullName =
        employee.displayName ||
        [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
        employee.workEmail ||
        'Employee';

    const BASE = `/dashboard/hrm/payroll/employees/${employeeId}`;
    const NEW_HREF = `/dashboard/hrm/payroll/leave/balance?employeeId=${employeeId}`;

    // Aggregates across leave types
    const totalAllotted = balances.reduce((s, b) => s + (b.allotted || 0), 0);
    const totalUsed = balances.reduce((s, b) => s + (b.used || 0), 0);
    const totalPending = balances.reduce((s, b) => s + (b.pending || 0), 0);
    const totalCarry = balances.reduce(
        (s, b) => s + (b.carryForward || 0),
        0,
    );

    return (
        <EntityListShell
            title={`Leave quotas · ${fullName}`}
            subtitle="Per-leave-type allotment, usage and carry-forward."
            primaryAction={
                <Button asChild>
                    <Link href={NEW_HREF}>
                        <Plus className="mr-2 h-4 w-4" />
                        Manage balances
                    </Link>
                </Button>
            }
        >

            <div className="flex flex-wrap gap-1 border-b border-[var(--st-border)]">
                {[
                    { href: BASE, label: 'Overview' },
                    { href: `${BASE}/profile`, label: 'Profile' },
                    { href: `${BASE}/documents`, label: 'Documents' },
                    {
                        href: `${BASE}/emergency-contacts`,
                        label: 'Emergency contacts',
                    },
                    {
                        href: `${BASE}/leave-quotas`,
                        label: 'Leave quotas',
                        active: true,
                    },
                    { href: `${BASE}/visa-details`, label: 'Visa details' },
                ].map((tab) => (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] transition-colors ${
                            tab.active
                                ? 'border-[var(--st-text)] text-[var(--st-text)]'
                                : 'border-transparent text-[var(--st-text-secondary)] hover:text-[var(--st-text)]'
                        }`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </div>

            {/* KPI strip */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiTile label="Total allotted" value={totalAllotted} />
                <KpiTile label="Used" value={totalUsed} tone="warning" />
                <KpiTile label="Pending" value={totalPending} tone="info" />
                <KpiTile
                    label="Carry forward"
                    value={totalCarry}
                    tone="success"
                />
            </div>

            {balances.length === 0 ? (
                <Card className="flex flex-col items-start gap-3 p-8">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                        <CalendarDays
                            className="h-5 w-5 text-[var(--st-text-secondary)]"
                            strokeWidth={1.75}
                        />
                    </div>
                    <div>
                        <h3 className="text-[15px] text-[var(--st-text)]">
                            No leave balances yet
                        </h3>
                        <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
                            Allocate leave quotas (sick, casual, earned, etc.)
                            for {fullName} in the Leave Balances page.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href={NEW_HREF}>
                            <Plus className="mr-2 h-4 w-4" />
                            Manage balances
                        </Link>
                    </Button>
                </Card>
            ) : (
                <Card className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                        Leave type
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                        Period
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                                        Allotted
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                                        Used
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                                        Pending
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                                        Carry forward
                                    </ZoruTableHead>
                                    <ZoruTableHead className="w-[160px] text-[var(--st-text-secondary)]">
                                        Usage
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {balances.map((b) => {
                                    const remaining = Math.max(
                                        0,
                                        (b.allotted || 0) -
                                            (b.used || 0) -
                                            (b.pending || 0),
                                    );
                                    return (
                                        <ZoruTableRow
                                            key={b._id}
                                            className="border-[var(--st-border)]"
                                        >
                                            <ZoruTableCell className="font-medium capitalize text-[var(--st-text)]">
                                                {b.leaveType.replace(/_/g, ' ')}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[var(--st-text)]">
                                                {b.period || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-[12.5px] text-[var(--st-text)]">
                                                {b.allotted ?? 0}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-[12.5px] text-[var(--st-text)]">
                                                {b.used ?? 0}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-[12.5px] text-[var(--st-text)]">
                                                {b.pending ?? 0}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-[12.5px] text-[var(--st-text)]">
                                                {b.carryForward ?? 0}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <div className="flex items-center gap-2">
                                                    <Progress
                                                        value={pct(
                                                            b.used,
                                                            b.allotted,
                                                        )}
                                                        className="h-1.5 w-24"
                                                    />
                                                    <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                                                        {remaining} left
                                                    </span>
                                                </div>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </Table>
                    </div>
                </Card>
            )}
        </EntityListShell>
    );
}

function KpiTile({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: number;
    tone?: 'default' | 'success' | 'warning' | 'info';
}) {
    const toneBadge: Record<string, React.ComponentProps<typeof ZoruBadge>['variant']> = {
        default: 'ghost',
        success: 'success',
        warning: 'warning',
        info: 'ghost',
    };
    return (
        <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] text-[var(--st-text-secondary)]">{label}</p>
                <Badge variant={toneBadge[tone] ?? 'ghost'}>days</Badge>
            </div>
            <p className="mt-2 text-[22px] leading-none text-[var(--st-text)]">
                {value}
            </p>
        </Card>
    );
}
