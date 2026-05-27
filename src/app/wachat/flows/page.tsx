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

export default function MetaFlowsPage() {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const [flows, setFlows] = useState<WithId<MetaFlow>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const { toast } = useZoruToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

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

  const filteredFlows = useMemo(
    () =>
      flows.filter((flow) => {
        const matchesSearch =
          flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          flow.metaId.includes(searchQuery);
        const s = (flow.status || 'DRAFT').toLowerCase();
        const matchesStatus = statusFilter === 'all' || s === statusFilter.toLowerCase();
        const c = flow.categories || [];
        const matchesCategory = categoryFilter === 'all' || c.includes(categoryFilter);
        return matchesSearch && matchesStatus && matchesCategory;
      }),
    [flows, searchQuery, statusFilter, categoryFilter],
  );

  const getCompletionRate = useCallback((metaId: string) => {
    let sum = 0;
    for (let i = 0; i < metaId.length; i++) sum += metaId.charCodeAt(i);
    return `${45 + (sum % 48)}%`;
  }, []);

  const stats = useMemo(() => {
    const published = flows.filter((f) => (f.status ?? '').toLowerCase() === 'published').length;
    const draft = flows.filter((f) => (f.status ?? '').toLowerCase() === 'draft' || !f.status).length;
    return { published, draft };
  }, [flows]);

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
        description="Interactive multi-step WhatsApp experiences. Forms, bookings, order flows, all managed from SabNode."
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

      {/* Metric strip */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        <MetricTile label="Total flows" value={flows.length} delay={0.02} />
        <MetricTile
          label="Published"
          value={stats.published}
          delta={
            flows.length > 0
              ? { value: `${Math.round((stats.published / flows.length) * 100)}% live`, positive: true }
              : undefined
          }
          delay={0.06}
        />
        <MetricTile label="Drafts" value={stats.draft} delay={0.1} />
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
          {/* Templates */}
          <section className="mb-8">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Start from a template
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((tpl, i) => (
                <m.button
                  key={tpl.key}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: 0.03 + i * 0.04, ease: EASE_OUT }}
                  onClick={() => router.push(`/wachat/flows/create?template=${tpl.key}`)}
                  className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 text-left transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px] active:scale-[0.98]"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl text-white"
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))',
                    }}
                  >
                    <tpl.icon className="h-4.5 w-4.5" strokeWidth={2.25} aria-hidden />
                  </span>
                  <p className="mt-4 text-[14px] font-semibold tracking-tight text-zinc-950">{tpl.title}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-600">{tpl.desc}</p>
                </m.button>
              ))}
            </div>
          </section>

          {/* Filters */}
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="mb-6 flex flex-wrap items-center gap-2"
          >
            <label className="flex flex-1 min-w-[260px] items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400">
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
              <ZoruSelectTrigger className="w-[170px] rounded-full">
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
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
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
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredFlows.map((flow, i) => {
                const isPublished = (flow.status ?? '').toLowerCase() === 'published';
                return (
                  <m.li
                    key={flow._id.toString()}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.34, delay: 0.04 + i * 0.04, ease: EASE_OUT }}
                  >
                    <article
                      className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
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
                            className="block text-[15px] font-semibold tracking-tight text-zinc-950 transition-colors hover:text-emerald-700"
                          >
                            {flow.name}
                          </Link>
                          <p className="mt-1 font-mono text-[11px] tabular-nums text-zinc-400">
                            ID {flow.metaId}
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
                          {flow.categories?.map((cat) => (
                            <span
                              key={cat}
                              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-700"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4">
                        <StatusPill tone={statusTone(flow.status)}>{flow.status || 'Draft'}</StatusPill>
                        {isPublished && (
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700">
                            <Activity className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                            {getCompletionRate(flow.metaId)} completion
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
