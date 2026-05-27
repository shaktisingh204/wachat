'use client';

import { fmtDate } from '@/lib/utils';

import {
  useZoruToast,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
} from 'react';
import {
  FileSpreadsheet,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  Users,
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

export default function ContactImportHistoryPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [imports, setImports] = useState<any[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [selected, setSelected] = useState<any | null>(null);
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

  const totalImported = imports.reduce((s, i) => s + (i.success ?? 0), 0);
  const totalFailed = imports.reduce((s, i) => s + (i.failed ?? 0), 0);
  const isLoadingInitial = isLoading && imports.length === 0;
  const stagger = reduceMotion ? 0 : 0.03;

  return (
    <WaPage>
      <PageHeader
        title="Import history"
        description="View the history of all past CSV contact imports."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
      />

      <section aria-labelledby="import-metrics" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <h2 id="import-metrics" className="sr-only">Import stats</h2>
        <MetricTile label="Total imports" value={imports.length} icon={FileSpreadsheet} delay={0} />
        <MetricTile label="Contacts imported" value={totalImported.toLocaleString()} icon={Users} delay={0.05} />
        <MetricTile label="Rows failed" value={totalFailed.toLocaleString()} icon={CircleX} delay={0.1} />
      </section>

      <Section title="Imports" padded={false}>
        {isLoadingInitial ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="h-9 w-9 animate-pulse rounded-xl bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 animate-pulse rounded-full bg-zinc-100" />
                  <div className="h-2.5 w-32 animate-pulse rounded-full bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        ) : imports.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              icon={FileSpreadsheet}
              title="No import records found"
              description="Imports performed via the Contacts page will appear here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {imports.map((imp, i) => {
                const s = statusToTone(imp.status || 'completed');
                return (
                  <m.li
                    key={imp._id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: i * stagger, ease: EASE_OUT }}
                    className="flex items-center gap-3 px-5 py-3.5"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600">
                      <FileSpreadsheet className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-zinc-900">
                        {imp.filename || 'Unknown file'}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-zinc-500 tabular-nums">
                        <span>{imp.importedAt ? fmtDate(imp.importedAt) : '-'}</span>
                        <span>{(imp.total ?? 0).toLocaleString()} rows</span>
                        <span className="text-emerald-600">{(imp.success ?? 0).toLocaleString()} imported</span>
                        {(imp.failed ?? 0) > 0 && (
                          <span className="text-rose-600">{(imp.failed ?? 0).toLocaleString()} failed</span>
                        )}
                      </div>
                      <AnimatePresence>
                        {imp.status === 'processing' && (
                          <m.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: EASE_OUT }}
                            className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-100"
                          >
                            <m.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, ((imp.success ?? 0) / Math.max(1, imp.total ?? 1)) * 100)}%` }}
                              transition={{ duration: 0.6, ease: EASE_OUT }}
                              className="h-full"
                              style={{ background: 'var(--mt-accent)' }}
                            />
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                      <WaButton variant="outline" size="sm" leftIcon={Eye} onClick={() => setSelected(imp)}>
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
              {selected?.importedAt ? fmtDate(selected.importedAt) : '-'}
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
                <span className="text-zinc-500">Total rows</span>
                <span className="font-mono tabular-nums text-zinc-900">{(selected.total ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Imported</span>
                <span className="font-mono tabular-nums text-emerald-600">{(selected.success ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Failed</span>
                <span className="font-mono tabular-nums text-rose-600">{(selected.failed ?? 0).toLocaleString()}</span>
              </div>
              {selected.errorMessage && (
                <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-[12px] text-rose-700">
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
