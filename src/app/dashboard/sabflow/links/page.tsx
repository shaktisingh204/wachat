/**
 * /dashboard/sabflow/links — multi-bot linking dashboard.
 *
 * Lists every flow in the workspace that participates in a `typebot_link`
 * call graph, plus the per-flow in/out degree.  Powers cross-flow
 * navigation: click a node to jump into that flow's editor.
 */

import Link from 'next/link';
import { ArrowRight, TriangleAlert, Workflow } from 'lucide-react';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowsByUserId } from '@/lib/sabflow/db';
import { buildCallGraph, type LinkEdge, type LinkNode } from '@/lib/sabflow/links/buildCallGraph';
import { cn } from '@/lib/utils';
import { getT } from '@/lib/i18n/server';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';

export const dynamic = 'force-dynamic';

export default async function LinksPage() {
  const t = await getT();
  const session = await getSession();
  if (!session?.user) {
    return (
      <SabflowPage breadcrumb={[...SABFLOW_CRUMBS, { label: t('sabflow.links.title') }]}>
        <p className="text-[13px] text-[var(--st-text-secondary)]">
          {t('sabflow.links.signInRequired')}
        </p>
      </SabflowPage>
    );
  }

  const userId = (session.user as { _id: { toString(): string } })._id.toString();
  const flows = await getSabFlowsByUserId(userId);
  const graph = buildCallGraph(flows);
  const byId = new Map(graph.nodes.map((n) => [n.flowId, n] as const));

  return (
    <SabflowPage
      width="wide"
      breadcrumb={[...SABFLOW_CRUMBS, { label: t('sabflow.links.title') }]}
      title={t('sabflow.links.title')}
      description={
        <>
          {t('sabflow.links.subtitle.before')}
          <code className="font-mono">typebot_link</code>
          {t('sabflow.links.subtitle.after')}
        </>
      }
      actions={
        <span className="text-[11px] tabular-nums text-[var(--st-text-secondary)] text-right shrink-0">
          {graph.nodes.length} {graph.nodes.length === 1 ? t('sabflow.links.flow') : t('sabflow.links.flows')} ·{' '}
          {graph.edges.length} {graph.edges.length === 1 ? t('sabflow.links.link') : t('sabflow.links.linksWord')}
        </span>
      }
    >
      {graph.nodes.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="space-y-6 sm:space-y-8">
          <NodesSection nodes={graph.nodes} t={t} />
          <EdgesSection edges={graph.edges} byId={byId} t={t} />
        </div>
      )}
    </SabflowPage>
  );
}

type Translator = (key: string, params?: Record<string, string | number>) => string;

/* ── Sections ────────────────────────────────────────── */

function NodesSection({ nodes, t }: { nodes: LinkNode[]; t: Translator }) {
  // Sort by total degree (in + out) descending so the central "hub" flows
  // appear at the top.
  const sorted = [...nodes].sort(
    (a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree),
  );

  return (
    <section>
      <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {t('sabflow.links.section.flows')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((node) => (
          <Link
            key={node.flowId}
            href={`/dashboard/sabflow/flow-builder/${node.flowId}`}
            className="group flex flex-col gap-2 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3.5 py-3 hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-muted)] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-[12.5px] font-semibold text-[var(--st-text)]">
                {node.name}
              </span>
              <StatusPill status={node.status} />
            </div>
            <div className="flex items-center gap-3 text-[10.5px] text-[var(--st-text-secondary)]">
              <DegreeBadge label={t('sabflow.links.degree.calls')} count={node.outDegree} tone="out" />
              <DegreeBadge label={t('sabflow.links.degree.calledBy')} count={node.inDegree} tone="in" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EdgesSection({
  edges,
  byId,
  t,
}: {
  edges: LinkEdge[];
  byId: Map<string, LinkNode>;
  t: Translator;
}) {
  return (
    <section>
      <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {t('sabflow.links.section.links')}
      </h2>
      {edges.length === 0 ? (
        <p className="text-[12px] text-[var(--st-text-secondary)]">{t('sabflow.links.noEdges')}</p>
      ) : (
        <div className="space-y-1.5">
          {edges.map((e, idx) => {
            const fromNode = byId.get(e.from);
            const toNode = byId.get(e.to);
            return (
              <div
                key={`${e.blockId}-${idx}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12px]"
              >
                <Link
                  href={`/dashboard/sabflow/flow-builder/${e.from}`}
                  className="font-medium text-[var(--st-text)] hover:text-[var(--st-accent)] truncate min-w-0 max-w-[45%] sm:max-w-none"
                >
                  {fromNode?.name ?? e.from}
                </Link>
                <ArrowRight className="h-3 w-3 shrink-0 text-[var(--st-text-tertiary)]" />
                {e.isDangling ? (
                  <span className="inline-flex items-center gap-1 text-[var(--st-warn)] min-w-0 truncate max-w-[45%] sm:max-w-none">
                    <TriangleAlert className="h-3 w-3 shrink-0" />
                    {t('sabflow.links.dangling', { id: e.to.slice(0, 12) })}
                  </span>
                ) : (
                  <Link
                    href={`/dashboard/sabflow/flow-builder/${e.to}`}
                    className="font-medium text-[var(--st-text)] hover:text-[var(--st-accent)] truncate min-w-0 max-w-[45%] sm:max-w-none"
                  >
                    {toNode?.name ?? e.to}
                  </Link>
                )}
                <code className="ml-auto shrink-0 font-mono text-[10px] text-[var(--st-text-tertiary)] basis-full sm:basis-auto text-right sm:text-left">
                  block:{e.blockId.slice(0, 8)}
                </code>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DegreeBadge({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'in' | 'out';
}) {
  const palette =
    tone === 'in'
      ? 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]'
      : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium', palette)}>
      {label}: <span className="tabular-nums">{count}</span>
    </span>
  );
}

function StatusPill({ status }: { status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }) {
  const tone =
    status === 'PUBLISHED'
      ? 'bg-[var(--st-status-ok)]/10 text-[var(--st-status-ok)]'
      : status === 'DRAFT'
      ? 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]'
      : 'bg-[var(--st-bg-muted)] text-[var(--st-text-tertiary)]';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide',
        tone,
      )}
    >
      {status}
    </span>
  );
}

function EmptyState({ t }: { t: Translator }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--st-bg-muted)] text-[var(--st-text-tertiary)]">
        <Workflow className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-medium text-[var(--st-text)]">
        {t('sabflow.links.empty.title')}
      </p>
      <p className="max-w-md text-[11.5px] text-[var(--st-text-secondary)] leading-relaxed">
        {t('sabflow.links.empty.before')}<code className="font-mono">Typebot link</code>{t('sabflow.links.empty.after')}
      </p>
    </div>
  );
}
