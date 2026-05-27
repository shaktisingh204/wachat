import React from 'react';
import { redirect } from 'next/navigation';

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    PageHeader,
    ZoruPageTitle,
    ZoruPageDescription,
    Badge,
} from '@/components/zoruui';
import { getSession } from '@/app/actions/user.actions';
import {
    getSabworkerlyDashboardStats,
    getSabworkerlyTimesheets,
    getSabworkerlyInvoices,
} from '@/app/actions/sabworkerly.actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

export default async function SabworkerlyOverviewPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const [stats, pendingTs, unpaidInv] = await Promise.all([
        getSabworkerlyDashboardStats(),
        getSabworkerlyTimesheets({ status: 'submitted', limit: 5 }),
        getSabworkerlyInvoices({ status: 'sent', limit: 5 }),
    ]);

    return (
        <div className="zoruui flex flex-col gap-6">
            <PageHeader>
                <ZoruPageTitle>SabWorkerly</ZoruPageTitle>
                <ZoruPageDescription>
                    Temp/agency staffing — workers, clients, timesheets, invoices, and payroll.
                </ZoruPageDescription>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm text-[color:var(--zoru-muted-fg)]">
                            Active Workers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold">{stats.activeWorkers}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm text-[color:var(--zoru-muted-fg)]">
                            Open Jobs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold">{stats.openJobs}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm text-[color:var(--zoru-muted-fg)]">
                            Pending Timesheets
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold">{stats.pendingTimesheets}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm text-[color:var(--zoru-muted-fg)]">
                            Unpaid Invoices
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold">{stats.unpaidInvoices}</div>
                        <div className="mt-1 text-xs text-[color:var(--zoru-muted-fg)]">
                            {money(stats.unpaidTotalMinor)} outstanding
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Pending timesheet approvals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pendingTs.length === 0 ? (
                            <p className="text-sm text-[color:var(--zoru-muted-fg)]">
                                No timesheets awaiting approval.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {pendingTs.map((t) => (
                                    <li
                                        key={t._id}
                                        className="flex items-center justify-between rounded-md border border-[color:var(--zoru-border)] px-3 py-2 text-sm"
                                    >
                                        <span>Week of {new Date(t.weekStart).toLocaleDateString()}</span>
                                        <Badge variant="secondary">{t.totalHours.toFixed(1)} h</Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Outstanding invoices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {unpaidInv.length === 0 ? (
                            <p className="text-sm text-[color:var(--zoru-muted-fg)]">
                                No outstanding invoices.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {unpaidInv.map((inv) => (
                                    <li
                                        key={inv._id}
                                        className="flex items-center justify-between rounded-md border border-[color:var(--zoru-border)] px-3 py-2 text-sm"
                                    >
                                        <span>
                                            {new Date(inv.periodStart).toLocaleDateString()} —{' '}
                                            {new Date(inv.periodEnd).toLocaleDateString()}
                                        </span>
                                        <Badge>{money(inv.totalMinor, inv.currency)}</Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
