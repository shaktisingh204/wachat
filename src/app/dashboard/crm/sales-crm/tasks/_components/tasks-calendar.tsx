'use client';

import { Button, Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * <TasksCalendar> — month-grid calendar view grouped by `dueDate`.
 *
 * Mirrors the Deals calendar layout. The user can step through months
 * with the prev/next buttons. Each cell lists up to 3 tasks plus an
 * "N more" link that scrolls open a popover (deferred — TODO 1D.4).
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmTask } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface TasksCalendarProps {
    tasks: WithId<CrmTask>[];
}

function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildGrid(monthStart: Date): Date[] {
    const days: Date[] = [];
    const firstDayWeekday = monthStart.getDay();
    const leading = firstDayWeekday;
    const start = new Date(monthStart);
    start.setDate(start.getDate() - leading);
    for (let i = 0; i < 42; i += 1) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        days.push(d);
    }
    return days;
}

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export function TasksCalendar({ tasks }: TasksCalendarProps) {
    const [cursor, setCursor] = React.useState<Date>(() => startOfMonth(new Date()));
    const monthLabel = cursor.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });
    const days = React.useMemo(() => buildGrid(cursor), [cursor]);

    const tasksByDay = React.useMemo(() => {
        const map = new Map<string, WithId<CrmTask>[]>();
        for (const t of tasks) {
            if (!t.dueDate) continue;
            const d = new Date(t.dueDate);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const arr = map.get(key) ?? [];
            arr.push(t);
            map.set(key, arr);
        }
        return map;
    }, [tasks]);

    const today = new Date();
    return (
        <Card>
            <ZoruCardContent className="space-y-3 pt-4">
                <header className="flex items-center justify-between">
                    <h3 className="text-[15px] font-medium text-[var(--st-text)]">{monthLabel}</h3>
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                const d = new Date(cursor);
                                d.setMonth(d.getMonth() - 1);
                                setCursor(startOfMonth(d));
                            }}
                            aria-label="Previous month"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCursor(startOfMonth(new Date()))}
                        >
                            Today
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                const d = new Date(cursor);
                                d.setMonth(d.getMonth() + 1);
                                setCursor(startOfMonth(d));
                            }}
                            aria-label="Next month"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </header>

                <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-[var(--st-border)] bg-[var(--st-border)]">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <div
                            key={d}
                            className="bg-[var(--st-bg-muted)] px-2 py-1 text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]"
                        >
                            {d}
                        </div>
                    ))}
                    {days.map((d) => {
                        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                        const rows = tasksByDay.get(key) ?? [];
                        const inMonth = d.getMonth() === cursor.getMonth();
                        const isToday = isSameDay(d, today);
                        return (
                            <div
                                key={key}
                                className={[
                                    'min-h-[110px] bg-[var(--st-bg)] p-1.5 text-[11.5px]',
                                    inMonth ? '' : 'opacity-50',
                                    isToday ? 'ring-1 ring-inset ring-[var(--st-text)]' : '',
                                ].join(' ')}
                            >
                                <div
                                    className={[
                                        'mb-1 flex items-center justify-between',
                                        isToday ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]',
                                    ].join(' ')}
                                >
                                    <span>{d.getDate()}</span>
                                    {rows.length > 0 ? (
                                        <span className="rounded-full bg-[var(--st-bg-muted)] px-1.5 text-[10.5px]">
                                            {rows.length}
                                        </span>
                                    ) : null}
                                </div>
                                <ul className="space-y-1">
                                    {rows.slice(0, 3).map((t) => {
                                        const status = (t.status as string) || 'To-Do';
                                        return (
                                            <li key={String(t._id)}>
                                                <Link
                                                    href={`/dashboard/crm/sales-crm/tasks/${String(
                                                        t._id,
                                                    )}`}
                                                    className="block truncate rounded bg-[var(--st-bg-muted)] px-1.5 py-0.5 hover:bg-[var(--st-bg-secondary)]"
                                                    title={t.title}
                                                >
                                                    <span className="inline-flex items-center gap-1">
                                                        <span
                                                            aria-hidden
                                                            className={[
                                                                'inline-block h-1.5 w-1.5 rounded-full',
                                                                statusToTone(status) === 'red'
                                                                    ? 'bg-[var(--st-danger)]'
                                                                    : statusToTone(status) === 'green'
                                                                    ? 'bg-[var(--st-status-ok)]'
                                                                    : statusToTone(status) === 'amber'
                                                                    ? 'bg-[var(--st-warn)]'
                                                                    : 'bg-[var(--st-text-secondary)]',
                                                            ].join(' ')}
                                                        />
                                                        <span className="truncate">{t.title}</span>
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                    {rows.length > 3 ? (
                                        <li className="px-1.5 text-[10.5px] text-[var(--st-text-secondary)]">
                                            +{rows.length - 3} more
                                        </li>
                                    ) : null}
                                </ul>
                            </div>
                        );
                    })}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
                    Legend:
                    <StatusPill label="To-Do" tone={statusToTone('To-Do')} />
                    <StatusPill label="In Progress" tone={statusToTone('In Progress')} />
                    <StatusPill label="Completed" tone={statusToTone('Completed')} />
                </div>
            </ZoruCardContent>
        </Card>
    );
}

export default TasksCalendar;
