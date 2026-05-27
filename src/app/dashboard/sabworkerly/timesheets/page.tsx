import React from 'react';

import {
    Card,
    CardContent,
    PageHeader,
    ZoruPageTitle,
    ZoruPageDescription,
    Badge,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    EmptyState,
} from '@/components/zoruui';
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
                <ZoruPageTitle>Timesheets</ZoruPageTitle>
                <ZoruPageDescription>
                    Pending approvals · log new weekly hours · audit log.
                </ZoruPageDescription>
            </PageHeader>

            <Card>
                <CardContent className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">Log a weekly timesheet</h2>
                    <NewTimesheetForm placements={placements.map((p) => ({
                        id: p._id,
                        label: `${p.workerId.slice(-6)} on ${p.jobId.slice(-6)}`,
                        workerId: p.workerId,
                    }))} />
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">
                        Pending approvals ({pending.length})
                    </h2>
                    {pending.length === 0 ? (
                        <p className="text-sm text-[color:var(--zoru-muted-fg)]">All caught up.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Week</TableHead>
                                    <TableHead>Hours</TableHead>
                                    <TableHead>Breakdown</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pending.map((t) => (
                                    <TableRow key={t._id}>
                                        <TableCell>{new Date(t.weekStart).toLocaleDateString()}</TableCell>
                                        <TableCell>{t.totalHours.toFixed(2)}</TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {hoursLabel(t.dailyHoursJson as Record<string, number>)}
                                        </TableCell>
                                        <TableCell>
                                            <TimesheetActions id={t._id} status={t.status} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">All timesheets</h2>
                    {all.length === 0 ? (
                        <EmptyState
                            icon={ClockIcon}
                            title="No timesheets yet"
                            description="Workers log weekly hours against an active placement."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Week</TableHead>
                                    <TableHead>Hours</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {all.map((t) => (
                                    <TableRow key={t._id}>
                                        <TableCell>{new Date(t.weekStart).toLocaleDateString()}</TableCell>
                                        <TableCell>{t.totalHours.toFixed(2)}</TableCell>
                                        <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                                        <TableCell>
                                            <TimesheetActions id={t._id} status={t.status} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
