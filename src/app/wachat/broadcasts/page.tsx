'use client';

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { formatDistanceToNow } from 'date-fns';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookCopy,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleStop,
  Clock,
  Coins,
  Ellipsis,
  Eye,
  FileText,
  Filter,
  Loader2,
  Megaphone,
  Pause,
  Phone,
  RefreshCw,
  Search,
  Send,
  TriangleAlert,
  Users,
  XCircle,
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

type SortKey = 'date' | 'name' | 'audience' | 'delivery' | 'status';
type SortDir = 'asc' | 'desc';

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
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [senderFilter, setSenderFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  // KPI strip (6 tiles): total, sent today, queued, paused/cancelled, failed, avg delivery
  const stats = useMemo(() => {
    let sentToday = 0;
    let queued = 0;
    let paused = 0;
    let failed = 0;
    let totalContacts = 0;
    let totalDelivered = 0;
    let totalSent = 0;
    let totalRead = 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    for (const h of history) {
      const s = (h.status || '').toLowerCase();
      const d = getFormattedDate(h);
      if (s === 'queued' || s === 'processing' || s === 'pending_processing') queued++;
      if (s === 'cancelled') paused++;
      if (s === 'failed' || s === 'partial failure') failed++;
      if (d && d >= startOfDay) sentToday += h.successCount || 0;
      totalContacts += h.contactCount || 0;
      totalDelivered += h.deliveredCount || 0;
      totalSent += h.successCount || 0;
      totalRead += h.readCount || 0;
    }
    return {
      sentToday,
      queued,
      paused,
      failed,
      totalContacts,
      totalDelivered,
      totalSent,
      totalRead,
      deliveryRate: pct(totalDelivered, totalSent),
      readRate: pct(totalRead, totalDelivered),
    };
  }, [history]);

  const senderOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const h of history) {
      const id = h.phoneNumberId || h.senderId || '';
      const label = h.senderLabel || h.phoneDisplayNumber || id;
      if (id && !set.has(id)) set.set(id, label);
    }
    return Array.from(set, ([id, label]) => ({ id, label }));
  }, [history]);

  const templateOptions = useMemo(() => {
    const set = new Set<string>();
    for (const h of history) if (h.templateName) set.add(h.templateName);
    return Array.from(set);
  }, [history]);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = history.filter((h) => {
      if (statusFilter !== 'all') {
        const s = (h.status || '').toLowerCase();
        if (statusFilter === 'live' && !['queued', 'processing', 'pending_processing'].includes(s)) return false;
        if (statusFilter === 'completed' && s !== 'completed') return false;
        if (statusFilter === 'failed' && !['failed', 'cancelled', 'partial failure'].includes(s)) return false;
      }
      if (templateFilter !== 'all' && h.templateName !== templateFilter) return false;
      if (senderFilter !== 'all' && (h.phoneNumberId || h.senderId) !== senderFilter) return false;
      if (!q) return true;
      const hay = `${h.name || ''} ${h.fileName || ''} ${h.templateName || ''}`.toLowerCase();
      return hay.includes(q);
    });
    const sorted = [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') {
        return (a.name || a.templateName || '').localeCompare(b.name || b.templateName || '') * dir;
      }
      if (sortKey === 'audience') return ((a.contactCount || 0) - (b.contactCount || 0)) * dir;
      if (sortKey === 'delivery')
        return (pct(a.deliveredCount ?? 0, a.contactCount ?? 0) - pct(b.deliveredCount ?? 0, b.contactCount ?? 0)) * dir;
      if (sortKey === 'status') return (a.status || '').localeCompare(b.status || '') * dir;
      const da = getFormattedDate(a)?.getTime() ?? 0;
      const db = getFormattedDate(b)?.getTime() ?? 0;
      return (da - db) * dir;
    });
    return sorted;
  }, [history, searchQuery, statusFilter, templateFilter, senderFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'name' ? 'asc' : 'desc');
    }
  };

  const SortArrow = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === 'asc' ? (
        <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
      ) : (
        <ArrowDown className="h-3 w-3" strokeWidth={2.5} />
      )
    ) : null;

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
          {/* KPI strip - 6 tiles on lg */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricTile label="All-time campaigns" value={compact(totalCampaigns)} icon={Megaphone} delay={0} />
            <MetricTile label="Sent today" value={compact(stats.sentToday)} icon={Send} delay={0.04} />
            <MetricTile label="Queued / live" value={compact(stats.queued)} icon={Clock} delay={0.08} />
            <MetricTile label="Cancelled" value={compact(stats.paused)} icon={Pause} delay={0.12} />
            <MetricTile label="Failed" value={compact(stats.failed)} icon={TriangleAlert} delay={0.16} />
            <MetricTile label="Avg delivery" value={`${stats.deliveryRate}%`} icon={CheckCheck} delay={0.2} />
          </div>

          {/* Composer + facet rail */}
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_280px]">
            <Section title="New campaign" description="Choose a template or flow, upload your audience, and queue the broadcast.">
              {isRefreshing && !activeProject ? (
                <div className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100" />
              ) : (
                <BroadcastForm templates={templates} metaFlows={metaFlows} onSuccess={onBroadcastSuccess} />
              )}
            </Section>
            <Section title="Facets" description="Filter the campaign history.">
              <div className="flex flex-col gap-3">
                <FacetGroup
                  label="Status"
                  items={[
                    { id: 'all', label: 'All', count: history.length },
                    { id: 'live', label: 'Live', count: stats.queued },
                    { id: 'completed', label: 'Completed', count: history.filter((h) => h.status === 'Completed').length },
                    { id: 'failed', label: 'Failed', count: stats.failed },
                  ]}
                  active={statusFilter}
                  onChange={setStatusFilter}
                />
                {templateOptions.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Template</p>
                    <Select value={templateFilter} onValueChange={setTemplateFilter}>
                      <ZoruSelectTrigger className="h-8">
                        <ZoruSelectValue placeholder="All templates" />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="all">All templates</ZoruSelectItem>
                        {templateOptions.map((t) => (
                          <ZoruSelectItem key={t} value={t}>{t}</ZoruSelectItem>
                        ))}
                      </ZoruSelectContent>
                    </Select>
                  </div>
                )}
                {senderOptions.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Sender</p>
                    <Select value={senderFilter} onValueChange={setSenderFilter}>
                      <ZoruSelectTrigger className="h-8">
                        <ZoruSelectValue placeholder="All senders" />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="all">All senders</ZoruSelectItem>
                        {senderOptions.map((s) => (
                          <ZoruSelectItem key={s.id} value={s.id}>{s.label}</ZoruSelectItem>
                        ))}
                      </ZoruSelectContent>
                    </Select>
                  </div>
                )}
                <div className="border-t border-zinc-100 pt-3 text-[11px] tabular-nums text-zinc-500">
                  Showing {filteredHistory.length} of {history.length}
                </div>
              </div>
            </Section>
          </div>

          {/* History table */}
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
                    <ZoruDropdownMenuItem onSelect={() => activeProjectId && fetchData(activeProjectId, currentPage, true)}>
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
                  <ZoruSelectTrigger className="w-[180px]">
                    <ZoruSelectValue placeholder="Status" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                    <ZoruSelectItem value="live">Live (queued/processing)</ZoruSelectItem>
                    <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
                    <ZoruSelectItem value="failed">Failed / cancelled</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
                {(searchQuery || statusFilter !== 'all' || templateFilter !== 'all' || senderFilter !== 'all') && (
                  <WaButton
                    variant="ghost"
                    size="sm"
                    leftIcon={Filter}
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setTemplateFilter('all');
                      setSenderFilter('all');
                    }}
                  >
                    Clear filters
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
                  action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
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
              <div className="overflow-x-auto">
                {/* Header row */}
                <div className="hidden border-b border-zinc-100 bg-zinc-50/60 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 lg:grid lg:grid-cols-[28px_minmax(220px,2fr)_120px_100px_140px_84px_64px_64px_72px_88px_auto]">
                  <span>#</span>
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-left hover:text-zinc-900">
                    Campaign <SortArrow k="name" />
                  </button>
                  <button onClick={() => toggleSort('status')} className="flex items-center gap-1 text-left hover:text-zinc-900">
                    Status <SortArrow k="status" />
                  </button>
                  <button onClick={() => toggleSort('audience')} className="flex items-center justify-end gap-1 text-right hover:text-zinc-900">
                    Audience <SortArrow k="audience" />
                  </button>
                  <span>Progress</span>
                  <button onClick={() => toggleSort('delivery')} className="flex items-center justify-end gap-1 text-right hover:text-zinc-900">
                    Delivery <SortArrow k="delivery" />
                  </button>
                  <span className="text-right">Read</span>
                  <span className="text-right">Failed</span>
                  <span className="text-right">Cost</span>
                  <button onClick={() => toggleSort('date')} className="flex items-center gap-1 text-left hover:text-zinc-900">
                    When <SortArrow k="date" />
                  </button>
                  <span className="text-right">Actions</span>
                </div>
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
                    const deliveryRate = pct(item.deliveredCount ?? 0, item.contactCount ?? 0);
                    const readRate = pct(item.readCount ?? 0, item.deliveredCount ?? 0);
                    const failedCount = item.errorCount ?? 0;
                    const cost = item.estimatedCost ?? item.cost;
                    const sender = item.senderLabel || item.phoneDisplayNumber || item.phoneNumberId;
                    return (
                      <m.li
                        key={item._id.toString()}
                        initial={reduce ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.02 + i * 0.03, ease: EASE_OUT }}
                        className="px-5 py-2.5 transition-colors hover:bg-zinc-50/80 lg:grid lg:grid-cols-[28px_minmax(220px,2fr)_120px_100px_140px_84px_64px_64px_72px_88px_auto] lg:items-center lg:gap-3"
                      >
                        {/* index */}
                        <span className="hidden text-[11px] tabular-nums text-zinc-400 lg:block">{index}</span>

                        {/* campaign cell: thumbnail + name + sub */}
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold uppercase text-white"
                            style={{ backgroundColor: '#25D366' }}
                            aria-hidden
                          >
                            {(item.templateName || item.name || 'WA').slice(0, 2)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-zinc-900">
                              {item.name || item.templateName || item.fileName || 'Untitled'}
                            </p>
                            <p className="truncate text-[11px] text-zinc-500">
                              {item.templateName ? <span className="font-mono">{item.templateName}</span> : 'free text'}
                              {sender && (
                                <>
                                  <span className="px-1 text-zinc-300">/</span>
                                  <Phone className="mr-0.5 inline h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                                  <span className="font-mono">{sender}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* status */}
                        <div>
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

                        {/* audience */}
                        <div className="hidden text-right text-[12px] tabular-nums text-zinc-700 lg:block">
                          {compact(item.contactCount)}
                        </div>

                        {/* progress bar */}
                        <div className="hidden lg:block">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                            <m.div
                              initial={false}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.4, ease: EASE_OUT }}
                              className="h-full rounded-full"
                              style={{ background: processing ? 'var(--mt-accent)' : '#a1a1aa' }}
                            />
                          </div>
                          <p className="mt-0.5 text-right text-[10px] tabular-nums text-zinc-500">
                            {compact((item.successCount ?? 0) + (item.errorCount ?? 0))} / {compact(item.contactCount)}
                          </p>
                        </div>

                        {/* delivery */}
                        <div className="hidden text-right lg:block">
                          <p className="text-[12px] font-semibold tabular-nums text-zinc-900">{deliveryRate}%</p>
                          <p className="text-[10px] tabular-nums text-zinc-500">{compact(item.deliveredCount ?? 0)}</p>
                        </div>

                        {/* read */}
                        <div className="hidden text-right lg:block">
                          <p className="text-[12px] tabular-nums text-zinc-700">
                            {item.readCount != null ? `${readRate}%` : '-'}
                          </p>
                        </div>

                        {/* failed */}
                        <div className="hidden text-right lg:block">
                          <p className={`text-[12px] tabular-nums ${failedCount > 0 ? 'text-rose-600' : 'text-zinc-400'}`}>
                            {compact(failedCount)}
                          </p>
                        </div>

                        {/* cost */}
                        <div className="hidden text-right lg:block">
                          {cost != null ? (
                            <p className="inline-flex items-center gap-0.5 text-[12px] tabular-nums text-zinc-700">
                              <Coins className="h-2.5 w-2.5 text-zinc-400" strokeWidth={2.5} />
                              {Number(cost).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                          ) : (
                            <p className="text-[12px] text-zinc-400">-</p>
                          )}
                        </div>

                        {/* when */}
                        <div className="hidden text-[11px] tabular-nums text-zinc-500 lg:block">
                          {date ? formatDistanceToNow(date, { addSuffix: true }) : '-'}
                        </div>

                        {/* actions */}
                        <div className="mt-1 flex items-center justify-end gap-0.5 lg:mt-0">
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

                        {/* mobile inline subline */}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 lg:hidden">
                          <span className="tabular-nums">{compact(item.contactCount)} contacts</span>
                          <span className="text-zinc-300">/</span>
                          <span className="tabular-nums">{deliveryRate}% delivered</span>
                          <span className="text-zinc-300">/</span>
                          <span className="tabular-nums">{date ? formatDistanceToNow(date, { addSuffix: true }) : '-'}</span>
                        </div>
                      </m.li>
                    );
                  })}
                </ul>
              </div>
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

function FacetGroup({
  label,
  items,
  active,
  onChange,
}: {
  label: string;
  items: { id: string; label: string; count: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</p>
      <ul className="flex flex-col">
        {items.map((it) => {
          const on = active === it.id;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onChange(it.id)}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-[12px] transition-colors ${
                  on ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <span>{it.label}</span>
                <span className={`tabular-nums ${on ? 'text-white/70' : 'text-zinc-400'}`}>{it.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
