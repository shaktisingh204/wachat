import Link from 'next/link';
import {
    CalendarClock,
    CheckCircle2,
    Contact as ContactIcon,
    Handshake,
    Layers,
} from 'lucide-react';

import { Button, Card } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';

import { SabbiginNav } from './_components/sabbigin-shell';
import {
    sabbiginCount,
    sabbiginRecent,
    formatCurrency,
    todayRange,
} from './_components/sabbigin-data';

export const dynamic = 'force-dynamic';

interface DealDoc {
    _id: string;
    name?: string;
    title?: string;
    value?: number;
    stage?: string;
    expectedCloseDate?: string;
    createdAt?: string;
}

interface ContactDoc {
    _id: string;
    name?: string;
    company?: string;
    createdAt?: string;
}

interface TaskDoc {
    _id: string;
    title?: string;
    dueDate?: string;
    status?: string;
}

interface ActivityDoc {
    _id: string;
    subject?: string;
    type?: string;
    dueDate?: string;
}

export default async function SabbiginHomePage() {
    const { gte: todayStart, lt: todayEnd } = todayRange();

    const [openDeals, openTasks, recentContacts, todaysTasks, upcomingMeetings, topDeals] =
        await Promise.all([
            sabbiginCount('crm_deals', { status: { $nin: ['won', 'lost'] } }),
            sabbiginCount('crm_tasks', { status: { $nin: ['done', 'completed', 'cancelled'] } }),
            sabbiginRecent<ContactDoc>('crm_contacts', { limit: 5 }),
            sabbiginRecent<TaskDoc>('crm_tasks', {
                sortField: 'dueDate',
                limit: 5,
                filter: {
                    status: { $nin: ['done', 'completed', 'cancelled'] },
                    dueDate: { $gte: todayStart, $lt: todayEnd },
                },
            }),
            sabbiginRecent<ActivityDoc>('crm_activities', {
                sortField: 'dueDate',
                limit: 5,
                filter: {
                    type: 'meeting',
                    status: { $ne: 'completed' },
                    dueDate: { $gte: todayStart },
                },
            }),
            sabbiginRecent<DealDoc>('crm_deals', {
                sortField: 'value',
                limit: 3,
                filter: { status: { $nin: ['won', 'lost'] } },
            }),
        ]);

    return (
        <EntityListShell title="SabBigin" subtitle="Your micro-business CRM — focused on contacts, one pipeline, and what's next.">
            <div className="flex flex-col gap-6">
                <SabbiginNav active="/dashboard/sabbigin" />

                {/* KPI strip */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <KpiTile label="Open Deals" value={openDeals} icon={Handshake} href="/dashboard/sabbigin/pipeline" />
                    <KpiTile label="Tasks To Do" value={openTasks} icon={CheckCircle2} href="/dashboard/sabbigin/dashboard" />
                    <KpiTile label="Today's Tasks" value={todaysTasks.length} icon={CalendarClock} href="/dashboard/sabbigin/dashboard" />
                    <KpiTile label="Recent Contacts" value={recentContacts.length} icon={ContactIcon} href="/dashboard/sabbigin/contacts" />
                </div>

                {/* Pipeline summary card */}
                <Card className="p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
                            <h2 className="text-sm font-semibold text-[var(--st-text)]">Your pipeline</h2>
                        </div>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard/sabbigin/pipeline">Open board</Link>
                        </Button>
                    </div>
                    {topDeals.length === 0 ? (
                        <p className="mt-3 text-sm text-[var(--st-text-secondary)]">No open deals yet. Create your first deal from the pipeline board.</p>
                    ) : (
                        <ul className="mt-3 divide-y divide-[var(--st-border)]">
                            {topDeals.map((d) => (
                                <li key={d._id} className="flex items-center justify-between py-2 text-sm">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-[var(--st-text)]">
                                            {d.name ?? d.title ?? 'Untitled deal'}
                                        </p>
                                        <p className="truncate text-xs text-[var(--st-text-secondary)]">
                                            {d.stage ?? '—'}
                                        </p>
                                    </div>
                                    <p className="shrink-0 text-sm font-medium text-[var(--st-text)]">
                                        {formatCurrency(d.value ?? 0)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                {/* Two column lists */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <ListCard
                        title="Today's tasks"
                        emptyHint="Nothing on today. Nice."
                        rows={todaysTasks.map((t) => ({
                            id: t._id,
                            primary: t.title ?? 'Task',
                            secondary: t.status ?? 'open',
                            href: `/dashboard/crm/sales-crm/tasks/${t._id}`,
                        }))}
                        viewAllHref="/dashboard/sabbigin/dashboard"
                    />
                    <ListCard
                        title="Upcoming meetings"
                        emptyHint="No meetings scheduled."
                        rows={upcomingMeetings.map((m) => ({
                            id: m._id,
                            primary: m.subject ?? 'Meeting',
                            secondary: m.dueDate
                                ? new Date(m.dueDate).toLocaleString()
                                : 'No date',
                            href: `/dashboard/crm/sales-crm/tasks/${m._id}`,
                        }))}
                        viewAllHref="/dashboard/sabbigin/calls"
                    />
                </div>

                {/* Recent contacts */}
                <ListCard
                    title="Recently added contacts"
                    emptyHint="No contacts yet."
                    rows={recentContacts.map((c) => ({
                        id: c._id,
                        primary: c.name ?? 'Contact',
                        secondary: c.company ?? '—',
                        href: `/dashboard/sabbigin/contacts/${c._id}`,
                    }))}
                    viewAllHref="/dashboard/sabbigin/contacts"
                />
            </div>
        </EntityListShell>
    );
}

function KpiTile({
    label,
    value,
    icon: Icon,
    href,
}: {
    label: string;
    value: number | string;
    icon: React.ElementType;
    href: string;
}) {
    return (
        <Link href={href} className="block">
            <Card className="h-full p-4">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        {label}
                    </p>
                    <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                </div>
                <p className="mt-2 text-[22px] font-semibold leading-none tracking-tight text-[var(--st-text)]">
                    {value}
                </p>
            </Card>
        </Link>
    );
}

function ListCard({
    title,
    rows,
    emptyHint,
    viewAllHref,
}: {
    title: string;
    rows: { id: string; primary: string; secondary: string; href?: string }[];
    emptyHint: string;
    viewAllHref?: string;
}) {
    return (
        <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">{title}</h2>
                {viewAllHref ? (
                    <Link
                        href={viewAllHref}
                        className="text-xs font-medium text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                    >
                        View all
                    </Link>
                ) : null}
            </div>
            {rows.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--st-text-secondary)]">{emptyHint}</p>
            ) : (
                <ul className="mt-3 divide-y divide-[var(--st-border)]">
                    {rows.map((row) => {
                        const inner = (
                            <div className="flex items-center justify-between gap-3 py-2 text-sm">
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-[var(--st-text)]">{row.primary}</p>
                                    <p className="truncate text-xs text-[var(--st-text-secondary)]">{row.secondary}</p>
                                </div>
                            </div>
                        );
                        return (
                            <li key={row.id}>
                                {row.href ? (
                                    <Link href={row.href} className="block">
                                        {inner}
                                    </Link>
                                ) : (
                                    inner
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
