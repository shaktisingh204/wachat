import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

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
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    PageHeader,
    Separator,
} from '@/components/sabcrm/20ui/compat';

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

    return (
        <div className="space-y-6">
            <PageHeader>
                <div className="flex w-full items-start justify-between gap-4">
                    <div>
                        <Link
                            href="/dashboard/sabpractice/clients"
                            className="text-xs text-[var(--st-text-secondary)] underline-offset-2 hover:underline"
                        >
                            ← All clients
                        </Link>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                            {client.name}
                        </h1>
                        <p className="text-sm text-[var(--st-text-secondary)]">
                            {client.industry ?? '—'} · {client.primaryContactName ?? 'No contact'}
                        </p>
                    </div>
                    <Badge>{client.status ?? 'active'}</Badge>
                </div>
            </PageHeader>

            {/* Overview */}
            <Card>
                <CardHeader>
                    <CardTitle>Overview</CardTitle>
                    <CardDescription>Snapshot of work for this client.</CardDescription>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                        <div>
                            <dt className="text-[var(--st-text-secondary)]">Engagements</dt>
                            <dd className="text-lg font-semibold">{engagements.items.length}</dd>
                        </div>
                        <div>
                            <dt className="text-[var(--st-text-secondary)]">Open tasks</dt>
                            <dd className="text-lg font-semibold">
                                {tasks.items.filter((t) => t.status !== 'done').length}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[var(--st-text-secondary)]">Hours logged</dt>
                            <dd className="text-lg font-semibold">
                                {(timeLogs.totalHours ?? 0).toFixed(1)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[var(--st-text-secondary)]">Open deadlines</dt>
                            <dd className="text-lg font-semibold">
                                {deadlines.items.filter((d) => d.status !== 'filed').length}
                            </dd>
                        </div>
                    </dl>
                </CardContent>
            </Card>

            {/* Engagements */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Engagements</CardTitle>
                        <CardDescription>Scoped work blocks with billing terms.</CardDescription>
                    </div>
                    <CreateEngagementButton clientId={clientId} />
                </CardHeader>
                <CardContent>
                    {engagements.items.length === 0 ? (
                        <EmptyState
                            title="No engagements"
                            description="Create an engagement to organise scope, time and billing."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border-light)]">
                            {engagements.items.map((e) => (
                                <li
                                    key={e._id}
                                    className="flex items-center justify-between py-2 text-sm"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{e.name}</span>
                                        <span className="text-xs text-[var(--st-text-secondary)]">
                                            {e.billingCadence ?? 'no cadence'} ·{' '}
                                            {e.hourlyRateMinor
                                                ? `${(e.hourlyRateMinor / 100).toFixed(2)} ${e.currency ?? ''}`
                                                : 'no rate'}{' '}
                                            · {e._id?.slice(-6)}
                                        </span>
                                    </div>
                                    <Badge>{e.status ?? 'active'}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {/* Documents */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Documents</CardTitle>
                        <CardDescription>
                            File uploads source from SabFiles only.
                        </CardDescription>
                    </div>
                    <NewDocRequestButton clientId={clientId} />
                </CardHeader>
                <CardContent>
                    {docRequests.items.length === 0 ? (
                        <EmptyState
                            title="No document requests"
                            description="Request a document from the client."
                        />
                    ) : (
                        <ul className="space-y-4">
                            {docRequests.items.map((r) => (
                                <li
                                    key={r._id}
                                    className="rounded-md border border-[var(--st-border-light)] p-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{r.title}</p>
                                            {r.dueDate ? (
                                                <p className="text-xs text-[var(--st-text-secondary)]">
                                                    Due{' '}
                                                    {new Date(r.dueDate).toLocaleDateString()}
                                                </p>
                                            ) : null}
                                        </div>
                                        <Badge>{r.status ?? 'requested'}</Badge>
                                    </div>
                                    <Separator className="my-2" />
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
                </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Tasks</CardTitle>
                        <CardDescription>Work items inside engagements.</CardDescription>
                    </div>
                    <CreateTaskButton clientId={clientId} />
                </CardHeader>
                <CardContent>
                    {tasks.items.length === 0 ? (
                        <EmptyState
                            title="No tasks yet"
                            description="Create a task under an engagement."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border-light)]">
                            {tasks.items.map((t) => (
                                <li
                                    key={t._id}
                                    className="flex items-center justify-between py-2 text-sm"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{t.title}</span>
                                        <span className="text-xs text-[var(--st-text-secondary)]">
                                            {t.assigneeUserId ?? 'unassigned'} ·{' '}
                                            {(t.hoursSpent ?? 0).toFixed(1)}h ·{' '}
                                            {t.billable ? 'billable' : 'non-billable'}
                                        </span>
                                    </div>
                                    <Badge>{t.status ?? 'todo'}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {/* Time */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Recent time</CardTitle>
                        <CardDescription>
                            {timeLogs.totalHours.toFixed(1)}h total ·{' '}
                            {timeLogs.billableHours.toFixed(1)}h billable.
                        </CardDescription>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/dashboard/sabpractice/time">Open time grid</Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    {timeLogs.items.length === 0 ? (
                        <EmptyState
                            title="No time logged"
                            description="Log time against any task for this client."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border-light)]">
                            {timeLogs.items.slice(0, 10).map((tl) => (
                                <li
                                    key={tl._id}
                                    className="flex items-center justify-between py-2 text-sm"
                                >
                                    <div>
                                        <span className="font-medium">
                                            {tl.hours.toFixed(2)}h
                                        </span>
                                        <span className="ml-2 text-xs text-[var(--st-text-secondary)]">
                                            {new Date(tl.date).toLocaleDateString()} ·{' '}
                                            {tl.loggerUserId}
                                        </span>
                                    </div>
                                    {tl.billable ? <Badge>billable</Badge> : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {/* Advisory */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Advisory notes</CardTitle>
                        <CardDescription>
                            Insights, actions and risks; share to the client portal.
                        </CardDescription>
                    </div>
                    <CreateAdvisoryNoteButton clientId={clientId} />
                </CardHeader>
                <CardContent>
                    {advisoryNotes.items.length === 0 ? (
                        <EmptyState
                            title="No advisory notes"
                            description="Capture an insight or action item for this client."
                        />
                    ) : (
                        <ul className="space-y-3">
                            {advisoryNotes.items.map((n) => (
                                <li
                                    key={n._id}
                                    className="rounded-md border border-[var(--st-border-light)] p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium">{n.title}</p>
                                            <p className="text-xs text-[var(--st-text-secondary)]">
                                                {n.kind ?? 'insight'} ·{' '}
                                                {n.status === 'shared'
                                                    ? `shared ${n.sharedAt ? new Date(n.sharedAt).toLocaleDateString() : ''}`
                                                    : 'draft'}
                                            </p>
                                        </div>
                                        {n.status !== 'shared' ? (
                                            <ShareAdvisoryNoteButton id={n._id!} />
                                        ) : (
                                            <Badge>shared</Badge>
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
                </CardContent>
            </Card>

            {/* Deadlines */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Deadlines</CardTitle>
                        <CardDescription>
                            Compliance dates — tax, payroll, GST, audit.
                        </CardDescription>
                    </div>
                    <CreateDeadlineButton clientId={clientId} />
                </CardHeader>
                <CardContent>
                    {deadlines.items.length === 0 ? (
                        <EmptyState
                            title="No deadlines"
                            description="Add a recurring or one-off compliance deadline."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border-light)]">
                            {deadlines.items.map((d) => (
                                <li
                                    key={d._id}
                                    className="flex items-center justify-between py-2 text-sm"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{d.name}</span>
                                        <span className="text-xs text-[var(--st-text-secondary)]">
                                            {d.kind ?? 'custom'} · due{' '}
                                            {new Date(d.dueDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <Badge>{d.status ?? 'upcoming'}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default async function ClientCockpitPage({ params }: Props) {
    const { clientId } = await params;
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading client…</div>
            }
        >
            <ClientCockpit clientId={clientId} />
        </Suspense>
    );
}
