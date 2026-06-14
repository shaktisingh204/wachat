'use client';

import {
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  IconButton,
  Card,
  Menu,
  MenuItem,
  MenuSeparator,
  EmptyState,
  Input,
  Progress,
  SelectField as Select,
  SegmentedControl,
  StatCard,
  Skeleton,
  Spinner,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
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
  Plus,
  RefreshCw,
  Search,
  Users,
  } from 'lucide-react';

import { getTemplates,
  handleStopBroadcast } from '@/app/actions/index.ts';
import { handleSyncTemplates } from '@/app/actions/template.actions';
import { getMetaFlows } from '@/app/actions/meta-flow.actions';
import { getBroadcasts } from '@/app/actions/broadcast.actions';
import type { Template,
  MetaFlow } from '@/lib/definitions';

import { useProject } from '@/context/project-context';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { BroadcastForm } from '@/app/wachat/_components/broadcast-form';
import { RequeueBroadcastDialog } from '@/app/wachat/_components/requeue-broadcast-dialog';
import { SchedulerView } from '@/app/wachat/_components/scheduler-view';
import { BulkActionsWrapper } from '@/app/wachat/_components/bulk-actions-wrapper';

/**
 * Wachat Broadcasts — campaign list, 20ui rebuild.
 *
 * Same data + handlers as before (getBroadcasts, getTemplates,
 * handleSyncTemplates, handleStopBroadcast, RequeueBroadcastDialog).
 * Visual layer fully on 20ui primitives — neutral palette, no rainbow.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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

type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

function statusTone(status: string | undefined): {
  label: string;
  tone: StatusTone;
} {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return { label: 'Completed', tone: 'success' };
  if (s === 'processing' || s === 'pending_processing')
    return { label: 'Processing', tone: 'info' };
  if (s === 'queued') return { label: 'Queued', tone: 'warning' };
  if (s === 'partial failure') return { label: 'Partial', tone: 'warning' };
  if (s === 'failed') return { label: 'Failed', tone: 'danger' };
  if (s === 'cancelled') return { label: 'Cancelled', tone: 'neutral' };
  return { label: status || 'Unknown', tone: 'neutral' };
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
          tone: 'danger',
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
        <IconButton
          variant="ghost"
          size="sm"
          label="Stop broadcast"
          icon={CircleStop}
          className="text-[var(--st-danger)]"
        />
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
            {isStopping ? 'Stopping...' : 'Stop broadcast'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
    <Button variant="outline" size="sm" iconLeft={Clock} disabled>
      {ist} IST
    </Button>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function BroadcastPage() {
  const router = useRouter();
  const { activeProject, activeProjectId } = useProject();
  const [view, setView] = useState<'history' | 'schedule' | 'bulk'>('history');
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
            tone: 'danger',
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
        tone: 'danger',
      });
      return;
    }
    startTemplatesSyncTransition(async () => {
      const result = await handleSyncTemplates(activeProjectId);
      if (result.error) {
        toast({
          title: 'Sync failed',
          description: result.error,
          tone: 'danger',
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Campaigns' },
      ]}
      title="Campaigns"
      description="Ship a WhatsApp template to a segmented list of contacts — upload a CSV, pick a tag, or reuse a previous audience."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ISTClock />
          <Button
            variant="outline"
            size="sm"
            iconLeft={BookCopy}
            onClick={onSyncTemplates}
            disabled={!activeProjectId || isSyncingTemplates}
          >
            {isSyncingTemplates ? 'Syncing...' : 'Sync templates'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={() =>
              activeProjectId && fetchData(activeProjectId, currentPage, true)
            }
            disabled={!activeProjectId || isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <SegmentedControl
          aria-label="Broadcast view"
          value={view}
          onChange={(v) => setView(v as 'history' | 'schedule' | 'bulk')}
          items={[
            { value: 'history', label: 'Live Campaigns' },
            { value: 'schedule', label: 'Scheduler' },
            { value: 'bulk', label: 'Bulk Import' },
          ]}
        />

        {view === 'history' && (
          <>
            {/* ── Stats strip ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="All-time campaigns"
                value={compact(totalCampaigns)}
                delta={{ value: 'across this project', tone: 'neutral' }}
              />
              <StatCard
                label="Messages sent"
                value={compact(stats.totalSent)}
                delta={{ value: 'sum of this page', tone: 'neutral' }}
              />
              <StatCard
                label="Delivery rate"
                value={`${stats.deliveryRate}%`}
                delta={{
                  value: `${compact(stats.totalDelivered)} delivered`,
                  tone: 'neutral',
                }}
              />
              <StatCard
                label="Live now"
                value={String(stats.processing)}
                delta={{
                  value:
                    stats.processing > 0
                      ? 'polling every 15s'
                      : 'nothing running',
                  tone: 'neutral',
                }}
              />
            </div>

            {/* ── New campaign form ── */}
            <section>
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-[22px] leading-none tracking-tight text-[var(--st-text)]">
                    New campaign
                  </h2>
                  <p className="mt-1.5 text-[12.5px] text-[var(--st-text-secondary)]">
                    Choose a template or flow, upload your audience, and queue
                    the broadcast.
                  </p>
                </div>
              </div>
              <Card className="mt-5" padding="lg">
                {isRefreshing && !activeProject ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <BroadcastForm
                    templates={templates}
                    metaFlows={metaFlows}
                    onSuccess={onBroadcastSuccess}
                  />
                )}
              </Card>
            </section>

            {/* ── Broadcast history ── */}
            <section>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[22px] leading-none tracking-tight text-[var(--st-text)]">
                    Broadcast history
                  </h2>
                  <p className="mt-1.5 text-[12.5px] text-[var(--st-text-secondary)]">
                    A log of every broadcast campaign for{' '}
                    {activeProject?.name || 'this project'}.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <IconButton
                    variant="outline"
                    size="sm"
                    label="New campaign"
                    icon={Plus}
                    onClick={() => {
                      const el = document.querySelector('h2');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                  <Menu
                    align="end"
                    label="Broadcast actions"
                    trigger={
                      <IconButton
                        variant="outline"
                        size="sm"
                        label="More"
                        icon={Ellipsis}
                      />
                    }
                  >
                    <MenuItem
                      icon={RefreshCw}
                      onSelect={() =>
                        activeProjectId &&
                        fetchData(activeProjectId, currentPage, true)
                      }
                    >
                      Refresh list
                    </MenuItem>
                    <MenuItem
                      icon={BookCopy}
                      onSelect={() => router.push('/wachat/templates')}
                    >
                      Manage templates
                    </MenuItem>
                    <MenuItem
                      icon={Users}
                      onSelect={() => router.push('/wachat/contacts')}
                    >
                      Manage contacts
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      icon={ArrowUpRight}
                      onSelect={() => router.push('/wachat/analytics')}
                    >
                      Open analytics
                    </MenuItem>
                  </Menu>
                </div>
              </div>

              <Card className="mt-5" padding="lg">
                {/* ── Filter bar ── */}
                {hasLoaded && history.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--st-border)] pb-4">
                    <div className="min-w-[240px] flex-1">
                      <Input
                        type="text"
                        iconLeft={Search}
                        aria-label="Search broadcasts"
                        placeholder="Search by name or template..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select
                      aria-label="Status filter"
                      value={statusFilter}
                      onChange={(v) => setStatusFilter(v ?? 'all')}
                      className="w-[200px]"
                      placeholder="Status"
                      options={[
                        { value: 'all', label: 'All statuses' },
                        { value: 'live', label: 'Live (queued/processing)' },
                        { value: 'completed', label: 'Completed' },
                        { value: 'failed', label: 'Failed / cancelled' },
                      ]}
                    />
                    {(searchQuery || statusFilter !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                        }}
                      >
                        Clear
                      </Button>
                    )}
                    <span className="ml-auto text-[11px] tabular-nums text-[var(--st-text-secondary)]">
                      {filteredHistory.length} of {history.length}
                    </span>
                  </div>
                )}

                {!hasLoaded && isRefreshing ? (
                  <div className="flex h-24 items-center justify-center">
                    <Spinner label="Loading broadcasts" />
                  </div>
                ) : !activeProjectId ? (
                  <EmptyState
                    icon={CircleAlert}
                    title="No project selected"
                    description="Please select a project from the main dashboard to view its broadcast history."
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => router.push('/wachat')}
                      >
                        Choose a project
                      </Button>
                    }
                  />
                ) : history.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No broadcasts yet"
                    description="Use the composer above to send your first WhatsApp broadcast -- it'll appear here with live delivery and read analytics."
                  />
                ) : filteredHistory.length === 0 ? (
                  <EmptyState
                    icon={Search}
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
                        <Card
                          key={item._id.toString()}
                          variant="outlined"
                          padding="sm"
                          className="transition-colors"
                        >
                          <div className="flex items-start gap-3 p-2">
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[11px] tabular-nums text-[var(--st-text-secondary)]">
                              {index}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm text-[var(--st-text)]">
                                  {item.name ||
                                    item.templateName ||
                                    item.fileName ||
                                    'Untitled'}
                                </p>
                                <Badge tone={tone.tone} dot>
                                  {tone.label}
                                </Badge>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
                                {item.templateName ? (
                                  <span className="text-[var(--st-text)]">
                                    {item.templateName}
                                  </span>
                                ) : null}
                                {item.templateName ? (
                                  <span className="text-[var(--st-text-tertiary)]">
                                    ·
                                  </span>
                                ) : null}
                                <span>
                                  {date
                                    ? formatDistanceToNow(date, {
                                        addSuffix: true,
                                      })
                                    : '--'}
                                </span>
                                <span className="text-[var(--st-text-tertiary)]">
                                  ·
                                </span>
                                <span>
                                  {(item.contactCount ?? 0).toLocaleString()}{' '}
                                  contacts
                                </span>
                              </div>
                            </div>
                            <div className="hidden flex-col items-end pr-1 text-[11.5px] sm:flex">
                              <div className="text-[var(--st-text)]">
                                {pct(
                                  item.deliveredCount ?? 0,
                                  item.contactCount ?? 0,
                                )}
                                %
                              </div>
                              <div className="text-[10.5px] text-[var(--st-text-secondary)]">
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
                              <Link
                                href={`/wachat/broadcasts/${item._id.toString()}`}
                                className="u-btn u-icon-btn u-btn--ghost u-icon-btn--sm"
                                aria-label="View report"
                                title="View report"
                              >
                                <ArrowUpRight size={14} aria-hidden="true" />
                              </Link>
                            </div>
                          </div>
                          {processing ? (
                            <Progress value={progress} size="sm" className="mt-3" />
                          ) : null}
                        </Card>
                      );
                    })}
                  </div>
                )}

                {totalPages > 1 ? (
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--st-border)] pt-4">
                    <span className="text-[11.5px] tabular-nums text-[var(--st-text-secondary)]">
                      Page {currentPage} of {totalPages} ·{' '}
                      {compact(totalCampaigns)} campaigns
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        iconLeft={ChevronLeft}
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage <= 1 || isRefreshing}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        iconRight={ChevronRight}
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage >= totalPages || isRefreshing}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </section>
          </>
        )}

        {view === 'schedule' && <SchedulerView />}

        {view === 'bulk' && <BulkActionsWrapper />}
      </div>
    </WachatPage>
  );
}
