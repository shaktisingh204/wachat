import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
    ArrowLeft,
    ArrowUpRight,
    Briefcase,
    CalendarClock,
    CheckSquare,
    Clock,
    FileCheck2,
    Lightbulb,
    type LucideIcon,
} from 'lucide-react';

import {
    getSabpracticeClient,
    listSabpracticeAdvisoryNotes,
    listSabpracticeDeadlines,
    listSabpracticeDocumentRequests,
    listSabpracticeEngagements,
    listSabpracticeTasks,
    listSabpracticeTimeLogs,
} from '@/app/actions/sabpractice.actions';
import {
    Avatar,
    Badge,
    type BadgeTone,
    Button,
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    PageActions,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Separator,
    Skeleton,
    StatCard,
} from '@/components/sabcrm/20ui';

import {
    ClientDocRequestBinder,
    NewDocRequestButton,
} from './_components/client-doc-request-binder';
import {
    CreateAdvisoryNoteButton,
    CreateDeadlineButton,
    CreateEngagementButton,
    CreateTaskButton,
    ShareAdvisoryNoteButton,
} from './_components/client-quick-actions';

interface Props {
    params: Promise<{ clientId: string }>;
}

/** Section card with an icon-chipped title, description, and an action slot. */
function SectionHeader({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
}) {
    return (
        <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
                <span
                    className="mt-0.5 inline-flex size-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                    aria-hidden="true"
                >
                    <Icon size={15} />
                </span>
                <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
    );
}

function cap(s?: string): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function workTone(status?: string): BadgeTone {
    switch (status) {
        case 'active':
        case 'done':
        case 'filed':
        case 'approved':
            return 'success';
        case 'overdue':
            return 'danger';
        case 'in_progress':
        case 'upcoming':
            return 'info';
        case 'todo':
        case 'draft':
            return 'neutral';
        default:
            return 'neutral';
    }
}

function money(minor?: number, currency?: string): string {
    if (!minor) return 'No rate';
    return `${(minor / 100).toFixed(2)} ${currency ?? ''}`.trim();
}

