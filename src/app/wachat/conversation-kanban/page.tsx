'use client';

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  MessageCircle,
  User,
  Loader2,
  RefreshCw,
  LayoutGrid,
  AlertTriangle,
  Timer,
  Inbox,
} from 'lucide-react';
import { m } from 'motion/react';

import { useZoruToast } from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { fmtDate } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { getContactsPageData } from '@/app/actions/contact.actions';

/**
 * /wachat/conversation-kanban - Real contacts grouped by status.
 * Column headers show count + median wait time + WIP warning. Each
 * card shows monogram avatar, name, last-touch, tag chips, and a
 * small SLA dot (green/amber/rose).
 */

type Column = {
  id: string;
  title: string;
  dotClass: string;
  width: number;
  /** WIP limit; rosed when items exceed. */
  wip: number;
  items: any[];
};

function groupContacts(contacts: any[]): Column[] {
  const cols: Column[] = [
    { id: 'new', title: 'New', dotClass: 'bg-sky-500', width: 320, wip: 20, items: [] },
    { id: 'active', title: 'Active', dotClass: 'bg-amber-500', width: 360, wip: 30, items: [] },
    { id: 'resolved', title: 'Resolved', dotClass: 'bg-emerald-500', width: 320, wip: 60, items: [] },
  ];
  for (const c of contacts) {
    const status = c.conversationStatus || c.status || 'new';
    if (status === 'resolved' || status === 'closed') cols[2].items.push(c);
    else if (c.lastMessageTimestamp || status === 'active') cols[1].items.push(c);
    else cols[0].items.push(c);
  }
  return cols;
}

function monogram(name?: string, fallback = '?') {
  const s = (name || fallback).trim();
  if (!s) return fallback;
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function fmtMinutes(min?: number) {
  if (!min || !Number.isFinite(min)) return '--';
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 60 * 24) return `${(min / 60).toFixed(1)}h`;
  return `${Math.round(min / 60 / 24)}d`;
}

function slaTone(lastTs?: string | number) {
  if (!lastTs) return { dot: 'bg-zinc-300', label: 'idle' };
  const t = new Date(lastTs).getTime();
  if (!Number.isFinite(t)) return { dot: 'bg-zinc-300', label: 'idle' };
  const ageMin = (Date.now() - t) / 60000;
  if (ageMin < 30) return { dot: 'bg-emerald-500', label: 'on track' };
  if (ageMin < 240) return { dot: 'bg-amber-500', label: 'aging' };
  return { dot: 'bg-rose-500', label: 'breaching' };
}

