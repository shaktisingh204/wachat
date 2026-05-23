import { Card, Badge } from '@/components/zoruui';
import { notFound } from 'next/navigation';

/**
 * Single report-run viewer (CRM_REBUILD_PLAN §6.8).
 *
 * Renders captured `columns` × `rows` from a `crm_report_runs` doc plus
 * the summary block. Includes a client-side "Re-run" button that fires
 * the underlying definition again via the `runReportById` server
 * action.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    getReportDefinitionById,
    getReportRun,
} from '@/app/actions/crm-reports.actions';
import { RerunButton } from './rerun-button';
import { RunResultsTable } from '../../../_components/run-results-table';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string; runId: string }>;
}

function fmtCell(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') {
        return Number.isInteger(v) ? String(v) : v.toFixed(2);
    }
    if (v instanceof Date) return v.toISOString();
    return String(v);
}

export default async function ReportRunViewerPage({ params }: PageProps) {
    const { id, runId } = await params;
    const [def, run] = await Promise.all([
        getReportDefinitionById(id),
        getReportRun(runId),
    ]);
    if (!def || !run) notFound();

    const result = run.result;
    const tone: 'green' | 'red' | 'amber' | 'obsidian' =
        run.status === 'succeeded'
            ? 'green'
            : run.status === 'failed'
              ? 'red'
              : 'amber';

    return (
        <EntityListShell
            title={`Run · ${def.name}`}
            subtitle={`${def.kind} · started ${new Date(run.startedAt).toISOString()}`}
        >

            <div className="flex items-center gap-3">
                <Badge tone={tone}>{run.status}</Badge>
                <span className="text-xs text-muted-foreground">
                    {result?.rows.length ?? 0} rows · trigger: {run.trigger}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <Link
                        href={`/dashboard/crm/reports/${id}/runs`}
                        className="text-xs font-medium text-primary hover:underline"
                    >
                        ← All runs
                    </Link>
                    <RerunButton definitionId={id} />
                </div>
            </div>

            {result?.error && (
                <Card className="border-destructive/50">
                    <h2 className="mb-2 text-sm font-semibold text-destructive">
                        Engine error
                    </h2>
                    <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                        {result.error}
                    </pre>
                </Card>
            )}

            {result?.summary && Object.keys(result.summary).length > 0 && (
                <Card>
                    <h2 className="mb-3 text-[15px] font-semibold">Summary</h2>
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {Object.entries(result.summary).map(([k, v]) => (
                            <div key={k}>
                                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                                    {k}
                                </dt>
                                <dd className="font-mono text-base font-semibold">
                                    {fmtCell(v)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </Card>
            )}

            <RunResultsTable 
                reportName={def.name}
                columns={result?.columns ?? []}
                rows={result?.rows ?? []}
            />
        </EntityListShell>
    );
}
