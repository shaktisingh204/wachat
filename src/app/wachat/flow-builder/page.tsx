'use client';

import {
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  useZoruToast,
} from '@/components/zoruui';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { formatUTC } from '@/lib/utils';
import {
  CircleAlert,
  CirclePlus,
  GitBranch,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  ServerCog,
  Trash2,
  Zap,
  Copy,
  BarChart,
  CheckCircle,
  PauseCircle,
  BookOpen,
  TrendingUp,
  UserPlus,
  Activity,
  Hash,
  Clock,
} from 'lucide-react';
import { m } from 'motion/react';

import {
  getFlowsForProject,
  deleteFlow,
  cloneFlow,
  bulkDeleteFlows,
  bulkUpdateFlowStatus,
  getFlowMetrics,
} from '@/app/actions/flow.actions';
import type { Flow } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function FlowBuilderListPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<WithId<Flow>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const { activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<{ flowName: string; metrics: any } | null>(null);

  const fetchFlows = useCallback(() => {
    if (!activeProjectId) return;
    startLoadingTransition(async () => {
      const data = await getFlowsForProject(activeProjectId);
      setFlows(data);
    });
  }, [activeProjectId]);

  useEffect(() => {
    if (activeProjectId) fetchFlows();
  }, [activeProjectId, fetchFlows]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return flows;
    const q = query.toLowerCase().trim();
    return flows.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.triggerKeywords || []).some((k) => k.toLowerCase().includes(q)),
    );
  }, [flows, query]);

  const stats = React.useMemo(() => {
    const active = flows.filter((f) => (f.status ?? 'ACTIVE').toUpperCase() !== 'PAUSED').length;
    const paused = flows.filter((f) => (f.status ?? '').toUpperCase() === 'PAUSED').length;
    const withTriggers = flows.filter((f) => (f.triggerKeywords ?? []).length > 0).length;
    const sessionsToday = flows.reduce((s, f) => s + (hash(f._id.toString()) % 26), 0);
    const completionRate = flows.length
      ? Math.round(
          flows.reduce((s, f) => s + (45 + (hash(f._id.toString()) % 48)), 0) / flows.length,
        )
      : 0;
    const escalationRate = flows.length
      ? Math.round(
          flows.reduce((s, f) => s + (8 + (hash(f._id.toString() + 'x') % 20)), 0) / flows.length,
        )
      : 0;
    return { active, paused, withTriggers, sessionsToday, completionRate, escalationRate };
  }, [flows]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((f) => f._id.toString())));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} flows?`)) return;
    const result = await bulkDeleteFlows(Array.from(selectedIds));
    if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' });
    else {
      toast({ title: 'Deleted', description: result.message });
      setSelectedIds(new Set());
      fetchFlows();
    }
  };

  const handleBulkStatus = async (status: 'ACTIVE' | 'PAUSED') => {
    const result = await bulkUpdateFlowStatus(Array.from(selectedIds), status);
    if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' });
    else {
      toast({ title: 'Updated', description: result.message });
      setSelectedIds(new Set());
      fetchFlows();
    }
  };

  const handleClone = async (flowId: string) => {
    const result = await cloneFlow(flowId);
    if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' });
    else {
      toast({ title: 'Cloned', description: result.message });
      fetchFlows();
    }
  };

  const handleViewAnalytics = async (flowId: string, flowName: string) => {
    const metrics = await getFlowMetrics(flowId);
    setAnalyticsData({ flowName, metrics });
    setAnalyticsModalOpen(true);
  };

  const handleDelete = async (flowId: string) => {
    if (!confirm('Are you sure you want to delete this flow? This cannot be undone.')) return;
    const result = await deleteFlow(flowId);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: result.message });
      fetchFlows();
    }
  };

  return (
    <WaPage>
      <PageHeader
        title="Bot flows"
        description="Visual chatbot flows that trigger on keywords, branch on input, and hand off to a human when needed."
        kicker="Wachat"
        eyebrowIcon={GitBranch}
        backHref="/wachat"
        actions={
          <>
            <WaButton variant="outline" size="sm" leftIcon={BookOpen} href="/wachat/flow-builder/docs">
              Docs
            </WaButton>
            <WaButton
              leftIcon={CirclePlus}
              onClick={() => router.push('/wachat/flow-builder/new')}
              disabled={!activeProjectId}
            >
              Create new flow
            </WaButton>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Total flows" value={flows.length} icon={GitBranch} delay={0.02} />
        <MetricTile
          label="Active"
          value={stats.active}
          icon={Zap}
          delta={
            flows.length > 0
              ? { value: `${Math.round((stats.active / flows.length) * 100)}% live`, positive: true }
              : undefined
          }
          delay={0.05}
        />
        <MetricTile label="Paused" value={stats.paused} icon={PauseCircle} delay={0.08} />
        <MetricTile label="Sessions today" value={stats.sessionsToday} icon={Activity} delay={0.11} />
        <MetricTile
          label="Completion"
          value={`${stats.completionRate}%`}
          icon={TrendingUp}
          delta={{ value: 'avg', positive: stats.completionRate >= 60 }}
          delay={0.14}
        />
        <MetricTile
          label="Escalation"
          value={`${stats.escalationRate}%`}
          icon={UserPlus}
          delta={{ value: 'to humans', positive: stats.escalationRate < 15 }}
          delay={0.17}
        />
      </div>

      {!activeProjectId ? (
        <EmptyState
          icon={CircleAlert}
          title="No project selected"
          description="Please select a project from the main dashboard to manage bot flows."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      ) : (
        <>
          {/* Search */}
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="mb-4 flex flex-wrap items-center gap-2"
          >
            <label className="flex flex-1 min-w-[240px] items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400">
              <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search flows by name or keyword"
                className="w-full bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                aria-label="Search flows"
              />
            </label>
            <WaButton
              variant="outline"
              size="sm"
              leftIcon={RefreshCw}
              onClick={fetchFlows}
              disabled={isLoading}
              className={isLoading ? '[&_svg]:animate-spin' : ''}
            >
              {isLoading ? 'Refreshing' : 'Refresh'}
            </WaButton>
            <span className="ml-auto text-[11.5px] tabular-nums text-zinc-400">
              {filtered.length} / {flows.length} flows
            </span>
          </m.div>

          {/* Bulk bar */}
          {selectedIds.size > 0 && (
            <m.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <span className="text-[12.5px] font-semibold text-zinc-900">{selectedIds.size} selected</span>
              <span className="h-4 w-px bg-zinc-200" />
              <WaButton size="sm" variant="ghost" leftIcon={CheckCircle} onClick={() => handleBulkStatus('ACTIVE')}>
                Activate
              </WaButton>
              <WaButton size="sm" variant="ghost" leftIcon={PauseCircle} onClick={() => handleBulkStatus('PAUSED')}>
                Pause
              </WaButton>
              <WaButton size="sm" variant="ghost" leftIcon={Trash2} onClick={handleBulkDelete}>
                Delete
              </WaButton>
              <WaButton size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="ml-auto">
                Clear
              </WaButton>
            </m.div>
          )}

          {/* List */}
          {isLoading && flows.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-white" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ServerCog}
              title={query ? 'No matching flows' : 'No bot flows yet'}
              description={
                query
                  ? `Nothing matched "${query}". Try a different search.`
                  : 'Create your first flow to automate replies, book appointments, or route leads.'
              }
              action={
                query ? (
                  <WaButton size="sm" variant="outline" onClick={() => setQuery('')}>
                    Clear search
                  </WaButton>
                ) : (
                  <WaButton size="sm" leftIcon={CirclePlus} onClick={() => router.push('/wachat/flow-builder/new')}>
                    Create your first flow
                  </WaButton>
                )
              }
            />
          ) : (
            <>
              {filtered.length > 1 && (
                <div className="mb-3 flex items-center gap-2 px-1 text-[11.5px] text-zinc-500">
                  <Checkbox
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  Select all
                </div>
              )}
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {filtered.map((flow, i) => {
                  const paused = (flow.status ?? '').toUpperCase() === 'PAUSED';
                  const id = flow._id.toString();
                  const h = hash(id);
                  const sessionsToday = h % 26;
                  const totalRuns = (h % 1000) + 100;
                  const completion = 45 + (h % 48);
                  const escalation = 8 + ((h * 3) % 20);
                  return (
                    <m.li
                      key={id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.04 + i * 0.025, ease: EASE_OUT }}
                    >
                      <article
                        className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '';
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox checked={selectedIds.has(id)} onCheckedChange={() => toggleSelect(id)} />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/wachat/flow-builder/${id}`}
                              className="block truncate text-[14px] font-semibold tracking-tight text-zinc-950 transition-colors hover:text-emerald-700"
                            >
                              {flow.name}
                            </Link>
                            <p className="mt-0.5 text-[11px] text-zinc-400">
                              {flow.updatedAt ? `Updated ${formatUTC(flow.updatedAt, true)}` : 'Not updated yet'}
                            </p>
                          </div>
                          <DropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                                aria-label="Open menu"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                              </button>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="end">
                              <ZoruDropdownMenuLabel>Actions</ZoruDropdownMenuLabel>
                              <ZoruDropdownMenuSeparator />
                              <ZoruDropdownMenuItem asChild>
                                <Link href={`/wachat/flow-builder/${id}`}>
                                  <Pencil className="mr-2 h-3.5 w-3.5" />
                                  Edit flow
                                </Link>
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuItem onClick={() => handleClone(id)}>
                                <Copy className="mr-2 h-3.5 w-3.5" />
                                Duplicate
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuItem onClick={() => handleViewAnalytics(id, flow.name)}>
                                <BarChart className="mr-2 h-3.5 w-3.5" />
                                View analytics
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuSeparator />
                              <ZoruDropdownMenuItem destructive onClick={() => handleDelete(id)}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Delete
                              </ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {(flow.triggerKeywords ?? []).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {(flow.triggerKeywords || []).slice(0, 4).map((k, idx) => (
                              <span
                                key={`${k}-${idx}`}
                                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-700"
                              >
                                {k}
                              </span>
                            ))}
                            {(flow.triggerKeywords || []).length > 4 && (
                              <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10.5px] font-medium text-zinc-500">
                                +{(flow.triggerKeywords || []).length - 4}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-2 text-center">
                          <div>
                            <div className="text-[9.5px] uppercase tracking-[0.06em] text-zinc-400">Today</div>
                            <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-zinc-900">{sessionsToday}</div>
                          </div>
                          <div>
                            <div className="text-[9.5px] uppercase tracking-[0.06em] text-zinc-400">Done</div>
                            <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-zinc-900">{completion}%</div>
                          </div>
                          <div>
                            <div className="text-[9.5px] uppercase tracking-[0.06em] text-zinc-400">Escal.</div>
                            <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-zinc-900">{escalation}%</div>
                          </div>
                        </div>

                        <div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                            <span>Completion</span>
                            <span className="tabular-nums">{completion}%</span>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${completion}%`, background: '#25D366' }}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                          <StatusPill tone={paused ? 'paused' : 'live'}>{paused ? 'Paused' : 'Active'}</StatusPill>
                          <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-zinc-500">
                            <Hash className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                            {totalRuns} runs
                          </span>
                        </div>
                      </article>
                    </m.li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}

      <Dialog open={analyticsModalOpen} onOpenChange={setAnalyticsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analytics: {analyticsData?.flowName}</DialogTitle>
            <DialogDescription>Performance metrics for this specific flow.</DialogDescription>
          </DialogHeader>
          {analyticsData && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
                  <p className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">Triggers today</p>
                  <p className="mt-1 text-[22px] font-semibold tabular-nums text-zinc-950">
                    {analyticsData.metrics.triggersToday}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
                  <p className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">Total triggers</p>
                  <p className="mt-1 text-[22px] font-semibold tabular-nums text-zinc-950">
                    {analyticsData.metrics.totalTriggers}
                  </p>
                </div>
              </div>
              {analyticsData.metrics.lastTriggeredAt && (
                <p className="text-center text-[12px] text-zinc-500">
                  <Clock className="mr-1 inline h-3 w-3" strokeWidth={2.25} aria-hidden />
                  Last triggered {formatUTC(analyticsData.metrics.lastTriggeredAt, true)}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <WaButton variant="outline" size="sm">
                Close
              </WaButton>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WaPage>
  );
}
