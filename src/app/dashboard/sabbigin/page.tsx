import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
    ArrowUpRight,
    CalendarClock,
    CheckCircle2,
    Contact as ContactIcon,
    Handshake,
    Layers,
    ListChecks,
    Wallet,
} from 'lucide-react';

import {
    Badge,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    StatCard,
} from '@/components/sabcrm/20ui';

import {
    sabbiginCount,
    sabbiginRecent,
    sabbiginSum,
    formatCurrency,
    formatDateTime,
    stageTone,
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

    const [
        openDeals,
        openTasks,
        pipelineValue,
        contactsTotal,
        recentContacts,
        todaysTasks,
        upcomingMeetings,
        topDeals,
    ] = await Promise.all([
        sabbiginCount('crm_deals', { status: { $nin: ['won', 'lost'] } }),
        sabbiginCount('crm_tasks', { status: { $nin: ['done', 'completed', 'cancelled'] } }),
        sabbiginSum('crm_deals', 'value', { status: { $nin: ['won', 'lost'] } }),
        sabbiginCount('crm_contacts'),
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
            limit: 4,
            filter: { status: { $nin: ['won', 'lost'] } },
        }),
    ]);

    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin</PageEyebrow>
                    <PageTitle>Today at a glance</PageTitle>
                    <PageDescription>
                        Your micro-business CRM, focused on contacts, one pipeline, and what is next.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabbigin/contacts/new"
                        className="u-btn u-btn--primary u-btn--sm"
                    >
                        <ContactIcon size={13} aria-hidden="true" />
                        <span className="u-btn__label">New contact</span>
                    </Link>
                </PageActions>
            </PageHeader>

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label="Open pipeline"
                    value={formatCurrency(pipelineValue)}
                    icon={Wallet}
                    accent="#3b7af5"
                />
                <StatCard label="Open deals" value={openDeals} icon={Handshake} accent="#1f9d55" />
                <StatCard label="Tasks to do" value={openTasks} icon={ListChecks} accent="#7c3aed" />
                <StatCard label="Contacts" value={contactsTotal} icon={ContactIcon} accent="#0891b2" />
            </div>

            {/* Pipeline + today's tasks, asymmetric two-column */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Card padding="none">
                    <CardHeader>
                        <CardTitle className="inline-flex items-center gap-2">
                            <Layers className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={2} aria-hidden="true" />
                            Top open deals
                        </CardTitle>
                        <Link
                            href="/dashboard/sabbigin/pipeline"
                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
                        >
                            Open board
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    </CardHeader>
                    <CardBody className="pt-0">
                        {topDeals.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={Handshake}
                                title="No open deals yet"
                                description="Add a deal from the pipeline board to start tracking value."
                                action={
                                    <Link
                                        href="/dashboard/sabbigin/pipeline"
                                        className="u-btn u-btn--outline u-btn--sm"
                                    >
                                        <span className="u-btn__label">Go to pipeline</span>
                                    </Link>
                                }
                            />
                        ) : (
                            <ul className="divide-y divide-[var(--st-border)]">
                                {topDeals.map((d) => (
                                    <li
                                        key={d._id}
                                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[var(--st-text)]">
                                                    {d.name ?? d.title ?? 'Untitled deal'}
                                                </p>
                                                <Badge tone={stageTone(d.stage)} kind="soft">
                                                    {d.stage ?? 'No stage'}
                                                </Badge>
                                            </div>
                                        </div>
                                        <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--st-text)]">
                                            {formatCurrency(d.value ?? 0)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>

                <ListCard
                    title="Today's tasks"
                    icon={CheckCircle2}
                    emptyTitle="Nothing due today"
                    emptyHint="You are all caught up for today."
                    rows={todaysTasks.map((t) => ({
                        id: t._id,
                        primary: t.title ?? 'Task',
                        secondary: t.status ?? 'open',
                        href: `/dashboard/crm/sales-crm/tasks/${t._id}`,
                    }))}
                    viewAllHref="/dashboard/sabbigin/dashboard"
                />
            </div>

            {/* Meetings + recent contacts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ListCard
                    title="Upcoming meetings"
                    icon={CalendarClock}
                    emptyTitle="No meetings scheduled"
                    emptyHint="Meetings you log will show up here."
                    rows={upcomingMeetings.map((m) => ({
                        id: m._id,
                        primary: m.subject ?? 'Meeting',
                        secondary: formatDateTime(m.dueDate),
                        href: `/dashboard/crm/sales-crm/tasks/${m._id}`,
                    }))}
                    viewAllHref="/dashboard/sabbigin/calls"
                />
                <ListCard
                    title="Recently added contacts"
                    icon={ContactIcon}
                    emptyTitle="No contacts yet"
                    emptyHint="Add your first contact to start building your book."
                    rows={recentContacts.map((c) => ({
                        id: c._id,
                        primary: c.name ?? 'Contact',
                        secondary: c.company ?? 'No company',
                        href: `/dashboard/sabbigin/contacts/${c._id}`,
                    }))}
                    viewAllHref="/dashboard/sabbigin/contacts"
                />
            </div>
        </div>
    );
}

function ListCard({
    title,
    icon: Icon,
    rows,
    emptyTitle,
    emptyHint,
    viewAllHref,
}: {
    title: string;
    icon: LucideIcon;
    rows: { id: string; primary: string; secondary: string; href?: string }[];
    emptyTitle: string;
    emptyHint: string;
    viewAllHref?: string;
}) {
    return (
        <Card padding="none">
            <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={2} aria-hidden="true" />
                    {title}
                </CardTitle>
                {viewAllHref ? (
                    <Link
                        href={viewAllHref}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
                    >
                        View all
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                ) : null}
            </CardHeader>
            <CardBody className="pt-0">
                {rows.length === 0 ? (
                    <EmptyState size="sm" icon={Icon} title={emptyTitle} description={emptyHint} />
                ) : (
                    <ul className="divide-y divide-[var(--st-border)]">
                        {rows.map((row) => {
                            const inner = (
                                <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-[var(--st-text)]">
                                            {row.primary}
                                        </p>
                                        <p className="truncate text-xs text-[var(--st-text-secondary)]">
                                            {row.secondary}
                                        </p>
                                    </div>
                                </div>
                            );
                            return (
                                <li key={row.id} className="first:[&>*]:pt-0">
                                    {row.href ? (
                                        <Link
                                            href={row.href}
                                            className="-mx-2 block rounded-[var(--st-radius-sm)] px-2 transition-colors hover:bg-[var(--st-bg-muted)]"
                                        >
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
            </CardBody>
        </Card>
    );
}
