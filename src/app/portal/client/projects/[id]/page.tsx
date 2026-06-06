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
import { Badge } from '@/components/sabcrm/20ui/compat';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { Progress } from '@/components/sabcrm/20ui/compat';
import { cn } from '@/components/sabcrm/20ui/compat';

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
                className="self-start text-sm text-[var(--st-text-secondary)] hover:underline"
            >
                ← Back to projects
            </Link>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                        <CardTitle>{project.name}</CardTitle>
                        {project.description ? (
                            <p className="mt-1 max-w-2xl text-sm text-[var(--st-text-secondary)]">
                                {project.description}
                            </p>
                        ) : null}
                    </div>
                    <Badge>{project.status}</Badge>
                </CardHeader>
                <CardBody>
                    <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                        <div>
                            <dt className="text-xs text-[var(--st-text-secondary)]">Start</dt>
                            <dd className="text-[var(--st-text)]">{fmtDate(project.startDate)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text-secondary)]">Deadline</dt>
                            <dd className="text-[var(--st-text)]">{fmtDate(project.endDate)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text-secondary)]">Manager</dt>
                            <dd className="text-[var(--st-text)]">{project.managerName ?? '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text-secondary)]">Budget</dt>
                            <dd className="text-[var(--st-text)]">{fmtINR(project.budget, project.currency)}</dd>
                        </div>
                        <div className="col-span-2 sm:col-span-4">
                            <dt className="text-xs text-[var(--st-text-secondary)]">Progress</dt>
                            <dd className="mt-1 flex items-center gap-3">
                                <Progress value={project.progress} className="max-w-md flex-1" />
                                <span className="text-xs text-[var(--st-text-secondary)]">{project.progress}%</span>
                            </dd>
                        </div>
                    </dl>
                </CardBody>
            </Card>

            {/* Button-group tabs (NOT ZoruTabs) */}
            <div className="flex flex-wrap gap-1 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1">
                {TABS.map((t) => {
                    const active = t.key === tab;
                    return (
                        <Link
                            key={t.key}
                            href={`/portal/client/projects/${project._id}?tab=${t.key}`}
                            className={cn(
                                'rounded-[var(--st-radius-sm)] px-3 py-1.5 text-sm transition-colors',
                                active
                                    ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                                    : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]',
                            )}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </div>

            {tab === 'overview' && (
                <Card>
                    <CardBody className="text-sm text-[var(--st-text-secondary)]">
                        {project.description ?? 'No additional details available.'}
                    </CardBody>
                </Card>
            )}

            {tab === 'tasks' && (
                <Card>
                    <CardBody className="p-0">
                        {tasks.length === 0 ? (
                            <div className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
                                No tasks yet.
                            </div>
                        ) : (
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Title</Th>
                                        <Th>Status</Th>
                                        <Th>Priority</Th>
                                        <Th>Due</Th>
                                        <Th>Assignee</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {tasks.map((t) => (
                                        <Tr key={t._id}>
                                            <Td>{t.title}</Td>
                                            <Td>
                                                <Badge variant="outline">{t.status}</Badge>
                                            </Td>
                                            <Td>{t.priority ?? '—'}</Td>
                                            <Td>{fmtDate(t.dueDate)}</Td>
                                            <Td>{t.assigneeName ?? '—'}</Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        )}
                    </CardBody>
                </Card>
            )}

            {tab === 'milestones' && (
                <Card>
                    <CardBody className="text-sm text-[var(--st-text-secondary)]">
                        No milestones available for this project yet.
                    </CardBody>
                </Card>
            )}

            {tab === 'files' && (
                <Card>
                    <CardBody className="text-sm text-[var(--st-text-secondary)]">
                        Project files will appear here. Use the download link on each
                        file to save it locally.
                    </CardBody>
                </Card>
            )}

            {tab === 'invoices' && (
                <Card>
                    <CardBody className="p-0">
                        {invoices.length === 0 ? (
                            <div className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
                                No invoices for this project.
                            </div>
                        ) : (
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Number</Th>
                                        <Th>Date</Th>
                                        <Th>Total</Th>
                                        <Th>Status</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {invoices.map((inv) => (
                                        <Tr key={inv._id}>
                                            <Td>
                                                <Link
                                                    href={`/portal/client/invoices/${inv._id}`}
                                                    className="font-medium text-[var(--st-text)] hover:underline"
                                                >
                                                    {inv.invoiceNumber}
                                                </Link>
                                            </Td>
                                            <Td>{fmtDate(inv.invoiceDate)}</Td>
                                            <Td>{fmtINR(inv.total, inv.currency)}</Td>
                                            <Td>
                                                <Badge variant="outline">{inv.status}</Badge>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        )}
                    </CardBody>
                </Card>
            )}

            {tab === 'rating' && (
                <Card>
                    <CardBody className="text-sm text-[var(--st-text-secondary)]">
                        A rating link will appear here once your project manager
                        sends one. Check your email for the share link.
                    </CardBody>
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
