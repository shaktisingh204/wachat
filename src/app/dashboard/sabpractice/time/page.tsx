import * as React from 'react';
import { Suspense } from 'react';
import { Clock } from 'lucide-react';

import { listSabpracticeTimeLogs } from '@/app/actions/sabpractice.actions';
import {
    Badge,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    EmptyState,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from '@/components/sabcrm/20ui';

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
                <PageHeaderHeading>
                    <PageTitle>Time</PageTitle>
                    <PageDescription>
                        Week of {weekStart.toLocaleDateString()} to{' '}
                        {weekEnd.toLocaleDateString()}
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="This week" value={list.totalHours.toFixed(1)} />
                <StatCard label="Billable" value={list.billableHours.toFixed(1)} />
                <StatCard label="Entries" value={String(list.items.length)} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Log time</CardTitle>
                </CardHeader>
                <CardBody>
                    <LogTimeForm />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>By day</CardTitle>
                </CardHeader>
                <CardBody>
                    <Table>
                        <THead>
                            <Tr>
                                <Th>Day</Th>
                                <Th align="right">Hours</Th>
                                <Th align="right">Billable</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {days.map((d) => {
                                const t = dayTotals.get(d.key) ?? { hours: 0, billable: 0 };
                                return (
                                    <Tr key={d.key}>
                                        <Td>
                                            {d.date.toLocaleDateString(undefined, {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </Td>
                                        <Td align="right">{t.hours.toFixed(2)}</Td>
                                        <Td align="right">{t.billable.toFixed(2)}</Td>
                                    </Tr>
                                );
                            })}
                        </TBody>
                    </Table>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Entries</CardTitle>
                </CardHeader>
                <CardBody>
                    {list.items.length === 0 ? (
                        <EmptyState
                            icon={Clock}
                            title="No time logged this week"
                            description="Log time above to populate the grid."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Date</Th>
                                    <Th>Task</Th>
                                    <Th align="right">Hours</Th>
                                    <Th>Notes</Th>
                                    <Th>Billable</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {list.items.map((tl) => (
                                    <Tr key={tl._id}>
                                        <Td>{new Date(tl.date).toLocaleDateString()}</Td>
                                        <Td className="font-mono text-xs">
                                            {tl.taskId.slice(-6)}
                                        </Td>
                                        <Td align="right">{tl.hours.toFixed(2)}</Td>
                                        <Td className="text-sm text-[var(--st-text-secondary)]">
                                            {tl.notes ?? '-'}
                                        </Td>
                                        <Td>
                                            {tl.billable ? (
                                                <Badge tone="success">billable</Badge>
                                            ) : (
                                                '-'
                                            )}
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

export default function TimePage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--st-text-secondary)]">
                    Loading...
                </div>
            }
        >
            <TimeData />
        </Suspense>
    );
}
