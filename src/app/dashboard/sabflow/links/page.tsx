/**
 * /dashboard/sabflow/links — multi-bot linking dashboard.
 *
 * Lists every flow in the workspace that participates in a `typebot_link`
 * call graph, plus the per-flow in/out degree.  Powers cross-flow
 * navigation: click a node to jump into that flow's editor.
 */

import Link from 'next/link';
import { LuArrowRight, LuTriangleAlert, LuWorkflow } from 'react-icons/lu';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowsByUserId } from '@/lib/sabflow/db';
import { buildCallGraph, type LinkEdge, type LinkNode } from '@/lib/sabflow/links/buildCallGraph';
import { cn } from '@/lib/utils';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function LinksPage() {
  const t = await getT();
  const session = await getSession();
  if (!session?.user) {
    return (
      <div className="p-8 text-[13px] text-zoru-ink-muted">
        {t('sabflow.links.signInRequired')}
      </div>
    );
  }

  const userId = (session.user as { _id: { toString(): string } })._id.toString();
  const flows = await getSabFlowsByUserId(userId);
  const graph = buildCallGraph(flows);
  const byId = new Map(graph.nodes.map((n) => [n.flowId, n] as const));

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--gray-4)] px-4 sm:px-6 py-3 sm:py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/40 dark:text-zoru-ink-muted shrink-0">
          <LuWorkflow className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <h1 className="text-sm sm:text-[15px] font-semibold text-[var(--gray-12)]">
            {t('sabflow.links.title')}
          </h1>
          <p className="hidden sm:block text-[11.5px] text-[var(--gray-9)]">
            {t('sabflow.links.subtitle.before')}<code className="font-mono">typebot_link</code>{t('sabflow.links.subtitle.after')}
          </p>
          <p className="sm:hidden text-[11px] text-[var(--gray-9)] truncate">
            {t('sabflow.links.subtitleShort')}
          </p>
        </div>
        <span className="ml-auto text-[10.5px] tabular-nums text-[var(--gray-9)] text-right shrink-0">
          {graph.nodes.length} {graph.nodes.length === 1 ? t('sabflow.links.flow') : t('sabflow.links.flows')} ·{' '}
          {graph.edges.length} {graph.edges.length === 1 ? t('sabflow.links.link') : t('sabflow.links.linksWord')}
        </span>
      </div>

      {graph.nodes.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
          <NodesSection nodes={graph.nodes} t={t} />
          <EdgesSection edges={graph.edges} byId={byId} t={t} />
        </div>
      )}
    </div>
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
      <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
        {t('sabflow.links.section.flows')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((node) => (
          <Link
            key={node.flowId}
            href={`/dashboard/sabflow/flow-builder/${node.flowId}`}
            className="group flex flex-col gap-2 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] px-3.5 py-3 hover:border-[var(--gray-7)] hover:bg-[var(--gray-1)] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-[12.5px] font-semibold text-[var(--gray-12)]">
                {node.name}
              </span>
              <StatusPill status={node.status} />
            </div>
            <div className="flex items-center gap-3 text-[10.5px] text-[var(--gray-9)]">
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
      <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
        {t('sabflow.links.section.links')}
      </h2>
      {edges.length === 0 ? (
        <p className="text-[12px] text-[var(--gray-9)]">{t('sabflow.links.noEdges')}</p>
      ) : (
        <div className="space-y-1.5">
          {edges.map((e, idx) => {
            const fromNode = byId.get(e.from);
            const toNode = byId.get(e.to);
            return (
              <div
                key={`${e.blockId}-${idx}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] px-3 py-2 text-[12px]"
              >
                <Link
                  href={`/dashboard/sabflow/flow-builder/${e.from}`}
                  className="font-medium text-[var(--gray-12)] hover:text-zoru-ink truncate min-w-0 max-w-[45%] sm:max-w-none"
                >
                  {fromNode?.name ?? e.from}
                </Link>
                <LuArrowRight className="h-3 w-3 shrink-0 text-[var(--gray-9)]" />
                {e.isDangling ? (
                  <span className="inline-flex items-center gap-1 text-zoru-ink dark:text-zoru-ink-muted min-w-0 truncate max-w-[45%] sm:max-w-none">
                    <LuTriangleAlert className="h-3 w-3 shrink-0" />
                    {t('sabflow.links.dangling', { id: e.to.slice(0, 12) })}
                  </span>
                ) : (
                  <Link
                    href={`/dashboard/sabflow/flow-builder/${e.to}`}
                    className="font-medium text-[var(--gray-12)] hover:text-zoru-ink truncate min-w-0 max-w-[45%] sm:max-w-none"
                  >
                    {toNode?.name ?? e.to}
                  </Link>
                )}
                <code className="ml-auto shrink-0 font-mono text-[10px] text-[var(--gray-9)] basis-full sm:basis-auto text-right sm:text-left">
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
      ? 'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/30 dark:text-zoru-ink-muted'
      : 'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/30 dark:text-zoru-ink-muted';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium', palette)}>
      {label}: <span className="tabular-nums">{count}</span>
    </span>
  );
}

function StatusPill({ status }: { status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }) {
  const tone =
    status === 'PUBLISHED'
      ? 'bg-zoru-ink/10 text-zoru-ink dark:text-zoru-ink-muted'
      : status === 'DRAFT'
      ? 'bg-zoru-ink/10 text-zoru-ink dark:text-zoru-ink-muted'
      : 'bg-zoru-ink/10 text-zoru-ink dark:text-zoru-ink-muted';
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
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
        <LuWorkflow className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-medium text-[var(--gray-12)]">
        {t('sabflow.links.empty.title')}
      </p>
      <p className="max-w-md text-[11.5px] text-[var(--gray-9)] leading-relaxed">
        {t('sabflow.links.empty.before')}<code className="font-mono">Typebot link</code>{t('sabflow.links.empty.after')}
      </p>
    </div>
  );
}
