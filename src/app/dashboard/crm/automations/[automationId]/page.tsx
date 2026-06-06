import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Automation detail page.
 *
 * Server component — fetches the automation by id via the Rust-backed
 * `getAutomationById` server action and renders a summary card + nodes
 * timeline. The first trigger-typed node is surfaced separately.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getAutomationById, getAutomationRuns } from '@/app/actions/crm-automations.actions';
import type { CrmAutomationStatus } from '@/lib/rust-client/crm-automations';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/automations';

const STATUS_TONE: Record<CrmAutomationStatus, StatusTone> = {
    draft: 'amber',
    active: 'green',
    paused: 'blue',
    archived: 'neutral',
};

import { fmtDate } from '@/lib/utils';

export default async function AutomationDetailPage({
    params,
}: {
    params: Promise<{ automationId: string }>;
}) {
    const { automationId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const automation = await getAutomationById(automationId);
    if (!automation) notFound();

    const status = automation.status ?? 'draft';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const nodes = automation.nodes ?? [];
    const triggerNode = nodes.find((n) => n.type?.startsWith('trigger'));
    const actionNodes = nodes.filter((n) => !n.type?.startsWith('trigger'));
    const runs = await getAutomationRuns(automationId);

    return (
        <EntityDetailShell
            eyebrow="AUTOMATION"
            title={automation.name}
            back={{ href: BASE, label: 'Automations' }}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${automationId}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >
            {/* Summary card */}
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">
                        Overview
                    </div>
                    <StatusPill label={status} tone={tone} />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Trigger</div>
                        <div className="text-zoru-ink">
                            {triggerNode
                                ? triggerNode.type.replace(/^trigger_/, '').replace(/_/g, ' ')
                                : 'Manual'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Nodes</div>
                        <div className="font-mono text-zoru-ink">{actionNodes.length}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Updated</div>
                        <div className="text-zoru-ink">{fmtDate(automation.updatedAt)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Created</div>
                        <div className="text-zoru-ink">{fmtDate(automation.createdAt)}</div>
                    </div>
                    {automation.description ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Description</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {automation.description}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            {/* Nodes timeline */}
            <Card className="p-6">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-[15px] font-medium text-zoru-ink">Nodes</div>
                    <div className="text-[12px] text-zoru-ink-muted">
                        {actionNodes.length} node
                        {actionNodes.length === 1 ? '' : 's'}
                    </div>
                </div>
                {actionNodes.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No action nodes configured.
                    </div>
                ) : (
                    <ol className="space-y-2">
                        {actionNodes.map((n, i) => {
                            const data = (n.data ?? {}) as Record<string, unknown>;
                            const label =
                                typeof data.label === 'string'
                                    ? (data.label as string)
                                    : n.type;
                            return (
                                <li
                                    key={n.id}
                                    className="flex flex-col gap-1 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 sm:flex-row sm:items-center sm:gap-4"
                                >
                                    <span className="font-mono text-[11px] text-zoru-ink-muted">
                                        #{i + 1}
                                    </span>
                                    <Badge variant="ghost">
                                        {n.type.replace(/^action_/, '').replace(/_/g, ' ')}
                                    </Badge>
                                    <span className="text-[13px] font-medium text-zoru-ink">
                                        {label}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </Card>

            {/* Execution History */}
            <Card className="p-6">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-[15px] font-medium text-zoru-ink">Execution History</div>
                    <div className="text-[12px] text-zoru-ink-muted">Last 10 runs</div>
                </div>
                {runs.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No executions recorded yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[13px]">
                            <thead>
                                <tr className="border-b border-zoru-line text-zoru-ink-muted">
                                    <th className="pb-2 font-medium">Status</th>
                                    <th className="pb-2 font-medium">Started At</th>
                                    <th className="pb-2 font-medium">Completed At</th>
                                    <th className="pb-2 font-medium">Feedback</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zoru-line">
                                {runs.map((run: any) => {
                                    const runStatus = run.status || 'unknown';
                                    const tone = runStatus === 'success' ? 'green' : runStatus === 'failed' ? 'red' : 'amber';
                                    
                                    return (
                                        <tr key={run._id} className="text-zoru-ink">
                                            <td className="py-3 pr-4">
                                                <StatusPill label={runStatus} tone={tone} />
                                            </td>
                                            <td className="py-3 pr-4">{fmtDate(run.startedAt)}</td>
                                            <td className="py-3 pr-4">{fmtDate(run.completedAt)}</td>
                                            <td className="py-3 max-w-[200px] truncate" title={run.error || run.message || '—'}>
                                                {run.error ? (
                                                    <span className="text-zoru-ink">{run.error}</span>
                                                ) : run.message ? (
                                                    <span className="text-zoru-ink-muted">{run.message}</span>
                                                ) : (
                                                    <span className="text-zoru-ink-muted">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </EntityDetailShell>
    );
}
