'use client';

/**
 * Wachat Broadcasts — campaign list, ZoruUI rebuild.
 *
 * Same data + handlers as before (getBroadcasts, getTemplates,
 * handleSyncTemplates, handleStopBroadcast, RequeueBroadcastDialog).
 * Visual layer fully on Zoru primitives — neutral palette, no rainbow.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { formatDistanceToNow } from 'date-fns';

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

import { useZoruToast } from '@/components/zoruui';
import { useProject } from '@/context/project-context';

import { BroadcastForm } from '@/app/wachat/_components/broadcast-form';
import { RequeueBroadcastDialog } from '@/app/wachat/_components/requeue-broadcast-dialog';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruProgress,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  cn,
} from '@/components/zoruui';

const BROADCASTS_PER_PAGE = 10;

/* ── helpers ────────────────────────────────────────────────────── */

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

function statusTone(status: string | undefined): {
  label: string;
  variant: 'success' | 'info' | 'warning' | 'danger' | 'secondary';
  dot: string;
} {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed')
    return { label: 'Completed', variant: 'success', dot: 'bg-zoru-success' };
  if (s === 'processing' || s === 'pending_processing')
    return { label: 'Processing', variant: 'info', dot: 'bg-zoru-info' };
  if (s === 'queued')
    return { label: 'Queued', variant: 'warning', dot: 'bg-zoru-warning' };
  if (s === 'partial failure')
    return { label: 'Partial', variant: 'warning', dot: 'bg-zoru-warning' };
  if (s === 'failed')
    return { label: 'Failed', variant: 'danger', dot: 'bg-zoru-danger' };
  if (s === 'cancelled')
    return {
      label: 'Cancelled',
      variant: 'secondary',
      dot: 'bg-zoru-ink-subtle',
    };
  return {
    label: status || 'Unknown',
    variant: 'secondary',
    dot: 'bg-zoru-ink-subtle',
  };
}

function getFormattedDate(item: any): Date | null {
  try {
    const dateString = item.createdAt;
    if (dateString && !isNaN(new Date(dateString).getTime())) {
      return new Date(dateString);
    }
    if (item._id) {
      const objectIdDate = new Date(
        parseInt(item._id.toString().substring(0, 8), 16) * 1000,
      );
      if (!isNaN(objectIdDate.getTime())) return objectIdDate;
    }
  } catch (e) {
    console.error('Date formatting failed', e);
  }
  return null;
}

/* ── Stop-broadcast confirmation ────────────────────────────────── */

function StopBroadcastButton({ broadcastId }: { broadcastId: string }) {
  const { toast } = useZoruToast();
  const [isStopping, start] = useTransition();

  const onConfirm = () => {
    start(async () => {
      const result = await handleStopBroadcast(broadcastId);
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Broadcast stopped',
          description: result.message,
        });
      }
    });
  };

  return (
    <ZoruAlertDialog>
      <ZoruAlertDialogTrigger asChild>
        <ZoruButton
          variant="ghost"
          size="icon-sm"
          aria-label="Stop broadcast"
          className="text-zoru-danger hover:bg-zoru-danger/10 hover:text-zoru-danger"
        >
          <CircleStop className="h-3.5 w-3.5" />
        </ZoruButton>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Stop this broadcast?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            Stopping will cancel any pending messages. Messages already sent
            cannot be unsent.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction onClick={onConfirm} disabled={isStopping}>
            {isStopping ? 'Stopping…' : 'Stop broadcast'}
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}

