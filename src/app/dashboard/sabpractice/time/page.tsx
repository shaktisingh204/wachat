import * as React from 'react';
import { Suspense } from 'react';

import { listSabpracticeTimeLogs } from '@/app/actions/sabpractice.actions';
import {
    Badge,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
    PageHeader,
    StatCard,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/sabcrm/20ui/compat';

import { LogTimeForm } from './_components/log-time-form';

function startOfWeek(d: Date): Date {
    const day = d.getDay(); // 0 = Sun
    const diff = (day + 6) % 7; // Mon as start
    const s = new Date(d);
    s.setDate(d.getDate() - diff);
    s.setHours(0, 0, 0, 0);
    return s;
}

async function TimeData() {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const list = await listSabpracticeTimeLogs({
        from: weekStart.toISOString(),
        to: weekEnd.toISOString(),
        limit: 200,
    });

    const dayTotals = new Map<string, { hours: number; billable: number }>();
    for (const tl of list.items) {
        const key = new Date(tl.date).toISOString().slice(0, 10);
        const cur = dayTotals.get(key) ?? { hours: 0, billable: 0 };
        cur.hours += tl.hours;
        if (tl.billable) cur.billable += tl.hours;
        dayTotals.set(key, cur);
    }
    const days: { date: Date; key: string }[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return { date: d, key: d.toISOString().slice(0, 10) };
    });

    return (
        <div className="space-y-6">
            <PageHeader>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Time</h1>
                    <p className="text-sm text-[var(--zoru-ink-muted)]">
                        Week of {weekStart.toLocaleDateString()} —{' '}
                        {weekEnd.toLocaleDateString()}
                    </p>
                </div>
            </PageHeader>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="This week" value={list.totalHours.toFixed(1)} />
                <StatCard label="Billable" value={list.billableHours.toFixed(1)} />
                <StatCard
                    label="Entries"
                    value={String(list.items.length)}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Log time</CardTitle>
                </CardHeader>
                <CardContent>
                    <LogTimeForm />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>By day</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Day</TableHead>
                                <TableHead>Hours</TableHead>
                                <TableHead>Billable</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {days.map((d) => {
                                const t = dayTotals.get(d.key) ?? { hours: 0, billable: 0 };
                                return (
                                    <TableRow key={d.key}>
                                        <TableCell>
                                            {d.date.toLocaleDateString(undefined, {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </TableCell>
                                        <TableCell>{t.hours.toFixed(2)}</TableCell>
                                        <TableCell>{t.billable.toFixed(2)}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Entries</CardTitle>
                </CardHeader>
                <CardContent>
                    {list.items.length === 0 ? (
                        <EmptyState
                            title="No time logged this week"
                            description="Log time above to populate the grid."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Task</TableHead>
                                    <TableHead>Hours</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead>Billable</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {list.items.map((tl) => (
                                    <TableRow key={tl._id}>
                                        <TableCell>
                                            {new Date(tl.date).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {tl.taskId.slice(-6)}
                                        </TableCell>
                                        <TableCell>{tl.hours.toFixed(2)}</TableCell>
                                        <TableCell className="text-sm text-[var(--zoru-ink-muted)]">
                                            {tl.notes ?? '—'}
                                        </TableCell>
                                        <TableCell>
                                            {tl.billable ? <Badge>billable</Badge> : '—'}
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

export default function TimePage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--zoru-ink-muted)]">Loading…</div>
            }
        >
            <TimeData />
        </Suspense>
    );
}
