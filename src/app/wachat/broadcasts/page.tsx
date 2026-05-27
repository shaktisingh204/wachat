'use client';

import React, { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { formatDistanceToNow } from 'date-fns';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import {
  ArrowUpRight,
  BookCopy,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleStop,
  Clock,
  Ellipsis,
  FileText,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

import { getTemplates, handleStopBroadcast } from '@/app/actions/index.ts';
import { handleSyncTemplates } from '@/app/actions/template.actions';
import { getMetaFlows } from '@/app/actions/meta-flow.actions';
import { getBroadcasts } from '@/app/actions/broadcast.actions';
import type { Template, MetaFlow } from '@/lib/definitions';

import { useProject } from '@/context/project-context';

import { BroadcastForm } from '@/app/wachat/_components/broadcast-form';
import { RequeueBroadcastDialog } from '@/app/wachat/_components/requeue-broadcast-dialog';
import { SchedulerView } from '@/app/wachat/_components/scheduler-view';
import { BulkActionsWrapper } from '@/app/wachat/_components/bulk-actions-wrapper';

import {
  useZoruToast,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  Tabs,
  WaButton,
  EmptyState,
  StatusPill,
  MetricTile,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * Wachat broadcasts list. Same actions + sub-components; wachat-ui chrome.
 */

const BROADCASTS_PER_PAGE = 10;

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function tone(status: string | undefined): { label: string; tone: StatusTone } {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return { label: 'Completed', tone: 'sent' };
  if (s === 'processing' || s === 'pending_processing') return { label: 'Processing', tone: 'sending' };
  if (s === 'queued') return { label: 'Queued', tone: 'queued' };
  if (s === 'partial failure') return { label: 'Partial', tone: 'queued' };
  if (s === 'failed') return { label: 'Failed', tone: 'failed' };
  if (s === 'cancelled') return { label: 'Cancelled', tone: 'paused' };
  return { label: status || 'Unknown', tone: 'draft' };
}

function getFormattedDate(item: any): Date | null {
  try {
    if (item.createdAt && !isNaN(new Date(item.createdAt).getTime())) return new Date(item.createdAt);
    if (item._id) {
      const objectIdDate = new Date(parseInt(item._id.toString().substring(0, 8), 16) * 1000);
      if (!isNaN(objectIdDate.getTime())) return objectIdDate;
    }
  } catch (e) {
    console.error('Date formatting failed', e);
  }
  return null;
}

function StopBroadcastButton({ broadcastId }: { broadcastId: string }) {
  const { toast } = useZoruToast();
  const [isStopping, start] = useTransition();

  const onConfirm = () => {
    start(async () => {
      const result = await handleStopBroadcast(broadcastId);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Broadcast stopped', description: result.message });
      }
    });
  };

  return (
    <ZoruAlertDialog>
      <ZoruAlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Stop broadcast"
          className="grid h-7 w-7 place-items-center rounded-full text-rose-600 transition-colors hover:bg-rose-50 active:scale-[0.97]"
        >
          <CircleStop className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Stop this broadcast?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            Stopping will cancel any pending messages. Messages already sent cannot be unsent.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction onClick={onConfirm} disabled={isStopping}>
            {isStopping ? 'Stopping' : 'Stop broadcast'}
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}

function ISTClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  const ist = now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-[12px] font-semibold tabular-nums text-zinc-700">
      <Clock className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      {ist} IST
    </span>
  );
}

export default function BroadcastPage() {
  const router = useRouter();
  const { activeProject, activeProjectId } = useProject();
  const reduce = useReducedMotion();

  const [view, setView] = useState<'history' | 'schedule' | 'bulk'>('history');
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [metaFlows, setMetaFlows] = useState<WithId<MetaFlow>[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isSyncingTemplates, startTemplatesSyncTransition] = useTransition();
  const { toast } = useZoruToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchData = useCallback(
    async (projectId: string, page: number, showToast = false) => {
      startRefreshTransition(async () => {
        try {
          const [templatesData, historyData, metaFlowsData] = await Promise.all([
            getTemplates(projectId),
            getBroadcasts(projectId, page, BROADCASTS_PER_PAGE),
            getMetaFlows(projectId),
          ]);

          setTemplates(templatesData || []);
          setMetaFlows(metaFlowsData || []);
          setHistory((historyData.broadcasts || []) as any);
          setTotalCampaigns(historyData.total || 0);
          setTotalPages(Math.max(1, Math.ceil(historyData.total / BROADCASTS_PER_PAGE)));
          setHasLoaded(true);

          if (showToast) {
            toast({ title: 'Refreshed', description: 'Broadcast history has been updated.' });
          }
        } catch (error) {
          console.error('Failed to fetch broadcast page data:', error);
          toast({ title: 'Error', description: 'Failed to load page data. Please try again later.', variant: 'destructive' });
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (activeProjectId) {
      fetchData(activeProjectId, currentPage);
    }
  }, [activeProjectId, currentPage, fetchData]);

  // Live polling while any broadcast is still processing
  useEffect(() => {
    if (!activeProjectId || isRefreshing) return;
    const hasActive = history.some((b) =>
      ['QUEUED', 'PROCESSING', 'PENDING_PROCESSING'].includes(b.status),
    );
    if (!hasActive) return;
    const interval = setInterval(() => {
      fetchData(activeProjectId, currentPage, false);
    }, 15000);
    return () => clearInterval(interval);
  }, [history, activeProjectId, currentPage, fetchData, isRefreshing]);

  const onSyncTemplates = useCallback(async () => {
    if (!activeProjectId) {
      toast({ title: 'Error', description: 'No active project selected.', variant: 'destructive' });
      return;
    }
    startTemplatesSyncTransition(async () => {
      const result = await handleSyncTemplates(activeProjectId);
      if (result.error) {
        toast({ title: 'Sync failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sync successful', description: result.message });
        const templatesData = await getTemplates(activeProjectId);
        setTemplates(templatesData || []);
      }
    });
  }, [toast, activeProjectId]);

  const onBroadcastSuccess = () => {
    if (!activeProjectId) return;
    if (currentPage === 1) {
      fetchData(activeProjectId, 1, false);
    } else {
      setCurrentPage(1);
    }
  };

  const stats = React.useMemo(() => {
    const totalContacts = history.reduce((s, h) => s + (h.contactCount || 0), 0);
    const totalDelivered = history.reduce((s, h) => s + (h.deliveredCount || 0), 0);
    const totalSent = history.reduce((s, h) => s + (h.successCount || 0), 0);
    const processing = history.filter((h) =>
      ['QUEUED', 'PROCESSING', 'PENDING_PROCESSING'].includes(h.status),
    ).length;
    return { totalContacts, totalDelivered, totalSent, processing, deliveryRate: pct(totalDelivered, totalSent) };
  }, [history]);

  const filteredHistory = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((h) => {
      if (statusFilter !== 'all') {
        const s = (h.status || '').toLowerCase();
        if (statusFilter === 'live' && !['queued', 'processing', 'pending_processing'].includes(s)) return false;
        if (statusFilter === 'completed' && s !== 'completed') return false;
        if (statusFilter === 'failed' && !['failed', 'cancelled', 'partial failure'].includes(s)) return false;
      }
      if (!q) return true;
      const hay = `${h.name || ''} ${h.fileName || ''} ${h.templateName || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [history, searchQuery, statusFilter]);

  return (
    <WaPage>
      <PageHeader
        title="Campaigns"
        description="Ship a WhatsApp template to a segmented list of contacts. Upload a CSV, pick a tag, or reuse a previous audience."
        kicker="Wachat / campaigns"
        eyebrowIcon={Megaphone}
        backHref="/wachat"
        actions={
          <>
            <ISTClock />
            <WaButton
              variant="outline"
              size="sm"
              onClick={onSyncTemplates}
              disabled={!activeProjectId || isSyncingTemplates}
              leftIcon={BookCopy}
            >
              {isSyncingTemplates ? 'Syncing' : 'Sync templates'}
            </WaButton>
            <WaButton
              variant="outline"
              size="sm"
              onClick={() => activeProjectId && fetchData(activeProjectId, currentPage, true)}
              disabled={!activeProjectId || isRefreshing}
              leftIcon={RefreshCw}
            >
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </WaButton>
          </>
        }
      />

      <Tabs
        items={[
          { id: 'history', label: 'Live campaigns' },
          { id: 'schedule', label: 'Scheduler' },
          { id: 'bulk', label: 'Bulk import' },
        ]}
        active={view}
        onChange={(id) => setView(id as any)}
      />

      {view === 'history' && (
        <>
          {/* Metric strip */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="All-time campaigns" value={compact(totalCampaigns)} delay={0} />
            <MetricTile label="Messages sent" value={compact(stats.totalSent)} delay={0.05} />
            <MetricTile label="Delivery rate" value={`${stats.deliveryRate}%`} delay={0.1} />
            <MetricTile label="Live now" value={String(stats.processing)} delay={0.15} />
          </div>

          {/* New campaign */}
          <div className="mb-6">
            <Section title="New campaign" description="Choose a template or flow, upload your audience, and queue the broadcast.">
              {isRefreshing && !activeProject ? (
                <div className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100" />
              ) : (
                <BroadcastForm templates={templates} metaFlows={metaFlows} onSuccess={onBroadcastSuccess} />
              )}
            </Section>
          </div>

          {/* History */}
          <Section
            title="Broadcast history"
            description={`A log of every broadcast campaign for ${activeProject?.name || 'this project'}.`}
            action={
              <div className="flex items-center gap-1.5">
                <DropdownMenu>
                  <ZoruDropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="More"
                      className="grid h-8 w-8 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 active:scale-[0.97]"
                    >
                      <Ellipsis className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  </ZoruDropdownMenuTrigger>
                  <ZoruDropdownMenuContent align="end">
                    <ZoruDropdownMenuItem
                      onSelect={() => activeProjectId && fetchData(activeProjectId, currentPage, true)}
                    >
                      <RefreshCw /> Refresh list
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onSelect={() => router.push('/wachat/templates')}>
                      <BookCopy /> Manage templates
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onSelect={() => router.push('/wachat/contacts')}>
                      <Users /> Manage contacts
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuSeparator />
                    <ZoruDropdownMenuItem onSelect={() => router.push('/wachat/analytics')}>
                      <ArrowUpRight /> Open analytics
                    </ZoruDropdownMenuItem>
                  </ZoruDropdownMenuContent>
                </DropdownMenu>
              </div>
            }
            padded={false}
          >
            {/* Filter bar */}
            {hasLoaded && history.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-5 py-3">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <Input
                    type="text"
                    placeholder="Search by name or template"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                  <ZoruSelectTrigger className="w-[200px]">
                    <ZoruSelectValue placeholder="Status" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                    <ZoruSelectItem value="live">Live (queued/processing)</ZoruSelectItem>
                    <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
                    <ZoruSelectItem value="failed">Failed / cancelled</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
                {(searchQuery || statusFilter !== 'all') && (
                  <WaButton
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                  >
                    Clear
                  </WaButton>
                )}
                <span className="ml-auto text-[11px] tabular-nums text-zinc-500">
                  {filteredHistory.length} of {history.length}
                </span>
              </div>
            )}

            {!hasLoaded && isRefreshing ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : !activeProjectId ? (
              <div className="p-5">
                <EmptyState
                  icon={CircleAlert}
                  title="No project selected"
                  description="Please select a project from the main dashboard to view its broadcast history."
                  action={
                    <WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>
                  }
                />
              </div>
            ) : history.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={FileText}
                  title="No broadcasts yet"
                  description="Use the composer above to send your first WhatsApp broadcast. It'll appear here with live delivery and read analytics."
                />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Search} title="No broadcasts match" description="Try clearing the search or status filter." />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {filteredHistory.map((item, i) => {
                  const t = tone(item.status);
                  const progress =
                    item.contactCount > 0
                      ? (((item.successCount ?? 0) + (item.errorCount ?? 0)) * 100) / item.contactCount
                      : 0;
                  const date = getFormattedDate(item);
                  const index = (currentPage - 1) * BROADCASTS_PER_PAGE + i + 1;
                  const processing = ['QUEUED', 'PROCESSING', 'PENDING_PROCESSING'].includes(item.status);
                  return (
                    <m.li
                      key={item._id.toString()}
                      initial={reduce ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.02 + i * 0.035, ease: EASE_OUT }}
                      className="px-5 py-3 transition-colors hover:bg-zinc-50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-[11px] font-semibold tabular-nums text-zinc-600">
                          {index}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[13.5px] font-medium text-zinc-900">
                              {item.name || item.templateName || item.fileName || 'Untitled'}
                            </p>
                            <AnimatePresence mode="wait" initial={false}>
                              <m.span
                                key={item.status || 'unknown'}
                                initial={reduce ? false : { opacity: 0, y: -2 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduce ? undefined : { opacity: 0, y: 2 }}
                                transition={{ duration: 0.18, ease: EASE_OUT }}
                              >
                                <StatusPill tone={t.tone}>{t.label}</StatusPill>
                              </m.span>
                            </AnimatePresence>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-zinc-500">
                            {item.templateName && <span className="text-zinc-700">{item.templateName}</span>}
                            {item.templateName && <span className="text-zinc-300">/</span>}
                            <span>{date ? formatDistanceToNow(date, { addSuffix: true }) : '-'}</span>
                            <span className="text-zinc-300">/</span>
                            <span className="tabular-nums">{(item.contactCount ?? 0).toLocaleString()} contacts</span>
                          </div>
                        </div>
                        <div className="hidden flex-col items-end pr-1 text-[11.5px] sm:flex">
                          <div className="font-semibold tabular-nums text-zinc-900">
                            {pct(item.deliveredCount ?? 0, item.contactCount ?? 0)}%
                          </div>
                          <div className="text-[10.5px] tabular-nums text-zinc-500">
                            {compact(item.deliveredCount ?? 0)} / {compact(item.contactCount ?? 0)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {processing && <StopBroadcastButton broadcastId={item._id.toString()} />}
                          {['Completed', 'Partial Failure', 'Failed', 'Cancelled'].includes(item.status) && (
                            <RequeueBroadcastDialog
                              broadcastId={item._id.toString()}
                              originalTemplateId={item.templateId?.toString()}
                              project={activeProject}
                              templates={templates}
                            />
                          )}
                          <Link
                            href={`/wachat/broadcasts/${item._id.toString()}`}
                            aria-label="View report"
                            className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                          </Link>
                        </div>
                      </div>
                      {processing && item.contactCount > 0 && (
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                          <m.div
                            initial={false}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.4, ease: EASE_OUT }}
                            className="h-full rounded-full"
                            style={{ background: 'var(--mt-accent)' }}
                          />
                        </div>
                      )}
                    </m.li>
                  );
                })}
              </ul>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3">
                <span className="text-[11.5px] tabular-nums text-zinc-500">
                  Page {currentPage} of {totalPages} / {compact(totalCampaigns)} campaigns
                </span>
                <div className="flex items-center gap-2">
                  <WaButton
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || isRefreshing}
                    leftIcon={ChevronLeft}
                  >
                    Previous
                  </WaButton>
                  <WaButton
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages || isRefreshing}
                    rightIcon={ChevronRight}
                  >
                    Next
                  </WaButton>
                </div>
              </div>
            )}
          </Section>
        </>
      )}

      {view === 'schedule' && <SchedulerView />}
      {view === 'bulk' && <BulkActionsWrapper />}
    </WaPage>
  );
}
