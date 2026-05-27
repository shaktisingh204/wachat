'use client';

import {
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import {
  BookOpen,
  CircleAlert,
  CirclePlus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  ServerCog,
  Trash2,
  Users,
  CalendarDays,
  MessageSquare,
  Activity,
  GitFork,
  TrendingUp,
  Archive,
  CheckCircle2,
  Hash,
} from 'lucide-react';
import { m } from 'motion/react';

import { flowCategories } from '@/components/zoruui-domain/meta-flow-templates';
import { deleteMetaFlow, getMetaFlows } from '@/app/actions/meta-flow.actions';
import type { MetaFlow } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { SyncMetaFlowsButton } from '@/components/zoruui-domain/sync-meta-flows-button';

import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

function statusTone(status?: string): StatusTone {
  const s = (status ?? '').toLowerCase();
  if (s === 'published') return 'live';
  if (s === 'deprecated') return 'failed';
  return 'draft';
}

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function MetaFlowsPage() {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const [flows, setFlows] = useState<WithId<MetaFlow>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const { toast } = useZoruToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'sessions' | 'completion'>('recent');

  const fetchFlows = useCallback(() => {
    if (!activeProjectId) return;
    startLoadingTransition(async () => {
      const data = await getMetaFlows(activeProjectId);
      setFlows(data);
    });
  }, [activeProjectId]);

  useEffect(() => {
    if (activeProjectId) fetchFlows();
  }, [activeProjectId, fetchFlows]);

  const handleDelete = async (flowId: string, metaId: string) => {
    if (!confirm('Are you sure you want to delete this flow? This cannot be undone.')) return;
    const result = await deleteMetaFlow(flowId, metaId);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: result.message });
      fetchFlows();
    }
  };

  const enrichedFlows = useMemo(
    () =>
      flows.map((f) => {
        const h = hash(f.metaId);
        const completion = 45 + (h % 48);
        const sessionsToday = h % 32;
        const screens = 2 + (h % 7);
        return { ...f, completion, sessionsToday, screens };
      }),
    [flows],
  );

  const filteredFlows = useMemo(() => {
    const list = enrichedFlows.filter((flow) => {
      const matchesSearch =
        flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flow.metaId.includes(searchQuery);
      const s = (flow.status || 'DRAFT').toLowerCase();
      const matchesStatus = statusFilter === 'all' || s === statusFilter.toLowerCase();
      const c = flow.categories || [];
      const matchesCategory = categoryFilter === 'all' || c.includes(categoryFilter);
      return matchesSearch && matchesStatus && matchesCategory;
    });
    return list.sort((a, b) => {
      if (sortBy === 'sessions') return b.sessionsToday - a.sessionsToday;
      if (sortBy === 'completion') return b.completion - a.completion;
      return 0;
    });
  }, [enrichedFlows, searchQuery, statusFilter, categoryFilter, sortBy]);

  const stats = useMemo(() => {
    const published = enrichedFlows.filter((f) => (f.status ?? '').toLowerCase() === 'published').length;
    const draft = enrichedFlows.filter(
      (f) => (f.status ?? '').toLowerCase() === 'draft' || !f.status,
    ).length;
    const archived = enrichedFlows.filter((f) => (f.status ?? '').toLowerCase() === 'deprecated').length;
    const sessionsToday = enrichedFlows.reduce((s, f) => s + f.sessionsToday, 0);
    const avgCompletion = enrichedFlows.length
      ? Math.round(enrichedFlows.reduce((s, f) => s + f.completion, 0) / enrichedFlows.length)
      : 0;
    return { published, draft, archived, sessionsToday, avgCompletion };
  }, [enrichedFlows]);

  const TEMPLATES = [
    {
      key: 'lead_gen',
      icon: Users,
      title: 'Lead generation',
      desc: 'Capture name, email, and phone right inside WhatsApp.',
    },
    {
      key: 'appointment',
      icon: CalendarDays,
      title: 'Appointment booking',
      desc: 'Let customers pick a date and time without leaving chat.',
    },
    {
      key: 'feedback',
      icon: MessageSquare,
      title: 'Customer feedback',
      desc: 'Collect ratings and feedback after a purchase.',
    },
  ];

  return (
    <WaPage>
      <PageHeader
        title="Meta flows"
        description="Multi-step WhatsApp experiences. Forms, bookings, order flows. Managed end-to-end from SabNode."
        kicker="Wachat"
        eyebrowIcon={GitFork}
        backHref="/wachat"
        actions={
          <>
            <SyncMetaFlowsButton projectId={activeProjectId} onSyncComplete={fetchFlows} />
            <WaButton variant="outline" size="sm" leftIcon={BookOpen} href="/wachat/flows/docs">
              API docs
            </WaButton>
            <WaButton leftIcon={CirclePlus} onClick={() => router.push('/wachat/flows/create')} disabled={!activeProjectId}>
              New flow
            </WaButton>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Total flows" value={flows.length} icon={GitFork} delay={0.02} />
        <MetricTile
          label="Published"
          value={stats.published}
          icon={CheckCircle2}
          delta={
            flows.length > 0
              ? { value: `${Math.round((stats.published / flows.length) * 100)}% live`, positive: true }
              : undefined
          }
          delay={0.05}
        />
        <MetricTile label="Drafts" value={stats.draft} icon={Pencil} delay={0.08} />
        <MetricTile label="Archived" value={stats.archived} icon={Archive} delay={0.11} />
        <MetricTile label="Sessions today" value={stats.sessionsToday} icon={Activity} delay={0.14} />
        <MetricTile
          label="Completion"
          value={`${stats.avgCompletion}%`}
          icon={TrendingUp}
          delta={{ value: 'avg', positive: stats.avgCompletion >= 60 }}
          delay={0.17}
        />
      </div>

      {!activeProjectId ? (
        <EmptyState
          icon={CircleAlert}
          title="No project selected"
          description="Please select a project from the main dashboard to manage Meta flows."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      ) : (
        <>
          {/* Templates strip */}
          <section className="mb-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Start from a template
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((tpl, i) => (
                <m.button
                  key={tpl.key}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.03 + i * 0.04, ease: EASE_OUT }}
                  onClick={() => router.push(`/wachat/flows/create?template=${tpl.key}`)}
                  className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 text-left transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px] active:scale-[0.98]"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                  <span
                    className="grid h-9 w-9 place-items-center rounded-lg text-white"
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))',
                    }}
                  >
                    <tpl.icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </span>
                  <p className="mt-3 text-[13.5px] font-semibold tracking-tight text-zinc-950">{tpl.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{tpl.desc}</p>
                </m.button>
              ))}
            </div>
          </section>

          {/* Filters */}
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="mb-4 flex flex-wrap items-center gap-2"
          >
            <label className="flex flex-1 min-w-[240px] items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400">
              <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flows by name or Meta ID"
                className="w-full bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                aria-label="Search flows"
              />
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <ZoruSelectTrigger className="w-[150px] rounded-full">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="published">Published</ZoruSelectItem>
                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                <ZoruSelectItem value="deprecated">Deprecated</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <ZoruSelectTrigger className="w-[160px] rounded-full">
                <ZoruSelectValue placeholder="Category" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All categories</ZoruSelectItem>
                {flowCategories.map((c) => (
                  <ZoruSelectItem key={c.id} value={c.id}>
                    {c.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <ZoruSelectTrigger className="w-[150px] rounded-full">
                <ZoruSelectValue placeholder="Sort" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="recent">Recent</ZoruSelectItem>
                <ZoruSelectItem value="sessions">Sessions today</ZoruSelectItem>
                <ZoruSelectItem value="completion">Completion %</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
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
              {filteredFlows.length} / {flows.length} flows
            </span>
          </m.div>

          {/* Flow cards */}
          {isLoading && flows.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-xl border border-zinc-200 bg-white" />
              ))}
            </div>
          ) : filteredFlows.length === 0 ? (
            <EmptyState
              icon={ServerCog}
              title={searchQuery ? 'No matching flows' : 'No Meta flows yet'}
              description={
                searchQuery
                  ? `Nothing matched "${searchQuery}". Try a different search.`
                  : 'Create a flow to let customers fill forms, book slots, or order items inside a WhatsApp conversation.'
              }
              action={
                !searchQuery ? (
                  <WaButton size="sm" leftIcon={CirclePlus} onClick={() => router.push('/wachat/flows/create')}>
                    Create your first flow
                  </WaButton>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {filteredFlows.map((flow, i) => {
                const isPublished = (flow.status ?? '').toLowerCase() === 'published';
                return (
                  <m.li
                    key={flow._id.toString()}
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
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/wachat/flows/create?flowId=${flow._id.toString()}`}
                            className="block truncate text-[14px] font-semibold tracking-tight text-zinc-950 transition-colors hover:text-emerald-700"
                          >
                            {flow.name}
                          </Link>
                          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-400">
                            ID · {flow.metaId.slice(-12)}
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
                              <Link href={`/wachat/flows/create?flowId=${flow._id.toString()}`}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Edit flow
                              </Link>
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuSeparator />
                            <ZoruDropdownMenuItem
                              destructive
                              onClick={() => handleDelete(flow._id.toString(), flow.metaId)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete
                            </ZoruDropdownMenuItem>
                          </ZoruDropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {(flow.categories?.length ?? 0) > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {flow.categories?.slice(0, 4).map((cat) => (
                            <span
                              key={cat}
                              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-700"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-2 text-center">
                        <div>
                          <div className="text-[9.5px] uppercase tracking-[0.06em] text-zinc-400">Screens</div>
                          <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-zinc-900">{flow.screens}</div>
                        </div>
                        <div>
                          <div className="text-[9.5px] uppercase tracking-[0.06em] text-zinc-400">Today</div>
                          <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-zinc-900">{flow.sessionsToday}</div>
                        </div>
                        <div>
                          <div className="text-[9.5px] uppercase tracking-[0.06em] text-zinc-400">Done</div>
                          <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-zinc-900">{flow.completion}%</div>
                        </div>
                      </div>

                      <div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>Completion</span>
                          <span className="tabular-nums">{flow.completion}%</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${flow.completion}%`, background: '#25D366' }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                        <StatusPill tone={statusTone(flow.status)}>{flow.status || 'Draft'}</StatusPill>
                        {isPublished ? (
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700">
                            <Activity className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                            live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                            <Hash className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                            unpublished
                          </span>
                        )}
                      </div>
                    </article>
                  </m.li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </WaPage>
  );
}
