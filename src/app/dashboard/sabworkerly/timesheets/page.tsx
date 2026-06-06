import React from 'react';

import { Card, CardBody, PageHeader, PageTitle, PageDescription, Badge, Table, THead, TBody, Tr, Th, Td, EmptyState } from '@/components/sabcrm/20ui';
import { ClockIcon } from 'lucide-react';
import {
    getSabworkerlyTimesheets,
    getSabworkerlyPlacements,
} from '@/app/actions/sabworkerly.actions';
import { TimesheetActions } from './_actions';
import { NewTimesheetForm } from './_new-form';

function hoursLabel(d: Record<string, number | undefined>): string {
    return (['mon','tue','wed','thu','fri','sat','sun'] as const)
        .map((k) => `${k}:${(d[k] ?? 0)}`)
        .join(' · ');
}

export default async function TimesheetsPage() {
    const [pending, all, placements] = await Promise.all([
        getSabworkerlyTimesheets({ status: 'submitted', limit: 50 }),
        getSabworkerlyTimesheets({ status: 'all', limit: 200 }),
        getSabworkerlyPlacements({ status: 'active', limit: 200 }),
    ]);

    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <PageTitle>Timesheets</PageTitle>
                <PageDescription>
                    Pending approvals · log new weekly hours · audit log.
                </PageDescription>
            </PageHeader>

            <Card>
                <CardBody className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">Log a weekly timesheet</h2>
                    <NewTimesheetForm placements={placements.map((p) => ({
                        id: p._id,
                        label: `${p.workerId.slice(-6)} on ${p.jobId.slice(-6)}`,
                        workerId: p.workerId,
                    }))} />
                </CardBody>
            </Card>

            <Card>
                <CardBody className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">
                        Pending approvals ({pending.length})
                    </h2>
                    {pending.length === 0 ? (
                        <p className="text-sm text-[color:var(--st-text-secondary)]">All caught up.</p>
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Week</Th>
                                    <Th>Hours</Th>
                                    <Th>Breakdown</Th>
                                    <Th>Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {pending.map((t) => (
                                    <Tr key={t._id}>
                                        <Td>{new Date(t.weekStart).toLocaleDateString()}</Td>
                                        <Td>{t.totalHours.toFixed(2)}</Td>
                                        <Td className="font-mono text-xs">
                                            {hoursLabel(t.dailyHoursJson as Record<string, number>)}
                                        </Td>
                                        <Td>
                                            <TimesheetActions id={t._id} status={t.status} />
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardBody className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">All timesheets</h2>
                    {all.length === 0 ? (
                        <EmptyState
                            icon={ClockIcon}
                            title="No timesheets yet"
                            description="Workers log weekly hours against an active placement."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Week</Th>
                                    <Th>Hours</Th>
                                    <Th>Status</Th>
                                    <Th>Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {all.map((t) => (
                                    <Tr key={t._id}>
                                        <Td>{new Date(t.weekStart).toLocaleDateString()}</Td>
                                        <Td>{t.totalHours.toFixed(2)}</Td>
                                        <Td><Badge variant="secondary">{t.status}</Badge></Td>
                                        <Td>
                                            <TimesheetActions id={t._id} status={t.status} />
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
