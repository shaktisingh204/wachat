'use client';

import { fmtDate } from '@/lib/utils';

import {
  useZoruToast,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Input,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import {
  FileSpreadsheet,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  Users,
  Activity,
  Search as SearchIcon,
  Hourglass,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getImportHistory } from '@/app/actions/wachat-features.actions';

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

function statusToTone(status: string): { tone: StatusTone; label: string; icon: React.ElementType } {
  switch (status) {
    case 'completed':
      return { tone: 'sent', label: 'Completed', icon: CircleCheck };
    case 'failed':
      return { tone: 'failed', label: 'Failed', icon: CircleX };
    case 'processing':
      return { tone: 'sending', label: 'Processing', icon: Clock };
    default:
      return { tone: 'draft', label: status, icon: Clock };
  }
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s - m * 60;
  return `${m}m ${rs}s`;
}

export default function ContactImportHistoryPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [imports, setImports] = useState<any[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [selected, setSelected] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const reduceMotion = useReducedMotion();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getImportHistory(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setImports(res.imports ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll while any import is in 'processing'
  const hasProcessing = useMemo(() => imports.some((i) => i.status === 'processing'), [imports]);
  useEffect(() => {
    if (!hasProcessing) return;
    const t = setInterval(fetchData, 4000);
    return () => clearInterval(t);
  }, [hasProcessing, fetchData]);

  const stats = useMemo(() => {
    const totalImported = imports.reduce((s, i) => s + (i.success ?? 0), 0);
    const totalFailed = imports.reduce((s, i) => s + (i.failed ?? 0), 0);
    const totalDuplicates = imports.reduce((s, i) => s + (i.duplicate ?? 0), 0);
    const processing = imports.filter((i) => i.status === 'processing').length;
    return {
      total: imports.length,
      totalImported,
      totalFailed,
      totalDuplicates,
      processing,
    };
  }, [imports]);

  const filtered = useMemo(() => {
    let rows = imports.slice();
    if (statusFilter !== 'all') rows = rows.filter((r) => (r.status || 'completed') === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => (r.filename || '').toLowerCase().includes(q));
    return rows;
  }, [imports, search, statusFilter]);

  const isLoadingInitial = isLoading && imports.length === 0;
  const stagger = reduceMotion ? 0 : 0.025;

  return (
    <WaPage>
      <PageHeader
        title="Import history"
        description="View the history of all past CSV contact imports."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
      />

      {/* 4-tile KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Total imports" value={stats.total.toLocaleString()} icon={FileSpreadsheet} delay={0} />
        <MetricTile label="Contacts imported" value={stats.totalImported.toLocaleString()} icon={Users} delay={0.05} />
        <MetricTile label="Processing" value={stats.processing.toLocaleString()} icon={Activity} delay={0.1} />
        <MetricTile label="Rows failed" value={stats.totalFailed.toLocaleString()} icon={CircleX} delay={0.15} />
      </section>

      <Section title="Imports" padded={false}>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 focus-within:border-zinc-400">
            <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename..."
              className="h-7 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-0.5">
            {(['all', 'completed', 'processing', 'failed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ' +
                  (statusFilter === s ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900')
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Column header */}
        <div className="hidden items-center gap-3 border-b border-zinc-100 bg-zinc-50/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 md:flex">
          <span className="w-7" />
          <span className="flex-1">Filename / source</span>
          <span className="w-[60px] text-right">Total</span>
          <span className="w-[60px] text-right">Valid</span>
          <span className="w-[60px] text-right">Dup</span>
          <span className="w-[60px] text-right">Invalid</span>
          <span className="w-[100px]">Duration</span>
          <span className="w-[110px]">Started</span>
          <span className="w-[100px]">Status</span>
          <span className="w-[70px] text-right">Action</span>
        </div>

        {isLoadingInitial ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 animate-pulse rounded-lg bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-48 animate-pulse rounded-full bg-zinc-100" />
                  <div className="h-2 w-32 animate-pulse rounded-full bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              icon={FileSpreadsheet}
              title={imports.length === 0 ? 'No import records found' : 'No matching imports'}
              description={imports.length === 0 ? 'Imports performed via the Contacts page will appear here.' : 'Try a different filter.'}
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {filtered.map((imp, i) => {
                const s = statusToTone(imp.status || 'completed');
                const total = imp.total ?? 0;
                const success = imp.success ?? 0;
                const failed = imp.failed ?? 0;
                const duplicate = imp.duplicate ?? 0;
                const valid = imp.valid ?? Math.max(0, total - failed - duplicate);
                const startedAt = imp.startedAt || imp.importedAt;
                const finishedAt = imp.finishedAt || imp.completedAt;
                const duration = finishedAt && startedAt
                  ? new Date(finishedAt).getTime() - new Date(startedAt).getTime()
                  : imp.durationMs || 0;
                const progressPct = total > 0 ? Math.min(100, (success / total) * 100) : 0;

                return (
                  <m.li
                    key={imp._id}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: i * stagger, ease: EASE_OUT }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50/70"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600">
                      <FileSpreadsheet className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-zinc-900">
                        {imp.filename || 'Unknown file'}
                      </p>
                      <p className="mt-0.5 truncate text-[10.5px] uppercase tracking-wider text-zinc-500">
                        {imp.source || 'csv'} · {imp.createdBy || imp.userEmail || 'system'}
                      </p>
                      <AnimatePresence>
                        {imp.status === 'processing' && (
                          <m.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: EASE_OUT }}
                            className="mt-1.5 flex items-center gap-2"
                          >
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-100">
                              <m.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.6, ease: EASE_OUT }}
                                className="h-full"
                                style={{ background: 'var(--mt-accent)' }}
                              />
                            </div>
                            <span className="text-[9.5px] font-semibold tabular-nums text-emerald-700">
                              {Math.round(progressPct)}%
                            </span>
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="hidden w-[60px] text-right text-[11.5px] tabular-nums text-zinc-700 md:block">
                      {total.toLocaleString()}
                    </div>
                    <div className="hidden w-[60px] text-right text-[11.5px] tabular-nums text-emerald-700 md:block">
                      {valid.toLocaleString()}
                    </div>
                    <div className="hidden w-[60px] text-right text-[11.5px] tabular-nums text-amber-700 md:block">
                      {duplicate.toLocaleString()}
                    </div>
                    <div className="hidden w-[60px] text-right text-[11.5px] tabular-nums text-rose-700 md:block">
                      {failed.toLocaleString()}
                    </div>
                    <div className="hidden w-[100px] items-center gap-1 text-[11px] tabular-nums text-zinc-600 md:flex">
                      <Hourglass className="h-2.5 w-2.5 opacity-60" strokeWidth={2.5} />
                      {formatDuration(duration)}
                    </div>
                    <div className="hidden w-[110px] truncate text-[11px] tabular-nums text-zinc-500 md:block">
                      {startedAt ? fmtDate(startedAt) : '-'}
                    </div>
                    <div className="w-[100px]">
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                    </div>
                    <div className="w-[70px] text-right">
                      <WaButton variant="ghost" size="sm" leftIcon={Eye} onClick={() => setSelected(imp)}>
                        View
                      </WaButton>
                    </div>
                  </m.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Section>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <ZoruSheetContent side="right" className="w-full sm:max-w-md">
          <ZoruSheetHeader>
            <ZoruSheetTitle>{selected?.filename || 'Import details'}</ZoruSheetTitle>
            <ZoruSheetDescription>
              {selected?.startedAt || selected?.importedAt ? fmtDate(selected.startedAt || selected.importedAt) : '-'}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {selected && (
            <div className="mt-6 flex flex-col gap-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Status</span>
                <StatusPill tone={statusToTone(selected.status || 'completed').tone}>
                  {statusToTone(selected.status || 'completed').label}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Source</span>
                <span className="font-mono tabular-nums text-zinc-900">{selected.source || 'csv'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Total rows</span>
                <span className="font-mono tabular-nums text-zinc-900">{(selected.total ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Imported</span>
                <span className="font-mono tabular-nums text-emerald-600">{(selected.success ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Duplicates</span>
                <span className="font-mono tabular-nums text-amber-600">{(selected.duplicate ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Failed</span>
                <span className="font-mono tabular-nums text-rose-600">{(selected.failed ?? 0).toLocaleString()}</span>
              </div>
              {selected.errorMessage && (
                <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-3 text-[12px] text-rose-700">
                  {selected.errorMessage}
                </div>
              )}
            </div>
          )}
        </ZoruSheetContent>
      </Sheet>
    </WaPage>
  );
}