async function ClientCockpit({ clientId }: { clientId: string }) {
    const client = await getSabpracticeClient(clientId);
    if (!client) notFound();

    const [engagements, docRequests, tasks, timeLogs, advisoryNotes, deadlines] =
        await Promise.all([
            listSabpracticeEngagements({ clientId, status: 'all', limit: 50 }),
            listSabpracticeDocumentRequests({ clientId, status: 'all', limit: 50 }),
            listSabpracticeTasks({ clientId, status: 'all', limit: 50 }),
            listSabpracticeTimeLogs({ clientId, limit: 25 }),
            listSabpracticeAdvisoryNotes({ clientId, status: 'all', limit: 25 }),
            listSabpracticeDeadlines({ clientId, status: 'all', limit: 25 }),
        ]);

    const openTasks = tasks.items.filter((t) => t.status !== 'done').length;
    const openDeadlines = deadlines.items.filter((d) => d.status !== 'filed').length;

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <Link
                        href="/dashboard/sabpractice/clients"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--st-text-secondary)] underline-offset-2 hover:text-[var(--st-text)] hover:underline"
                    >
                        <ArrowLeft size={13} aria-hidden="true" />
                        All clients
                    </Link>
                    <div className="mt-1.5 flex items-center gap-3">
                        <Avatar name={client.name} shape="square" size="lg" />
                        <div>
                            <PageTitle>{client.name}</PageTitle>
                            <PageDescription>
                                {client.industry ?? 'No industry'} ·{' '}
                                {client.primaryContactName ?? 'No contact'}
                            </PageDescription>
                        </div>
                    </div>
                </PageHeaderHeading>
                <PageActions>
                    <Badge tone={workTone(client.status)}>{cap(client.status) || 'Active'}</Badge>
                </PageActions>
            </PageHeader>

            {/* KPI strip */}
            <section
                aria-label="Client metrics"
                className="grid grid-cols-2 gap-4 md:grid-cols-4"
            >
                <StatCard
                    icon={Briefcase}
                    label="Engagements"
                    value={engagements.items.length}
                    accent="#7c3aed"
                />
                <StatCard
                    icon={CheckSquare}
                    label="Open tasks"
                    value={openTasks}
                    accent="#3b7af5"
                />
                <StatCard
                    icon={Clock}
                    label="Hours logged"
                    value={(timeLogs.totalHours ?? 0).toFixed(1)}
                    accent="#1f9d55"
                    delta={{
                        value: `${(timeLogs.billableHours ?? 0).toFixed(1)} billable`,
                        tone: 'neutral',
                    }}
                />
                <StatCard
                    icon={CalendarClock}
                    label="Open deadlines"
                    value={openDeadlines}
                    accent="#e0843b"
                />
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Engagements */}
                <Card>
                    <SectionHeader
                        icon={Briefcase}
                        title="Engagements"
                        description="Scoped work blocks with billing terms."
                        action={<CreateEngagementButton clientId={clientId} />}
                    />
                    <CardBody>
                        {engagements.items.length === 0 ? (
                            <EmptyState
                                icon={Briefcase}
                                title="No engagements"
                                description="Create an engagement to organise scope, time, and billing."
                            />
                        ) : (
                            <ul className="divide-y divide-[var(--st-border-light)]">
                                {engagements.items.map((e) => (
                                    <li
                                        key={e._id}
                                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                                    >
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium">{e.name}</span>
                                            <span className="text-xs text-[var(--st-text-secondary)]">
                                                {cap(e.billingCadence) || 'No cadence'} ·{' '}
                                                <span className="tabular-nums">
                                                    {money(e.hourlyRateMinor, e.currency)}
                                                </span>
                                            </span>
                                        </div>
                                        <Badge tone={workTone(e.status)}>
                                            {cap(e.status) || 'Active'}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>

                {/* Tasks */}
                <Card>
                    <SectionHeader
                        icon={CheckSquare}
                        title="Tasks"
                        description="Work items inside engagements."
                        action={<CreateTaskButton clientId={clientId} />}
                    />
                    <CardBody>
                        {tasks.items.length === 0 ? (
                            <EmptyState
                                icon={CheckSquare}
                                title="No tasks yet"
                                description="Create a task under an engagement to start tracking work."
                            />
                        ) : (
                            <ul className="divide-y divide-[var(--st-border-light)]">
                                {tasks.items.map((t) => (
                                    <li
                                        key={t._id}
                                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                                    >
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium">{t.title}</span>
                                            <span className="text-xs text-[var(--st-text-secondary)]">
                                                {t.assigneeUserId ? 'Assigned' : 'Unassigned'} ·{' '}
                                                <span className="tabular-nums">
                                                    {(t.hoursSpent ?? 0).toFixed(1)}h
                                                </span>{' '}
                                                · {t.billable ? 'Billable' : 'Non-billable'}
                                            </span>
                                        </div>
                                        <Badge tone={workTone(t.status)}>
                                            {cap(t.status) || 'To do'}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            </div>

            {/* Documents */}
            <Card>
                <SectionHeader
                    icon={FileCheck2}
                    title="Document requests"
                    description="Files source from SabFiles only — library or fresh upload."
                    action={<NewDocRequestButton clientId={clientId} />}
                />
                <CardBody>
                    {docRequests.items.length === 0 ? (
                        <EmptyState
                            icon={FileCheck2}
                            title="No document requests"
                            description="Request a document and the client can upload it into the bound slot."
                        />
                    ) : (
                        <ul className="space-y-3">
                            {docRequests.items.map((r) => (
                                <li
                                    key={r._id}
                                    className="rounded-[var(--st-radius)] border border-[var(--st-border-light)] p-3"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {r.title}
                                            </p>
                                            {r.dueDate ? (
                                                <p className="text-xs text-[var(--st-text-secondary)]">
                                                    Due{' '}
                                                    <span className="tabular-nums">
                                                        {new Date(r.dueDate).toLocaleDateString()}
                                                    </span>
                                                </p>
                                            ) : null}
                                        </div>
                                        <Badge tone={workTone(r.status)}>
                                            {cap(r.status) || 'Requested'}
                                        </Badge>
                                    </div>
                                    <Separator className="my-2.5" />
                                    <div className="space-y-1">
                                        {(r.requestedFiles ?? []).map((f, i) => (
                                            <ClientDocRequestBinder
                                                key={`${r._id}-${i}`}
                                                requestId={r._id!}
                                                slotIndex={i}
                                                slotName={f.name}
                                                currentStatus={f.status}
                                                currentFileUrl={f.fileUrl}
                                            />
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Time */}
                <Card>
                    <SectionHeader
                        icon={Clock}
                        title="Recent time"
                        description={`${timeLogs.totalHours.toFixed(1)}h total · ${timeLogs.billableHours.toFixed(1)}h billable`}
                        action={
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/dashboard/sabpractice/time">
                                    Time grid
                                    <ArrowUpRight size={14} aria-hidden="true" />
                                </Link>
                            </Button>
                        }
                    />
                    <CardBody>
                        {timeLogs.items.length === 0 ? (
                            <EmptyState
                                icon={Clock}
                                title="No time logged"
                                description="Log time against any task for this client."
                            />
                        ) : (
                            <ul className="divide-y divide-[var(--st-border-light)]">
                                {timeLogs.items.slice(0, 8).map((tl) => (
                                    <li
                                        key={tl._id}
                                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                                    >
                                        <div>
                                            <span className="font-medium tabular-nums">
                                                {tl.hours.toFixed(2)}h
                                            </span>
                                            <span className="ml-2 text-xs tabular-nums text-[var(--st-text-secondary)]">
                                                {new Date(tl.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {tl.billable ? (
                                            <Badge tone="success">Billable</Badge>
                                        ) : (
                                            <Badge tone="neutral">Non-billable</Badge>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>

                {/* Deadlines */}
                <Card>
                    <SectionHeader
                        icon={CalendarClock}
                        title="Deadlines"
                        description="Compliance dates for tax, payroll, GST, and audit."
                        action={<CreateDeadlineButton clientId={clientId} />}
                    />
                    <CardBody>
                        {deadlines.items.length === 0 ? (
                            <EmptyState
                                icon={CalendarClock}
                                title="No deadlines"
                                description="Add a recurring or one-off compliance deadline."
                            />
                        ) : (
                            <ul className="divide-y divide-[var(--st-border-light)]">
                                {deadlines.items.map((d) => (
                                    <li
                                        key={d._id}
                                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                                    >
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium">{d.name}</span>
                                            <span className="text-xs text-[var(--st-text-secondary)]">
                                                {cap(d.kind) || 'Custom'} · due{' '}
                                                <span className="tabular-nums">
                                                    {new Date(d.dueDate).toLocaleDateString()}
                                                </span>
                                            </span>
                                        </div>
                                        <Badge tone={workTone(d.status)}>
                                            {cap(d.status) || 'Upcoming'}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            </div>

            {/* Advisory */}
            <Card>
                <SectionHeader
                    icon={Lightbulb}
                    title="Advisory notes"
                    description="Insights, actions, and risks. Share to the client portal."
                    action={<CreateAdvisoryNoteButton clientId={clientId} />}
                />
                <CardBody>
                    {advisoryNotes.items.length === 0 ? (
                        <EmptyState
                            icon={Lightbulb}
                            title="No advisory notes"
                            description="Capture an insight, action item, or risk for this client."
                        />
                    ) : (
                        <ul className="space-y-3">
                            {advisoryNotes.items.map((n) => (
                                <li
                                    key={n._id}
                                    className="rounded-[var(--st-radius)] border border-[var(--st-border-light)] p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {n.title}
                                            </p>
                                            <p className="text-xs text-[var(--st-text-secondary)]">
                                                {cap(n.kind) || 'Insight'} ·{' '}
                                                {n.status === 'shared'
                                                    ? `Shared ${n.sharedAt ? new Date(n.sharedAt).toLocaleDateString() : ''}`.trim()
                                                    : 'Draft'}
                                            </p>
                                        </div>
                                        {n.status !== 'shared' ? (
                                            <ShareAdvisoryNoteButton id={n._id!} />
                                        ) : (
                                            <Badge tone="success">Shared</Badge>
                                        )}
                                    </div>
                                    {n.body ? (
                                        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--st-text)]">
                                            {n.body}
                                        </p>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

function CockpitSkeleton() {
    return (
        <div className="space-y-6" aria-busy="true" aria-label="Loading client">
            <div className="space-y-2">
                <Skeleton width={80} height={12} />
                <div className="flex items-center gap-3">
                    <Skeleton circle width={44} height={44} />
                    <div className="space-y-2">
                        <Skeleton width={200} height={24} />
                        <Skeleton width={280} height={13} />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} height={92} />
                ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton height={220} />
                <Skeleton height={220} />
            </div>
        </div>
    );
}

export default async function ClientCockpitPage({ params }: Props) {
    const { clientId } = await params;
    return (
        <Suspense fallback={<CockpitSkeleton />}>
            <ClientCockpit clientId={clientId} />
        </Suspense>
    );
}
