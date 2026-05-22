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
  } from 'lucide-react';

import { deleteMetaFlow,
  getMetaFlows } from '@/app/actions/meta-flow.actions';
import type { MetaFlow } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { SyncMetaFlowsButton } from '@/components/wabasimplify/sync-meta-flows-button';

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
        (flow) =>
          flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          flow.metaId.includes(searchQuery),
      ),
    [flows, searchQuery],
  );

  const stats = useMemo(() => {
    const published = flows.filter((f) => (f.status ?? '').toLowerCase() === 'published').length;
    const draft = flows.filter((f) => (f.status ?? '').toLowerCase() === 'draft' || !f.status)
      .length;
    return { published, draft };
  }, [flows]);

  return (
    <div className="flex min-h-full flex-col gap-6">
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
            <ZoruBreadcrumbPage>Meta Flows</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Meta Flows</ZoruPageTitle>
            <ZoruPageDescription>
              Interactive multi-step WhatsApp experiences — forms, bookings, order flows — managed
              directly from SabNode.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
        <div className="flex items-center gap-2">
          <SyncMetaFlowsButton projectId={activeProjectId} onSyncComplete={fetchFlows} />
          <ZoruButton variant="outline" onClick={() => router.push('/wachat/flows/docs')}>
            <BookOpen className="h-3.5 w-3.5" />
            API docs
          </ZoruButton>
          <ZoruButton
            onClick={() => router.push('/wachat/flows/create')}
            disabled={!activeProjectId}
          >
            <CirclePlus className="h-3.5 w-3.5" />
            New flow
          </ZoruButton>
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
        <ZoruEmptyState
          icon={<CircleAlert className="h-10 w-10" />}
          title="No project selected"
          description="Please select a project from the main dashboard to manage Meta Flows."
          action={<ZoruButton onClick={() => router.push('/wachat')}>Choose a project</ZoruButton>}
        />
      ) : (
        <ZoruCard className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px] flex-1">
              <ZoruInput
                placeholder="Search flows by name or Meta ID…"
                leadingSlot={<Search />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <ZoruButton variant="outline" size="sm" onClick={fetchFlows} disabled={isLoading}>
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </ZoruButton>
            <span className="ml-auto text-[11.5px] tabular-nums text-zoru-ink-muted">
              {filteredFlows.length} / {flows.length} flows
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line">
            {isLoading && flows.length === 0 ? (
              <div className="p-4">
                <ZoruSkeleton className="h-32 w-full" />
              </div>
            ) : filteredFlows.length === 0 ? (
              <ZoruEmptyState
                icon={<ServerCog className="h-10 w-10" />}
                title={searchQuery ? 'No matching flows' : 'No Meta Flows yet'}
                description={
                  searchQuery
                    ? `Nothing matched "${searchQuery}". Try a different search.`
                    : 'Create a flow to let customers fill out forms, book slots, or order items inside a WhatsApp conversation.'
                }
                action={
                  !searchQuery ? (
                    <ZoruButton size="sm" onClick={() => router.push('/wachat/flows/create')}>
                      <CirclePlus className="h-3.5 w-3.5" />
                      Create your first flow
                    </ZoruButton>
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
                            <ZoruBadge key={cat} variant="ghost">
                              {cat}
                            </ZoruBadge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ZoruBadge variant={statusVariant(flow.status)}>
                          {flow.status || 'Draft'}
                        </ZoruBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ZoruDropdownMenu>
                          <ZoruDropdownMenuTrigger asChild>
                            <ZoruButton variant="ghost" size="icon-sm" aria-label="Open menu">
                              <MoreHorizontal className="h-4 w-4" />
                            </ZoruButton>
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
                        </ZoruDropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </ZoruCard>
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
    <ZoruCard className="p-4">
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
    </ZoruCard>
  );
}
