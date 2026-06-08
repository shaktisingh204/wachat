import React from 'react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
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
import { Clock, ClipboardList, CheckCircle2, FilePlus2 } from 'lucide-react';
import {
    getSabworkerlyTimesheets,
    getSabworkerlyPlacements,
} from '@/app/actions/sabworkerly.actions';
import { TimesheetActions } from './_actions';
import { NewTimesheetForm } from './_new-form';

function hoursLabel(d: Record<string, number | undefined>): string {
    return (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const)
        .map((k) => `${k} ${d[k] ?? 0}`)
        .join(' · ');
}

const STATUS_TONE: Record<string, BadgeTone> = {
    draft: 'neutral',
    submitted: 'warning',
    approved: 'success',
    rejected: 'danger',
    invoiced: 'info',
};

function statusLabel(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function TimesheetsPage() {
    const [pending, all, placements] = await Promise.all([
        getSabworkerlyTimesheets({ status: 'submitted', limit: 50 }),
        getSabworkerlyTimesheets({ status: 'all', limit: 200 }),
        getSabworkerlyPlacements({ status: 'active', limit: 200 }),
    ]);

    const approvedHours = all
        .filter((t) => t.status === 'approved' || t.status === 'invoiced')
        .reduce((acc, t) => acc + t.totalHours, 0);

    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabWorkerly</PageEyebrow>
                    <PageTitle>Timesheets</PageTitle>
                    <PageDescription>
                        Log weekly hours against a placement, review what's awaiting approval, and
                        audit the full history.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <section
                aria-label="Timesheet totals"
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
                <StatCard
                    icon={ClipboardList}
                    accent="#7c3aed"
                    label="Awaiting approval"
                    value={<span className="tabular-nums">{pending.length}</span>}
                />
                <StatCard
                    icon={Clock}
                    accent="#3b7af5"
                    label="Total timesheets"
                    value={<span className="tabular-nums">{all.length}</span>}
                />
                <StatCard
                    icon={CheckCircle2}
                    accent="#1f9d55"
                    label="Approved hours"
                    value={<span className="tabular-nums">{approvedHours.toFixed(1)}</span>}
                />
            </section>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FilePlus2
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        Log a weekly timesheet
                    </CardTitle>
                    <CardDescription>
                        Enter hours per day for an active placement, then save it as a draft.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <NewTimesheetForm
                        placements={placements.map((p) => ({
                            id: p._id,
                            label: `${p.workerId.slice(-6)} on ${p.jobId.slice(-6)}`,
                            workerId: p.workerId,
                        }))}
                    />
                </CardBody>
            </Card>

            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ClipboardList
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        Pending approvals
                        <Badge tone="warning" kind="soft">
                            <span className="tabular-nums">{pending.length}</span>
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    {pending.length === 0 ? (
                        <EmptyState
                            className="py-8"
                            size="sm"
                            tone="success"
                            icon={CheckCircle2}
                            title="All caught up"
                            description="No timesheets are waiting for your approval."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Week</Th>
                                    <Th align="right">Hours</Th>
                                    <Th>Breakdown</Th>
                                    <Th align="right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {pending.map((t) => (
                                    <Tr key={t._id}>
                                        <Td>{new Date(t.weekStart).toLocaleDateString()}</Td>
                                        <Td align="right" className="tabular-nums">
                                            {t.totalHours.toFixed(2)}
                                        </Td>
                                        <Td className="font-mono text-xs text-[color:var(--st-text-secondary)]">
                                            {hoursLabel(t.dailyHoursJson as Record<string, number>)}
                                        </Td>
                                        <Td align="right">
                                            <div className="flex justify-end">
                                                <TimesheetActions id={t._id} status={t.status} />
                                            </div>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>

            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        All timesheets
                    </CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    {all.length === 0 ? (
                        <EmptyState
                            className="py-8"
                            icon={Clock}
                            title="No timesheets yet"
                            description="Workers log weekly hours against an active placement."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Week</Th>
                                    <Th align="right">Hours</Th>
                                    <Th>Status</Th>
                                    <Th align="right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {all.map((t) => (
                                    <Tr key={t._id}>
                                        <Td>{new Date(t.weekStart).toLocaleDateString()}</Td>
                                        <Td align="right" className="tabular-nums">
                                            {t.totalHours.toFixed(2)}
                                        </Td>
                                        <Td>
                                            <Badge tone={STATUS_TONE[t.status] ?? 'neutral'} dot>
                                                {statusLabel(t.status)}
                                            </Badge>
                                        </Td>
                                        <Td align="right">
                                            <div className="flex justify-end">
                                                <TimesheetActions id={t._id} status={t.status} />
                                            </div>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
