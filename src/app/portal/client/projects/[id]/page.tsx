import React from "react";
import { fmtINR } from "@/lib/utils";
/**
 * /portal/client/projects/[id] — Read-only project detail.
 *
 * Tabs rendered with a button group (NOT ZoruTabs), per spec:
 *   Overview · Tasks · Milestones · Files · Invoices · Submit Rating
 *
 * Tab state is driven by `?tab=...` so deep-linking works on a server
 * component without any client-side router.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getClientProjectById } from '@/app/actions/client-portal.actions';
import { Badge } from '@/components/zoruui/badge';
import {
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui/card';
import {
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui/table';
import { Progress } from '@/components/zoruui/progress';
import { cn } from '@/components/zoruui/lib/cn';

type TabKey = 'overview' | 'tasks' | 'milestones' | 'files' | 'invoices' | 'rating';

const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'milestones', label: 'Milestones' },
    { key: 'files', label: 'Files' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'rating', label: 'Submit Rating' },
];

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}


async function ClientProjectDetailPageContent({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ tab?: string }>;
}) {
    const { id } = await params;
    const sp = await searchParams;
    const data = await getClientProjectById(id);
    if (!data) notFound();
    const { project, tasks, invoices } = data;

    const tab: TabKey = (TABS.find((t) => t.key === sp.tab)?.key ?? 'overview') as TabKey;

    return (
        <div className="flex flex-col gap-4">
            <Link
                href="/portal/client/projects"
                className="self-start text-sm text-zoru-ink-muted hover:underline"
            >
                ← Back to projects
            </Link>

            <Card>
                <ZoruCardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                        <ZoruCardTitle>{project.name}</ZoruCardTitle>
                        {project.description ? (
                            <p className="mt-1 max-w-2xl text-sm text-zoru-ink-muted">
                                {project.description}
                            </p>
                        ) : null}
                    </div>
                    <Badge>{project.status}</Badge>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Start</dt>
                            <dd className="text-zoru-ink">{fmtDate(project.startDate)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Deadline</dt>
                            <dd className="text-zoru-ink">{fmtDate(project.endDate)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Manager</dt>
                            <dd className="text-zoru-ink">{project.managerName ?? '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Budget</dt>
                            <dd className="text-zoru-ink">{fmtINR(project.budget, project.currency)}</dd>
                        </div>
                        <div className="col-span-2 sm:col-span-4">
                            <dt className="text-xs text-zoru-ink-muted">Progress</dt>
                            <dd className="mt-1 flex items-center gap-3">
                                <Progress value={project.progress} className="max-w-md flex-1" />
                                <span className="text-xs text-zoru-ink-muted">{project.progress}%</span>
                            </dd>
                        </div>
                    </dl>
                </ZoruCardContent>
            </Card>

            {/* Button-group tabs (NOT ZoruTabs) */}
            <div className="flex flex-wrap gap-1 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-1">
                {TABS.map((t) => {
                    const active = t.key === tab;
                    return (
                        <Link
                            key={t.key}
                            href={`/portal/client/projects/${project._id}?tab=${t.key}`}
                            className={cn(
                                'rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors',
                                active
                                    ? 'bg-zoru-surface-2 text-zoru-ink'
                                    : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                            )}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </div>

            {tab === 'overview' && (
                <Card>
                    <ZoruCardContent className="text-sm text-zoru-ink-muted">
                        {project.description ?? 'No additional details available.'}
                    </ZoruCardContent>
                </Card>
            )}

            {tab === 'tasks' && (
                <Card>
                    <ZoruCardContent className="p-0">
                        {tasks.length === 0 ? (
                            <div className="p-6 text-center text-sm text-zoru-ink-muted">
                                No tasks yet.
                            </div>
                        ) : (
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow>
                                        <ZoruTableHead>Title</ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                        <ZoruTableHead>Priority</ZoruTableHead>
                                        <ZoruTableHead>Due</ZoruTableHead>
                                        <ZoruTableHead>Assignee</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {tasks.map((t) => (
                                        <ZoruTableRow key={t._id}>
                                            <ZoruTableCell>{t.title}</ZoruTableCell>
                                            <ZoruTableCell>
                                                <Badge variant="outline">{t.status}</Badge>
                                            </ZoruTableCell>
                                            <ZoruTableCell>{t.priority ?? '—'}</ZoruTableCell>
                                            <ZoruTableCell>{fmtDate(t.dueDate)}</ZoruTableCell>
                                            <ZoruTableCell>{t.assigneeName ?? '—'}</ZoruTableCell>
                                        </ZoruTableRow>
                                    ))}
                                </ZoruTableBody>
                            </Table>
                        )}
                    </ZoruCardContent>
                </Card>
            )}

            {tab === 'milestones' && (
                <Card>
                    <ZoruCardContent className="text-sm text-zoru-ink-muted">
                        No milestones available for this project yet.
                    </ZoruCardContent>
                </Card>
            )}

            {tab === 'files' && (
                <Card>
                    <ZoruCardContent className="text-sm text-zoru-ink-muted">
                        Project files will appear here. Use the download link on each
                        file to save it locally.
                    </ZoruCardContent>
                </Card>
            )}

            {tab === 'invoices' && (
                <Card>
                    <ZoruCardContent className="p-0">
                        {invoices.length === 0 ? (
                            <div className="p-6 text-center text-sm text-zoru-ink-muted">
                                No invoices for this project.
                            </div>
                        ) : (
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow>
                                        <ZoruTableHead>Number</ZoruTableHead>
                                        <ZoruTableHead>Date</ZoruTableHead>
                                        <ZoruTableHead>Total</ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {invoices.map((inv) => (
                                        <ZoruTableRow key={inv._id}>
                                            <ZoruTableCell>
                                                <Link
                                                    href={`/portal/client/invoices/${inv._id}`}
                                                    className="font-medium text-zoru-ink hover:underline"
                                                >
                                                    {inv.invoiceNumber}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell>{fmtDate(inv.invoiceDate)}</ZoruTableCell>
                                            <ZoruTableCell>{fmtINR(inv.total, inv.currency)}</ZoruTableCell>
                                            <ZoruTableCell>
                                                <Badge variant="outline">{inv.status}</Badge>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))}
                                </ZoruTableBody>
                            </Table>
                        )}
                    </ZoruCardContent>
                </Card>
            )}

            {tab === 'rating' && (
                <Card>
                    <ZoruCardContent className="text-sm text-zoru-ink-muted">
                        A rating link will appear here once your project manager
                        sends one. Check your email for the share link.
                    </ZoruCardContent>
                </Card>
            )}
        </div>
    );
}


export default function ClientProjectDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientProjectDetailPageContent params={params} searchParams={searchParams} />
    </React.Suspense>
  );
}
