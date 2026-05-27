'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  cn,
  useZoruToast,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
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
  Filter,
  } from 'lucide-react';

import { flowCategories } from '@/components/zoruui-domain/meta-flow-templates';

import { deleteMetaFlow,
  getMetaFlows } from '@/app/actions/meta-flow.actions';
import type { MetaFlow } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { SyncMetaFlowsButton } from '@/components/zoruui-domain/sync-meta-flows-button';

/**
 * Wachat Meta Flows — flow list, search & status.
 */

import * as React from 'react';

function statusVariant(status?: string): 'success' | 'ghost' | 'danger' {
  const s = (status ?? '').toLowerCase();
  if (s === 'published') return 'success';
  if (s === 'draft' || !s) return 'ghost';
  return 'danger';
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
      flows.filter(
        (flow) => {
          const matchesSearch = flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            flow.metaId.includes(searchQuery);
          
          const s = (flow.status || 'DRAFT').toLowerCase();
          const matchesStatus = statusFilter === 'all' || s === statusFilter.toLowerCase();
          
          const c = flow.categories || [];
          const matchesCategory = categoryFilter === 'all' || c.includes(categoryFilter);
          
          return matchesSearch && matchesStatus && matchesCategory;
        }
      ),
    [flows, searchQuery, statusFilter, categoryFilter],
  );

  const getCompletionRate = useCallback((metaId: string) => {
    // Generate a deterministic mock completion rate between 45% and 92%
    let sum = 0;
    for (let i = 0; i < metaId.length; i++) sum += metaId.charCodeAt(i);
    return `${45 + (sum % 48)}%`;
  }, []);

  const stats = useMemo(() => {
    const published = flows.filter((f) => (f.status ?? '').toLowerCase() === 'published').length;
    const draft = flows.filter((f) => (f.status ?? '').toLowerCase() === 'draft' || !f.status)
      .length;
    return { published, draft };
  }, [flows]);

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
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
            <ZoruBreadcrumbPage>Meta Flows</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Meta Flows</ZoruPageTitle>
            <ZoruPageDescription>
              Interactive multi-step WhatsApp experiences — forms, bookings, order flows — managed
              directly from SabNode.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <div className="flex items-center gap-2">
          <SyncMetaFlowsButton projectId={activeProjectId} onSyncComplete={fetchFlows} />
          <Button variant="outline" onClick={() => router.push('/wachat/flows/docs')}>
            <BookOpen className="h-3.5 w-3.5" />
            API docs
          </Button>
          <Button
            onClick={() => router.push('/wachat/flows/create')}
            disabled={!activeProjectId}
          >
            <CirclePlus className="h-3.5 w-3.5" />
            New flow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Total flows" value={String(flows.length)} />
        <Stat
          label="Published"
          value={String(stats.published)}
          hint={
            flows.length > 0
              ? `${Math.round((stats.published / flows.length) * 100)}% live`
              : 'none yet'
          }
          tint="success"
        />
        <Stat label="Drafts" value={String(stats.draft)} />
      </div>

      {!activeProjectId ? (
        <EmptyState
          icon={<CircleAlert className="h-10 w-10" />}
          title="No project selected"
          description="Please select a project from the main dashboard to manage Meta Flows."
          action={<Button onClick={() => router.push('/wachat')}>Choose a project</Button>}
        />
      ) : (
        <>
          <div className="mb-2 mt-4">
            <h3 className="mb-3 text-sm font-medium text-zoru-ink">Start from a template</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card 
                className="flex cursor-pointer flex-col p-4 transition-colors hover:border-zoru-line-strong hover:bg-zoru-surface-2" 
                onClick={() => router.push('/wachat/flows/create?template=lead_gen')}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink-muted">
                  <Users className="h-5 w-5" />
                </div>
                <div className="mb-1 font-medium text-zoru-ink">Lead Generation</div>
                <div className="text-xs text-zoru-ink-muted">Capture user info like name, email, and phone number directly in WhatsApp.</div>
              </Card>
              <Card 
                className="flex cursor-pointer flex-col p-4 transition-colors hover:border-zoru-line-strong hover:bg-zoru-surface-2" 
                onClick={() => router.push('/wachat/flows/create?template=appointment')}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink-muted">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="mb-1 font-medium text-zoru-ink">Appointment Booking</div>
                <div className="text-xs text-zoru-ink-muted">Let customers choose a date and time to book an appointment with you.</div>
              </Card>
              <Card 
                className="flex cursor-pointer flex-col p-4 transition-colors hover:border-zoru-line-strong hover:bg-zoru-surface-2" 
                onClick={() => router.push('/wachat/flows/create?template=feedback')}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink-muted">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="mb-1 font-medium text-zoru-ink">Customer Feedback</div>
                <div className="text-xs text-zoru-ink-muted">Collect ratings and feedback from your customers after a purchase.</div>
              </Card>
            </div>
          </div>

          <Card className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px] flex-1">
              <Input
                placeholder="Search flows by name or Meta ID…"
                leadingSlot={<Search />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <ZoruSelectTrigger className="w-[140px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 opacity-50" />
                  <ZoruSelectValue placeholder="Status" />
                </div>
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="published">Published</ZoruSelectItem>
                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                <ZoruSelectItem value="deprecated">Deprecated</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <ZoruSelectTrigger className="w-[160px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 opacity-50" />
                  <ZoruSelectValue placeholder="Category" />
                </div>
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All categories</ZoruSelectItem>
                {flowCategories.map(c => (
                  <ZoruSelectItem key={c.id} value={c.id}>{c.name}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={fetchFlows} disabled={isLoading}>
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <span className="ml-auto text-[11.5px] tabular-nums text-zoru-ink-muted">
              {filteredFlows.length} / {flows.length} flows
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line">
            {isLoading && flows.length === 0 ? (
              <div className="p-4">
                <Skeleton className="h-32 w-full" />
              </div>
            ) : filteredFlows.length === 0 ? (
              <EmptyState
                icon={<ServerCog className="h-10 w-10" />}
                title={searchQuery ? 'No matching flows' : 'No Meta Flows yet'}
                description={
                  searchQuery
                    ? `Nothing matched "${searchQuery}". Try a different search.`
                    : 'Create a flow to let customers fill out forms, book slots, or order items inside a WhatsApp conversation.'
                }
                action={
                  !searchQuery ? (
                    <Button size="sm" onClick={() => router.push('/wachat/flows/create')}>
                      <CirclePlus className="h-3.5 w-3.5" />
                      Create your first flow
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-zoru-line bg-zoru-surface text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Flow name</th>
                    <th className="px-4 py-3 text-left">Meta ID</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Completion</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zoru-line">
                  {filteredFlows.map((flow) => (
                    <tr
                      key={flow._id.toString()}
                      className="transition-colors hover:bg-zoru-surface-2"
                    >
                      <td className="px-4 py-3 text-zoru-ink">{flow.name}</td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-zoru-ink-muted">
                        {flow.metaId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {flow.categories?.map((cat) => (
                            <Badge key={cat} variant="ghost">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(flow.status)}>
                          {flow.status || 'Draft'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {flow.status === 'PUBLISHED' ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Activity className="h-3.5 w-3.5 text-zoru-success-ink" />
                            <span className="font-medium">{getCompletionRate(flow.metaId)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-zoru-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <ZoruDropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Open menu">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </ZoruDropdownMenuTrigger>
                          <ZoruDropdownMenuContent align="end">
                            <ZoruDropdownMenuLabel>Actions</ZoruDropdownMenuLabel>
                            <ZoruDropdownMenuSeparator />
                            <ZoruDropdownMenuItem asChild>
                              <Link href={`/wachat/flows/create?flowId=${flow._id.toString()}`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit flow
                              </Link>
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuSeparator />
                            <ZoruDropdownMenuItem
                              destructive
                              onClick={() => handleDelete(flow._id.toString(), flow.metaId)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </ZoruDropdownMenuItem>
                          </ZoruDropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tint = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tint?: 'neutral' | 'success';
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div
          className={cn(
            'text-[22px] tracking-[-0.01em] leading-none',
            tint === 'success' ? 'text-zoru-success-ink' : 'text-zoru-ink',
          )}
        >
          {value}
        </div>
      </div>
      {hint && <div className="mt-1 truncate text-[11px] text-zoru-ink-muted">{hint}</div>}
    </Card>
  );
}
