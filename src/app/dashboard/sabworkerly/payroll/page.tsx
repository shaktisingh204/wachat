import React from 'react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    Badge,
    type BadgeTone,
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { Banknote, CircleDollarSign, Users } from 'lucide-react';
import { getSabworkerlyPayrollRuns } from '@/app/actions/sabworkerly.actions';
import { RunPayrollForm } from './_run-form';
import { PayrollRunActions } from './_actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

const STATUS_TONE: Record<string, BadgeTone> = {
    draft: 'neutral',
    approved: 'info',
    paid: 'success',
};

function statusLabel(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function PayrollPage() {
    const runs = await getSabworkerlyPayrollRuns({ status: 'all', limit: 200 });

    const paidMinor = runs
        .filter((r) => r.status === 'paid')
        .reduce((acc, r) => acc + r.totalMinor, 0);
    const pendingMinor = runs
        .filter((r) => r.status !== 'paid')
        .reduce((acc, r) => acc + r.totalMinor, 0);

    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabWorkerly</PageEyebrow>
                    <PageTitle>Payroll</PageTitle>
                    <PageDescription>
                        Pay workers for approved timesheets. Each run uses the worker's pay rate from
                        their placement.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <section
                aria-label="Payroll totals"
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
                <StatCard
                    icon={Banknote}
                    accent="#3b7af5"
                    label="Total runs"
                    value={<span className="tabular-nums">{runs.length}</span>}
                />
                <StatCard
                    icon={CircleDollarSign}
                    accent="#1f9d55"
                    label="Paid out"
                    value={<span className="tabular-nums">{money(paidMinor)}</span>}
                />
                <StatCard
                    icon={Users}
                    accent="#d97706"
                    label="Pending payout"
                    value={<span className="tabular-nums">{money(pendingMinor)}</span>}
                />
            </section>

            <RunPayrollForm />

            {runs.length === 0 ? (
                <EmptyState
                    icon={Banknote}
                    title="No payroll runs yet"
                    description="Approve timesheets, then trigger a run using the form above."
                />
            ) : (
                <Card padding="none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Banknote
                                className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                aria-hidden="true"
                            />
                            Run history
                        </CardTitle>
                    </CardHeader>
                    <CardBody className="p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Period</Th>
                                    <Th align="right">Workers</Th>
                                    <Th align="right">Total</Th>
                                    <Th>Status</Th>
                                    <Th align="right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {runs.map((r) => (
                                    <Tr key={r._id}>
                                        <Td>
                                            {new Date(r.periodStart).toLocaleDateString()} –{' '}
                                            {new Date(r.periodEnd).toLocaleDateString()}
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {r.lineItems.length}
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {money(r.totalMinor, r.currency)}
                                        </Td>
                                        <Td>
                                            <Badge tone={STATUS_TONE[r.status] ?? 'neutral'} dot>
                                                {statusLabel(r.status)}
                                            </Badge>
                                        </Td>
                                        <Td align="right">
                                            <div className="flex justify-end">
                                                <PayrollRunActions id={r._id} status={r.status} />
                                            </div>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}