/* ── IST clock chip ─────────────────────────────────────────────── */

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
    <ZoruButton variant="outline" size="sm" disabled>
      <Clock className="h-3.5 w-3.5" />
      {ist} IST
    </ZoruButton>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function BroadcastPage() {
  const router = useRouter();
  const { activeProject, activeProjectId } = useProject();
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
          setTotalPages(
            Math.max(1, Math.ceil(historyData.total / BROADCASTS_PER_PAGE)),
          );
          setHasLoaded(true);

          if (showToast) {
            toast({
              title: 'Refreshed',
              description: 'Broadcast history has been updated.',
            });
          }
        } catch (error) {
          console.error('Failed to fetch broadcast page data:', error);
          toast({
            title: 'Error',
            description: 'Failed to load page data. Please try again later.',
            variant: 'destructive',
          });
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

  /* Live polling while any broadcast is still processing */
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
      toast({
        title: 'Error',
        description: 'No active project selected.',
        variant: 'destructive',
      });
      return;
    }
    startTemplatesSyncTransition(async () => {
      const result = await handleSyncTemplates(activeProjectId);
      if (result.error) {
        toast({
          title: 'Sync failed',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sync successful',
          description: result.message,
        });
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
    const totalContacts = history.reduce(
      (s, h) => s + (h.contactCount || 0),
      0,
    );
    const totalDelivered = history.reduce(
      (s, h) => s + (h.deliveredCount || 0),
      0,
    );
    const totalSent = history.reduce((s, h) => s + (h.successCount || 0), 0);
    const processing = history.filter((h) =>
      ['QUEUED', 'PROCESSING', 'PENDING_PROCESSING'].includes(h.status),
    ).length;
    return {
      totalContacts,
      totalDelivered,
      totalSent,
      processing,
      deliveryRate: pct(totalDelivered, totalSent),
    };
  }, [history]);

  const filteredHistory = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((h) => {
      if (statusFilter !== 'all') {
        const s = (h.status || '').toLowerCase();
        if (
          statusFilter === 'live' &&
          !['queued', 'processing', 'pending_processing'].includes(s)
        )
          return false;
        if (statusFilter === 'completed' && s !== 'completed') return false;
        if (
          statusFilter === 'failed' &&
          !['failed', 'cancelled', 'partial failure'].includes(s)
        )
          return false;
      }
      if (!q) return true;
      const hay = `${h.name || ''} ${h.fileName || ''} ${h.templateName || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [history, searchQuery, statusFilter]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      {/* ── Breadcrumb ── */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Campaigns</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Campaigns
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Ship a WhatsApp template to a segmented list of contacts — upload a
            CSV, pick a tag, or reuse a previous audience.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ISTClock />
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={onSyncTemplates}
            disabled={!activeProjectId || isSyncingTemplates}
          >
            <BookCopy className="h-3.5 w-3.5" />
            {isSyncingTemplates ? 'Syncing…' : 'Sync templates'}
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() =>
              activeProjectId && fetchData(activeProjectId, currentPage, true)
            }
            disabled={!activeProjectId || isRefreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </ZoruButton>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ZoruStatCard
          label="All-time campaigns"
          value={compact(totalCampaigns)}
          period="across this project"
        />
        <ZoruStatCard
          label="Messages sent"
          value={compact(stats.totalSent)}
          period="sum of this page"
        />
        <ZoruStatCard
          label="Delivery rate"
          value={`${stats.deliveryRate}%`}
          period={`${compact(stats.totalDelivered)} delivered`}
        />
        <ZoruStatCard
          label="Live now"
          value={String(stats.processing)}
          period={
            stats.processing > 0 ? 'polling every 15s' : 'nothing running'
          }
        />
      </div>

      {/* ── New campaign form ── */}
      <section>
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[22px] tracking-tight text-zoru-ink leading-none">
              New campaign
            </h2>
            <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
              Choose a template or flow, upload your audience, and queue the
              broadcast.
            </p>
          </div>
        </div>
        <ZoruCard className="mt-5 p-6">
          {isRefreshing && !activeProject ? (
            <div className="h-40 w-full animate-pulse rounded-[var(--zoru-radius)] bg-zoru-surface-2" />
          ) : (
            <BroadcastForm
              templates={templates}
              metaFlows={metaFlows}
              onSuccess={onBroadcastSuccess}
            />
          )}
        </ZoruCard>
      </section>

      {/* ── Broadcast history ── */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] tracking-tight text-zoru-ink leading-none">
              Broadcast history
            </h2>
            <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
              A log of every broadcast campaign for{' '}
              {activeProject?.name || 'this project'}.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ZoruButton
              variant="outline"
              size="icon-sm"
              aria-label="New campaign"
              onClick={() => {
                const el = document.querySelector('h2');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Plus />
            </ZoruButton>
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="icon-sm" aria-label="More">
                  <Ellipsis />
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem
                  onSelect={() =>
                    activeProjectId &&
                    fetchData(activeProjectId, currentPage, true)
                  }
                >
                  <RefreshCw /> Refresh list
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem
                  onSelect={() => router.push('/wachat/templates')}
                >
                  <BookCopy /> Manage templates
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem
                  onSelect={() => router.push('/wachat/contacts')}
                >
                  <Users /> Manage contacts
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuItem
                  onSelect={() => router.push('/dashboard/analytics')}
                >
                  <ArrowUpRight /> Open analytics
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
          </div>
        </div>

        <ZoruCard className="mt-5 p-6">
          {/* ── Filter bar ── */}
          {hasLoaded && history.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-zoru-line pb-4">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-muted" />
                <ZoruInput
                  type="text"
                  placeholder="Search by name or template..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ZoruSelect
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v)}
              >
                <ZoruSelectTrigger className="w-[200px]">
                  <ZoruSelectValue placeholder="Status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                  <ZoruSelectItem value="live">
                    Live (queued/processing)
                  </ZoruSelectItem>
                  <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
                  <ZoruSelectItem value="failed">
                    Failed / cancelled
                  </ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
              {(searchQuery || statusFilter !== 'all') && (
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  Clear
                </ZoruButton>
              )}
              <span className="ml-auto text-[11px] text-zoru-ink-muted tabular-nums">
                {filteredHistory.length} of {history.length}
              </span>
            </div>
          )}

          {!hasLoaded && isRefreshing ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
            </div>
          ) : !activeProjectId ? (
            <ZoruEmptyState
              icon={<CircleAlert />}
              title="No project selected"
              description="Please select a project from the main dashboard to view its broadcast history."
              action={
                <ZoruButton size="sm" onClick={() => router.push('/wachat')}>
                  Choose a project
                </ZoruButton>
              }
            />
          ) : history.length === 0 ? (
            <ZoruEmptyState
              icon={<FileText />}
              title="No broadcasts yet"
              description="Use the composer above to send your first WhatsApp broadcast — it'll appear here with live delivery and read analytics."
            />
          ) : filteredHistory.length === 0 ? (
            <ZoruEmptyState
              icon={<Search />}
              title="No broadcasts match"
              description="Try clearing the search or status filter."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filteredHistory.map((item, i) => {
                const tone = statusTone(item.status);
                const processing =
                  item.status === 'PROCESSING' && item.contactCount > 0;
                const progress =
                  item.contactCount > 0
                    ? (((item.successCount ?? 0) + (item.errorCount ?? 0)) *
                        100) /
                      item.contactCount
                    : 0;
                const date = getFormattedDate(item);
                const index =
                  (currentPage - 1) * BROADCASTS_PER_PAGE + i + 1;
                return (
                  <div
                    key={item._id.toString()}
                    className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4 transition-colors hover:bg-zoru-surface"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zoru-surface-2 text-[11px] text-zoru-ink-muted tabular-nums">
                        {index}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-zoru-ink truncate">
                            {item.name ||
                              item.templateName ||
                              item.fileName ||
                              'Untitled'}
                          </p>
                          <ZoruBadge variant={tone.variant}>
                            <span
                              className={cn('h-1.5 w-1.5 rounded-full', tone.dot)}
                            />
                            {tone.label}
                          </ZoruBadge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-zoru-ink-muted">
                          {item.templateName ? (
                            <span className="text-zoru-ink">
                              {item.templateName}
                            </span>
                          ) : null}
                          {item.templateName ? (
                            <span className="text-zoru-ink-subtle">·</span>
                          ) : null}
                          <span>
                            {date
                              ? formatDistanceToNow(date, { addSuffix: true })
                              : '—'}
                          </span>
                          <span className="text-zoru-ink-subtle">·</span>
                          <span>
                            {(item.contactCount ?? 0).toLocaleString()} contacts
                          </span>
                        </div>
                      </div>
                      <div className="hidden flex-col items-end pr-1 text-[11.5px] sm:flex">
                        <div className="text-zoru-ink">
                          {pct(
                            item.deliveredCount ?? 0,
                            item.contactCount ?? 0,
                          )}
                          %
                        </div>
                        <div className="text-[10.5px] text-zoru-ink-muted">
                          {compact(item.deliveredCount ?? 0)} /{' '}
                          {compact(item.contactCount ?? 0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[
                          'QUEUED',
                          'PROCESSING',
                          'PENDING_PROCESSING',
                        ].includes(item.status) && (
                          <StopBroadcastButton
                            broadcastId={item._id.toString()}
                          />
                        )}
                        {[
                          'Completed',
                          'Partial Failure',
                          'Failed',
                          'Cancelled',
                        ].includes(item.status) && (
                          <RequeueBroadcastDialog
                            broadcastId={item._id.toString()}
                            originalTemplateId={item.templateId?.toString()}
                            project={activeProject}
                            templates={templates}
                          />
                        )}
                        <ZoruButton
                          variant="ghost"
                          size="icon-sm"
                          asChild
                          aria-label="View report"
                        >
                          <Link
                            href={`/wachat/broadcasts/${item._id.toString()}`}
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </ZoruButton>
                      </div>
                    </div>
                    {processing ? (
                      <ZoruProgress value={progress} className="mt-3 h-1" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-zoru-line pt-4">
              <span className="text-[11.5px] tabular-nums text-zoru-ink-muted">
                Page {currentPage} of {totalPages} · {compact(totalCampaigns)}{' '}
                campaigns
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isRefreshing}
                >
                  <ChevronLeft className="h-3 w-3" />
                  Previous
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage >= totalPages || isRefreshing}
                >
                  Next
                  <ChevronRight className="h-3 w-3" />
                </ZoruButton>
              </div>
            </div>
          ) : null}
        </ZoruCard>
      </section>

      <div className="h-6" />
    </div>
  );
}
