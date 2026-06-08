import * as React from 'react';
import { Suspense } from 'react';
import { CalendarRange, Clock, ListChecks, Receipt } from 'lucide-react';

import { listSabpracticeTimeLogs } from '@/app/actions/sabpractice.actions';
import {
    Badge,
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Skeleton,
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
    const peak = Math.max(0, ...days.map((d) => dayTotals.get(d.key)?.hours ?? 0));
    const billablePct =
        list.totalHours > 0 ? Math.round((list.billableHours / list.totalHours) * 100) : 0;

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabPractice</PageEyebrow>
                    <PageTitle>Time</PageTitle>
                    <PageDescription>
                        Week of {weekStart.toLocaleDateString()} to {weekEnd.toLocaleDateString()}.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <section aria-label="Time metrics" className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Hours this week"
                    value={list.totalHours.toFixed(1)}
                    icon={Clock}
                    accent="#3b7af5"
                />
                <StatCard
                    label="Billable"
                    value={list.billableHours.toFixed(1)}
                    icon={Receipt}
                    accent="#1f9d55"
                    delta={{ value: `${billablePct}% of total`, tone: 'neutral' }}
                />
                <StatCard
                    label="Entries"
                    value={String(list.items.length)}
                    icon={ListChecks}
                    accent="#7c3aed"
                />
            </section>

            <Card>
                <CardHeader className="flex flex-row items-center gap-2.5">
                    <span
                        className="inline-flex size-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                    >
                        <Clock size={15} />
                    </span>
                    <div>
                        <CardTitle>Log time</CardTitle>
                        <CardDescription>Record hours against a task.</CardDescription>
                    </div>
                </CardHeader>
                <CardBody>
                    <LogTimeForm />
                </CardBody>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2.5">
                        <span
                            className="inline-flex size-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                            aria-hidden="true"
                        >
                            <CalendarRange size={15} />
                        </span>
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
                                    const isPeak = peak > 0 && t.hours === peak;
                                    return (
                                        <Tr key={d.key}>
                                            <Td className={isPeak ? 'font-semibold' : undefined}>
                                                {d.date.toLocaleDateString(undefined, {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {t.hours.toFixed(2)}
                                            </Td>
                                            <Td
                                                align="right"
                                                className="tabular-nums text-[var(--st-text-secondary)]"
                                            >
                                                {t.billable.toFixed(2)}
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-2.5">
                        <span
                            className="inline-flex size-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                            aria-hidden="true"
                        >
                            <ListChecks size={15} />
                        </span>
                        <CardTitle>Entries</CardTitle>
                    </CardHeader>
                    <CardBody>
                        {list.items.length === 0 ? (
                            <EmptyState
                                icon={Clock}
                                title="No time logged this week"
                                description="Use the form above to record your first entry."
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
                                            <Td className="tabular-nums">
                                                {new Date(tl.date).toLocaleDateString()}
                                            </Td>
                                            <Td className="text-sm text-[var(--st-text-secondary)]">
                                                {tl.taskId ? `Task ${tl.taskId.slice(-6)}` : '—'}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {tl.hours.toFixed(2)}
                                            </Td>
                                            <Td className="text-sm text-[var(--st-text-secondary)]">
                                                {tl.notes ?? '—'}
                                            </Td>
                                            <Td>
                                                {tl.billable ? (
                                                    <Badge tone="success">Billable</Badge>
                                                ) : (
                                                    <Badge tone="neutral">Non-billable</Badge>
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
        </div>
    );
}

function TimeSkeleton() {
    return (
        <div className="space-y-6" aria-busy="true" aria-label="Loading time">
            <div className="space-y-2">
                <Skeleton width={90} height={12} />
                <Skeleton width={120} height={26} />
                <Skeleton width={300} height={14} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height={92} />
                ))}
            </div>
            <Skeleton height={140} />
            <Skeleton height={280} />
        </div>
    );
}

export default function TimePage() {
    return (
        <Suspense fallback={<TimeSkeleton />}>
            <TimeData />
        </Suspense>
    );
}
