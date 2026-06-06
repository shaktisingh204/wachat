import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Pipeline detail page.
 *
 * Server component — fetches the pipeline via the Rust-backed
 * `getPipelineById` server action and renders a summary card, stages
 * ladder and metadata strip.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getPipelineById } from '@/app/actions/crm-pipelines.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/sabbigin/pipelines';

const STATUS_TONE: Record<string, StatusTone> = {
    active: 'green',
    draft: 'amber',
    archived: 'neutral',
};

export default async function PipelineDetailPage({
    params,
}: {
    params: Promise<{ pipelineId: string }>;
}) {
    const { pipelineId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const pipeline = await getPipelineById(pipelineId);
    if (!pipeline) notFound();

    const status = pipeline.status ?? 'active';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const stages = pipeline.stages ?? [];

    return (
        <EntityDetailShell
            title={pipeline.name}
            eyebrow="PIPELINE"
            back={{ href: BASE, label: 'Pipelines' }}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${pipelineId}/edit`}>
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
                    {pipeline.isDefault ? (
                        <Badge variant="info">Default</Badge>
                    ) : null}
                    {pipeline.entityKind ? (
                        <Badge variant="ghost">
                            Applies to: {pipeline.entityKind}
                        </Badge>
                    ) : null}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Stages</div>
                        <div className="font-mono text-zoru-ink">{stages.length}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Accent color</div>
                        <div className="flex items-center gap-2 text-zoru-ink">
                            {pipeline.color ? (
                                <>
                                    <span
                                        aria-hidden
                                        className="inline-block h-4 w-4 rounded-full border border-zoru-line"
                                        style={{ background: pipeline.color }}
                                    />
                                    <span className="font-mono text-[12px]">
                                        {pipeline.color}
                                    </span>
                                </>
                            ) : (
                                '—'
                            )}
                        </div>
                    </div>
                    {pipeline.description ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Description</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {pipeline.description}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            {/* Stages ladder */}
            <Card className="p-6">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-[15px] font-medium text-zoru-ink">
                        Stages
                    </div>
                    <div className="text-[12px] text-zoru-ink-muted">
                        {stages.length} stage{stages.length === 1 ? '' : 's'}
                    </div>
                </div>
                {stages.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No stages defined.
                    </div>
                ) : (
                    <ol className="space-y-2">
                        {stages.map((s, i) => (
                            <li
                                key={s._id || s.id || i}
                                className="flex flex-col gap-1 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 sm:flex-row sm:items-center sm:gap-4"
                            >
                                <div className="flex items-center gap-2">
                                    {s.color ? (
                                        <span
                                            aria-hidden
                                            className="inline-block h-3 w-3 rounded-full border border-zoru-line"
                                            style={{ background: s.color }}
                                        />
                                    ) : null}
                                    <span className="font-mono text-[11px] text-zoru-ink-muted">
                                        #{i + 1}
                                    </span>
                                    <span className="text-[13px] font-medium text-zoru-ink">
                                        {s.name}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[12px] text-zoru-ink-muted sm:ml-auto">
                                    <span>
                                        Probability:{' '}
                                        <span className="font-mono text-zoru-ink">
                                            {typeof s.probability === 'number'
                                                ? `${s.probability}%`
                                                : '—'}
                                        </span>
                                    </span>
                                    {s.conditions ? (
                                        <span className="max-w-[260px] truncate">
                                            Rule:{' '}
                                            <span className="text-zoru-ink">
                                                {s.conditions}
                                            </span>
                                        </span>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </Card>
        </EntityDetailShell>
    );
}
