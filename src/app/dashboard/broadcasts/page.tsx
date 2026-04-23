'use client';

/**
 * Wachat Broadcasts — list + create, rebuilt on Clay primitives.
 *
 * Keeps the existing BroadcastForm (the composer is a beast I don't
 * want to touch), StopBroadcastButton, and RequeueBroadcastDialog —
 * just replaces the page chrome, stats strip, and history table with
 * Clay cards / list rows.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { formatDistanceToNow } from 'date-fns';

import {
  LuRefreshCw,
  LuClock,
  LuCircleAlert,
  LuFileText,
  LuLoader,
  LuCircleStop,
  LuArrowUpRight,
  LuChevronLeft,
  LuChevronRight,
  LuPlus,
  LuEllipsis,
  LuBookCopy,
  LuUsers,
  LuSearch,
} from 'react-icons/lu';

import { getTemplates, handleStopBroadcast } from '@/app/actions/index.ts';
import { handleSyncTemplates } from '@/app/actions/template.actions';
import { getMetaFlows } from '@/app/actions/meta-flow.actions';
import { getBroadcasts } from '@/app/actions/broadcast.actions';
import type { Template, MetaFlow } from '@/lib/definitions';

import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/context/project-context';

import { BroadcastForm } from '@/components/wabasimplify/broadcast-form';
import { RequeueBroadcastDialog } from '@/components/wabasimplify/requeue-broadcast-dialog';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { cn } from '@/lib/utils';
import {
  ClayBreadcrumbs,
  ClayButton,
  ClayCard,
  ClayListRow,
} from '@/components/clay';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

/* Status colour tokens — keeps status badges on-brand */
function statusTone(status: string | undefined) {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return { dot: 'bg-clay-green', label: 'Completed' };
  if (s === 'processing' || s === 'pending_processing')
    return { dot: 'bg-clay-blue', label: 'Processing' };
  if (s === 'queued') return { dot: 'bg-clay-amber', label: 'Queued' };
  if (s === 'partial failure')
    return { dot: 'bg-clay-amber', label: 'Partial' };
  if (s === 'failed') return { dot: 'bg-clay-red', label: 'Failed' };
  if (s === 'cancelled')
    return { dot: 'bg-clay-ink-fade', label: 'Cancelled' };
  return { dot: 'bg-clay-ink-fade', label: status || 'Unknown' };
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
  const { toast } = useToast();
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
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Stop broadcast"
          className="flex h-7 w-7 items-center justify-center rounded-md text-clay-red hover:bg-clay-red-soft transition-colors"
        >
          <LuCircleStop className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop this broadcast?</AlertDialogTitle>
          <AlertDialogDescription>
            Stopping will cancel any pending messages. Messages already sent
            cannot be unsent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isStopping}>
            {isStopping ? 'Stopping…' : 'Stop broadcast'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── IST clock chip (topbar-style pill) ─────────────────────────── */

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
    <ClayButton
      variant="pill"
      size="md"
      leading={<LuClock className="h-3.5 w-3.5" strokeWidth={2} />}
    >
      {ist} IST
    </ClayButton>
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
  const { toast } = useToast();

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
    }, 15000); // Poll every 15s to reduce server load
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

  /* ── derived stats strip ─────────────────────────────────────── */
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

  /* ── client-side filters over current page ─────────────────── */
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
    <div className="clay-enter flex min-h-full flex-col gap-6">
      {/* ── Breadcrumb ── */}
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Campaigns' },
        ]}
      />

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Campaigns
          </h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">
            Ship a WhatsApp template to a segmented list of contacts — upload a
            CSV, pick a tag, or reuse a previous audience.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ISTClock />
          <ClayButton
            variant="pill"
            size="md"
            leading={<LuBookCopy className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={onSyncTemplates}
            disabled={!activeProjectId || isSyncingTemplates}
          >
            {isSyncingTemplates ? 'Syncing…' : 'Sync templates'}
          </ClayButton>
          <ClayButton
            variant="pill"
            size="md"
            leading={<LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={() =>
              activeProjectId && fetchData(activeProjectId, currentPage, true)
            }
            disabled={!activeProjectId || isRefreshing}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </ClayButton>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat
          label="All-time campaigns"
          value={compact(totalCampaigns)}
          hint="across this project"
        />
        <MiniStat
          label="Messages sent"
          value={compact(stats.totalSent)}
          hint="sum of this page"
        />
        <MiniStat
          label="Delivery rate"
          value={`${stats.deliveryRate}%`}
          hint={`${compact(stats.totalDelivered)} delivered`}
        />
        <MiniStat
          label="Live now"
          value={String(stats.processing)}
          hint={stats.processing > 0 ? 'polling every 15s' : 'nothing running'}
        />
      </div>

      {/* ── New campaign form ── */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-clay-ink leading-none">
              New campaign
            </h2>
            <p className="mt-1.5 text-[12.5px] text-clay-ink-muted">
              Choose a template or flow, upload your audience, and queue the
              broadcast.
            </p>
          </div>
        </div>
        <ClayCard padded={false} className="mt-5 p-6">
          {isRefreshing && !activeProject ? (
            <div className="h-40 w-full animate-pulse rounded-[12px] bg-clay-bg-2" />
          ) : (
            <BroadcastForm
              templates={templates}
              metaFlows={metaFlows}
              onSuccess={onBroadcastSuccess}
            />
          )}
        </ClayCard>
      </div>

      {/* ── Broadcast history ── */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-clay-ink leading-none">
              Broadcast history
            </h2>
            <p className="mt-1.5 text-[12.5px] text-clay-ink-muted">
              A log of every broadcast campaign for{' '}
              {activeProject?.name || 'this project'}.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ClayButton
              variant="pill"
              size="icon"
              aria-label="New campaign"
              onClick={() => {
                const el = document.querySelector('h2');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <LuPlus className="h-4 w-4" />
            </ClayButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ClayButton variant="pill" size="icon" aria-label="More">
                  <LuEllipsis className="h-4 w-4" />
                </ClayButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    activeProjectId &&
                    fetchData(activeProjectId, currentPage, true)
                  }
                >
                  <LuRefreshCw className="mr-2 h-4 w-4" /> Refresh list
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => router.push('/dashboard/templates')}
                >
                  <LuBookCopy className="mr-2 h-4 w-4" /> Manage templates
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => router.push('/dashboard/contacts')}
                >
                  <LuUsers className="mr-2 h-4 w-4" /> Manage contacts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => router.push('/dashboard/analytics')}
                >
                  <LuArrowUpRight className="mr-2 h-4 w-4" /> Open analytics
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ClayCard padded={false} className="mt-5 p-6">
          {/* ── Filter bar ── */}
          {hasLoaded && history.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-clay-border pb-4">
              <div className="relative min-w-[240px] flex-1">
                <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-clay-ink-muted" strokeWidth={1.75} />
                <input
                  type="text"
                  placeholder="Search by name or template..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-[10px] border border-clay-border bg-clay-surface pl-9 pr-3 text-[13px] text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-border-strong focus:outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-[10px] border border-clay-border bg-clay-surface px-3 text-[13px] text-clay-ink focus:border-clay-border-strong focus:outline-none"
              >
                <option value="all">All statuses</option>
                <option value="live">Live (queued/processing)</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed / cancelled</option>
              </select>
              {(searchQuery || statusFilter !== 'all') && (
                <ClayButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  Clear
                </ClayButton>
              )}
              <span className="ml-auto text-[11px] text-clay-ink-muted tabular-nums">
                {filteredHistory.length} of {history.length}
              </span>
            </div>
          )}

          {!hasLoaded && isRefreshing ? (
            <div className="flex h-24 items-center justify-center">
              <LuLoader
                className="h-5 w-5 animate-spin text-clay-ink-muted"
                strokeWidth={1.75}
              />
            </div>
          ) : !activeProjectId ? (
            <div className="flex flex-col items-center gap-2 rounded-clay-md border border-dashed border-clay-border bg-clay-surface-2 px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-rose-soft text-clay-rose-ink">
                <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div className="text-[13px] font-semibold text-clay-ink">
                No project selected
              </div>
              <div className="max-w-[340px] text-[11.5px] text-clay-ink-muted">
                Please select a project from the main dashboard to view its
                broadcast history.
              </div>
              <ClayButton
                variant="rose"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="mt-1"
              >
                Choose a project
              </ClayButton>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-clay-md border border-dashed border-clay-border bg-clay-surface-2 px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-bg text-clay-ink-muted">
                <LuFileText className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div className="text-[13px] font-semibold text-clay-ink">
                No broadcasts yet
              </div>
              <div className="max-w-[340px] text-[11.5px] text-clay-ink-muted">
                Use the composer above to send your first WhatsApp broadcast —
                it&apos;ll appear here with live delivery and read analytics.
              </div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-clay-md border border-dashed border-clay-border bg-clay-surface-2 px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-bg text-clay-ink-muted">
                <LuSearch className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div className="text-[13px] font-semibold text-clay-ink">
                No broadcasts match
              </div>
              <div className="max-w-[340px] text-[11.5px] text-clay-ink-muted">
                Try clearing the search or status filter.
              </div>
            </div>
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
                const index = (currentPage - 1) * BROADCASTS_PER_PAGE + i + 1;
                return (
                  <ClayListRow
                    key={item._id.toString()}
                    index={index}
                    title={item.name || item.templateName || item.fileName || 'Untitled'}
                    meta={
                      <span className="flex flex-wrap items-center gap-2">
                        {item.templateName ? (
                          <span className="font-medium text-clay-ink-2">
                            {item.templateName}
                          </span>
                        ) : null}
                        {item.templateName ? (
                          <span className="text-clay-ink-fade">·</span>
                        ) : null}
                        <span>
                          {date
                            ? formatDistanceToNow(date, { addSuffix: true })
                            : '—'}
                        </span>
                        <span className="text-clay-ink-fade">·</span>
                        <span>
                          {(item.contactCount ?? 0).toLocaleString()} contacts
                        </span>
                        <span className="text-clay-ink-fade">·</span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              tone.dot,
                            )}
                          />
                          {tone.label}
                        </span>
                      </span>
                    }
                    trailing={
                      <>
                        {/* Delivery rate summary */}
                        <div className="hidden flex-col items-end pr-1 text-[11.5px] sm:flex">
                          <div className="font-semibold text-clay-ink">
                            {pct(
                              item.deliveredCount ?? 0,
                              item.contactCount ?? 0,
                            )}
                            %
                          </div>
                          <div className="text-[10.5px] text-clay-ink-muted">
                            {compact(item.deliveredCount ?? 0)} /{' '}
                            {compact(item.contactCount ?? 0)}
                          </div>
                        </div>

                        {/* Stop / Requeue / Report action cluster */}
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
                        <Link
                          href={`/dashboard/broadcasts/${item._id.toString()}`}
                          aria-label="View report"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink transition-colors"
                        >
                          <LuArrowUpRight
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                          />
                        </Link>
                      </>
                    }
                  >
                    {processing ? (
                      <Progress value={progress} className="h-1" />
                    ) : undefined}
                  </ClayListRow>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-clay-border pt-4">
              <span className="text-[11.5px] tabular-nums text-clay-ink-muted">
                Page {currentPage} of {totalPages} · {compact(totalCampaigns)}{' '}
                campaigns
              </span>
              <div className="flex items-center gap-2">
                <ClayButton
                  variant="pill"
                  size="sm"
                  leading={<LuChevronLeft className="h-3 w-3" strokeWidth={2} />}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isRefreshing}
                >
                  Previous
                </ClayButton>
                <ClayButton
                  variant="pill"
                  size="sm"
                  trailing={<LuChevronRight className="h-3 w-3" strokeWidth={2} />}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage >= totalPages || isRefreshing}
                >
                  Next
                </ClayButton>
              </div>
            </div>
          ) : null}
        </ClayCard>
      </div>

      <div className="h-6" />
    </div>
  );
}

/* ── tiny inline KPI tile ───────────────────────────────────────── */

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[14px] border border-clay-border bg-clay-surface p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-clay-ink-muted">
        {label}
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.01em] text-clay-ink leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-clay-ink-muted leading-tight truncate">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