export default function ConversationKanbanPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [columns, setColumns] = useState<Column[]>([]);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getContactsPageData(
        String(activeProject._id),
        undefined,
        1,
        '',
      );
      if (!res.contacts) {
        toast({ title: 'Error', description: 'Could not load contacts.', variant: 'destructive' });
        return;
      }
      setColumns(groupContacts(res.contacts));
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalCards = columns.reduce((s, c) => s + c.items.length, 0);

  const columnStats = useMemo(() => {
    return columns.map((col) => {
      const waits: number[] = [];
      for (const item of col.items) {
        const ts = item.lastMessageTimestamp || item.createdAt;
        if (!ts) continue;
        const t = new Date(ts).getTime();
        if (Number.isFinite(t)) waits.push((Date.now() - t) / 60000);
      }
      waits.sort((a, b) => a - b);
      const median = waits.length > 0 ? waits[Math.floor(waits.length / 2)] : null;
      const overWip = col.items.length > col.wip;
      return { id: col.id, median, overWip };
    });
  }, [columns]);

  const overall = useMemo(() => {
    const open = (columns.find((c) => c.id === 'new')?.items.length ?? 0) +
      (columns.find((c) => c.id === 'active')?.items.length ?? 0);
    const resolved = columns.find((c) => c.id === 'resolved')?.items.length ?? 0;
    const breachCount = columns.reduce((sum, c) => {
      return sum + c.items.filter((it) => slaTone(it.lastMessageTimestamp).label === 'breaching').length;
    }, 0);
    return { open, resolved, breachCount };
  }, [columns]);

  return (
    <WaPage fullBleed>
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-8 pt-6">
        <PageHeader
          title="Conversation kanban"
          description={`Conversations grouped by lifecycle stage. ${totalCards.toLocaleString('en-IN')} contacts visible.`}
          kicker="Wachat · kanban"
          backHref="/wachat"
          eyebrowIcon={LayoutGrid}
          actions={
            <WaButton
              variant="outline"
              size="sm"
              leftIcon={isPending ? Loader2 : RefreshCw}
              onClick={load}
              disabled={isPending}
            >
              Refresh
            </WaButton>
          }
        />

        {/* KPI strip */}
        <section aria-labelledby="kanban-kpis" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <h2 id="kanban-kpis" className="sr-only">Board stats</h2>
          <MetricTile label="Total contacts" value={totalCards.toLocaleString('en-IN')} icon={LayoutGrid} delay={0} />
          <MetricTile label="Open" value={overall.open.toLocaleString('en-IN')} icon={Inbox} delay={0.04} />
          <MetricTile label="Resolved" value={overall.resolved.toLocaleString('en-IN')} icon={MessageCircle} delay={0.08} />
          <MetricTile
            label="SLA breaching"
            value={overall.breachCount.toLocaleString('en-IN')}
            icon={AlertTriangle}
            delay={0.12}
          />
        </section>

        {isPending && columns.length === 0 ? (
          <div className="flex h-40 items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            <span className="text-[13px] text-zinc-500">Loading contacts...</span>
          </div>
        ) : columns.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No conversations yet"
            description="Once contacts start messaging, they'll appear in these columns by lifecycle stage."
          />
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4">
              {columns.map((col, colIdx) => {
                const stats = columnStats[colIdx];
                return (
                  <m.section
                    key={col.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: colIdx * 0.06, ease: EASE_OUT }}
                    className="flex-shrink-0"
                    style={{ width: col.width }}
                  >
                    <header className="mb-2 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${col.dotClass}`} aria-hidden />
                      <h2 className="text-[13px] font-semibold tracking-tight text-zinc-900">{col.title}</h2>
                      <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 tabular-nums">
                        {col.items.length}
                      </span>
                    </header>
                    <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-white px-2.5 py-1.5 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-zinc-500">
                        <Timer className="h-3 w-3" strokeWidth={2} aria-hidden />
                        Median wait
                      </span>
                      <span className="font-semibold tabular-nums text-zinc-900">
                        {fmtMinutes(stats?.median ?? undefined)}
                      </span>
                      {stats?.overWip && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
                          WIP {col.items.length}/{col.wip}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {col.items.map((item: any, i) => {
                        const sla = slaTone(item.lastMessageTimestamp);
                        return (
                          <m.article
                            key={item._id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: colIdx * 0.06 + i * 0.03, ease: EASE_OUT }}
                            className="group cursor-pointer rounded-xl border border-zinc-200 bg-white p-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px]"
                            style={{ boxShadow: '0 0 0 1px transparent' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 32px -22px var(--mt-accent-glow)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px transparent'; }}
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10.5px] font-bold text-white"
                                style={{ background: 'var(--mt-accent)' }}
                                aria-hidden
                              >
                                {monogram(item.name || item.waId)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-[13px] font-semibold text-zinc-900">
                                    {item.name || item.waId || 'Unknown'}
                                  </span>
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${sla.dot}`}
                                    aria-label={`SLA ${sla.label}`}
                                    title={`SLA ${sla.label}`}
                                  />
                                </div>
                                <p className="flex items-center gap-1.5 truncate text-[11.5px] text-zinc-500">
                                  <MessageCircle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                                  <span className="font-mono">{item.waId || 'No phone'}</span>
                                </p>
                              </div>
                              {item.lastMessageTimestamp && (
                                <span className="shrink-0 whitespace-nowrap text-[10.5px] text-zinc-500 tabular-nums">
                                  {fmtDate(item.lastMessageTimestamp)}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-1.5 text-[10.5px]">
                              {Array.isArray(item.tagIds) && item.tagIds.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
                                  <User className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
                                  {item.tagIds.length} tag{item.tagIds.length === 1 ? '' : 's'}
                                </span>
                              )}
                              {item.intent && (
                                <span className="inline-flex items-center rounded-full bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
                                  {item.intent}
                                </span>
                              )}
                              {item.assignedAgentName && (
                                <span className="ml-auto inline-flex items-center gap-1 text-zinc-500">
                                  <span
                                    className="grid h-4 w-4 place-items-center rounded-full bg-zinc-100 text-[8.5px] font-bold text-zinc-700"
                                    aria-hidden
                                  >
                                    {monogram(item.assignedAgentName)}
                                  </span>
                                  <span className="truncate">{item.assignedAgentName}</span>
                                </span>
                              )}
                            </div>
                          </m.article>
                        );
                      })}
                      {col.items.length === 0 && (
                        <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-center text-[12px] text-zinc-400">
                          No conversations
                        </div>
                      )}
                    </div>
                  </m.section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </WaPage>
  );
}
