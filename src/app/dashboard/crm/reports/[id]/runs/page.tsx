import { ZoruCard, ZoruBadge } from '@/components/zoruui';
import { notFound } from 'next/navigation';

/**
 * Past runs for a saved report definition (CRM_REBUILD_PLAN §6.8).
 *
 * Lists every `crm_report_runs` doc for `[id]`, newest first. Each row
 * links to the per-run viewer at `./runs/[runId]`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    getReportDefinitionById,
    getReportRunsForDefinition,
} from '@/app/actions/crm-reports.actions';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

function fmtDate(d: string | Date | undefined | null): string {
    if (!d) return '—';
    const x = typeof d === 'string' ? new Date(d) : d;
    if (!(x instanceof Date) || isNaN(x.getTime())) return '—';
    return x.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function durationMs(start: string | Date | undefined, end: string | Date | null | undefined): string {
    if (!start || !end) return '—';
    const a = typeof start === 'string' ? new Date(start) : start;
    const b = typeof end === 'string' ? new Date(end) : end;
    if (!(a instanceof Date) || !(b instanceof Date)) return '—';
    const ms = b.getTime() - a.getTime();
    if (!Number.isFinite(ms) || ms < 0) return '—';
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
    return `${(ms / 60_000).toFixed(1)} min`;
}

export default async function ReportRunsListPage({ params }: PageProps) {
    const { id } = await params;
    const def = await getReportDefinitionById(id);
    if (!def) notFound();

    const runs = await getReportRunsForDefinition(id, 100);

    return (
        <EntityListShell
            title={`Runs · ${def.name}`}
            subtitle={`Kind: ${def.kind} · Latest 100 runs`}
        >

            <ZoruCard>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 font-medium">Started</th>
                                <th className="px-3 py-2 font-medium">Status</th>
                                <th className="px-3 py-2 font-medium">Trigger</th>
                                <th className="px-3 py-2 font-medium">Rows</th>
                                <th className="px-3 py-2 font-medium">Duration</th>
                                <th className="px-3 py-2 font-medium">Delivery</th>
                                <th className="px-3 py-2 font-medium" />
                            </tr>
                        </thead>
                        <tbody>
                            {runs.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                                        No runs yet. Trigger one from the report page.
                                    </td>
                                </tr>
                            )}
                            {runs.map((r) => {
                                const tone: 'green' | 'red' | 'amber' | 'obsidian' =
                                    r.status === 'succeeded'
                                        ? 'green'
                                        : r.status === 'failed'
                                          ? 'red'
                                          : 'amber';
                                const emailOk = r.delivered?.email?.ok ?? null;
                                const webhookOk = r.delivered?.webhook?.ok ?? null;
                                return (
                                    <tr key={r._id} className="border-t border-border/50">
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {fmtDate(r.startedAt)}
                                        </td>
                                        <td className="px-3 py-2">
                                            <ZoruBadge tone={tone}>{r.status}</ZoruBadge>
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {r.trigger}
                                        </td>
                                        <td className="px-3 py-2 font-mono">{r.rowCount ?? 0}</td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {durationMs(r.startedAt, r.finishedAt)}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-muted-foreground">
                                            {emailOk === null ? '—' : emailOk ? 'email ok' : 'email fail'}
                                            {' · '}
                                            {webhookOk === null ? '—' : webhookOk ? 'webhook ok' : 'webhook fail'}
                                        </td>
                                        <td className="px-3 py-2">
                                            <Link
                                                href={`/dashboard/crm/reports/${id}/runs/${r._id}`}
                                                className="text-xs font-medium text-primary hover:underline"
                                            >
                                                View →
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
