import { Card, Badge } from '@/components/sabcrm/20ui/compat';
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
import { RunsListClient } from '../../_components/runs-list-client';

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

            <RunsListClient definitionId={id} runs={runs as any} />
        </EntityListShell>
    );
}
