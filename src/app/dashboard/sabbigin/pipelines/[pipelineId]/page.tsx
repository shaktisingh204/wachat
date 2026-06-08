/**
 * Pipeline detail page.
 *
 * Server component. Fetches the pipeline via the Rust-backed
 * `getPipelineById` server action and renders a summary card, stages
 * ladder and metadata strip. Pure 20ui design system.
 */

import {
  notFound,
  redirect,
} from 'next/navigation';
import { Layers } from 'lucide-react';

import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  EmptyState,
} from '@/components/sabcrm/20ui';
import {
  EntityDetailShell,
  type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getPipelineById } from '@/app/actions/crm-pipelines.actions';

import { PipelineEditButton } from './_components/pipeline-edit-button';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/sabbigin/pipelines';

const STATUS_TONE: Record<string, EntityStatusTone> = {
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
    <div className="20ui">
      <EntityDetailShell
        title={pipeline.name}
        eyebrow="PIPELINE"
        status={{ label: status, tone }}
        back={{ href: BASE, label: 'Pipelines' }}
        actions={<PipelineEditButton href={`${BASE}/${pipelineId}/edit`} />}
      >
        {/* Summary card */}
        <Card padding="lg">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Overview</CardTitle>
              {pipeline.isDefault ? <Badge variant="info">Default</Badge> : null}
              {pipeline.entityKind ? (
                <Badge variant="outline">Applies to: {pipeline.entityKind}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
              <div>
                <div className="text-[var(--st-text-secondary)]">Stages</div>
                <div className="font-mono text-[var(--st-text)]">{stages.length}</div>
              </div>
              <div>
                <div className="text-[var(--st-text-secondary)]">Accent color</div>
                <div className="flex items-center gap-2 text-[var(--st-text)]">
                  {pipeline.color ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="inline-block h-4 w-4 rounded-full border border-[var(--st-border)]"
                        style={{ background: pipeline.color }}
                      />
                      <span className="font-mono text-[12px]">{pipeline.color}</span>
                    </>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              {pipeline.description ? (
                <div className="sm:col-span-2">
                  <div className="text-[var(--st-text-secondary)]">Description</div>
                  <div className="whitespace-pre-wrap text-[var(--st-text)]">
                    {pipeline.description}
                  </div>
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>

        {/* Stages ladder */}
        <Card padding="lg">
          <CardHeader>
            <div className="flex w-full items-center justify-between">
              <CardTitle>Stages</CardTitle>
              <span className="text-[12px] text-[var(--st-text-secondary)]">
                {stages.length} stage{stages.length === 1 ? '' : 's'}
              </span>
            </div>
          </CardHeader>
          <CardBody>
            {stages.length === 0 ? (
              <EmptyState
                icon={Layers}
                size="sm"
                title="No stages defined"
                description="Add stages to this pipeline to model your sales process."
              />
            ) : (
              <ol className="space-y-2">
                {stages.map((s, i) => (
                  <li
                    key={s._id || s.id || i}
                    className="flex flex-col gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex items-center gap-2">
                      {s.color ? (
                        <span
                          aria-hidden="true"
                          className="inline-block h-3 w-3 rounded-full border border-[var(--st-border)]"
                          style={{ background: s.color }}
                        />
                      ) : null}
                      <span className="font-mono text-[11px] text-[var(--st-text-secondary)]">
                        #{i + 1}
                      </span>
                      <span className="text-[13px] font-medium text-[var(--st-text)]">
                        {s.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--st-text-secondary)] sm:ml-auto">
                      <span>
                        Probability:{' '}
                        <span className="font-mono text-[var(--st-text)]">
                          {typeof s.probability === 'number' ? `${s.probability}%` : '-'}
                        </span>
                      </span>
                      {s.conditions ? (
                        <span className="max-w-[260px] truncate">
                          Rule:{' '}
                          <span className="text-[var(--st-text)]">{s.conditions}</span>
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </EntityDetailShell>
    </div>
  );
}
