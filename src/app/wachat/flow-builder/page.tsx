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
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { format } from 'date-fns';
import {
  CircleAlert,
  CirclePause,
  CirclePlus,
  GitBranch,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  ServerCog,
  Trash2,
  Zap,
  } from 'lucide-react';

import { getFlowsForProject,
  deleteFlow } from '@/app/actions/flow.actions';
import type { Flow } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

/**
 * Flow Builder — SabFlow chatbot list.
 */

import * as React from 'react';

export default function FlowBuilderListPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<WithId<Flow>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const { activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [query, setQuery] = useState('');

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
    return { active, paused, withTriggers };
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
            <ZoruBreadcrumbPage>Flow builder</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Bot flows</ZoruPageTitle>
            <ZoruPageDescription>
              Automate replies with visual chatbot flows — trigger on keywords, branch on user
              input, and hand off to a human when needed.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
        <ZoruButton
          onClick={() => router.push('/wachat/flow-builder/new')}
          disabled={!activeProjectId}
        >
          <CirclePlus className="h-3.5 w-3.5" />
          Create new flow
        </ZoruButton>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total flows" value={String(flows.length)} icon={<GitBranch className="h-3.5 w-3.5" />} />
        <Stat
          label="Active"
          value={String(stats.active)}
          hint={
            flows.length > 0
              ? `${Math.round((stats.active / flows.length) * 100)}% live`
              : 'none yet'
          }
          icon={<Zap className="h-3.5 w-3.5" />}
          tint="success"
        />
        <Stat
          label="Paused"
          value={String(stats.paused)}
          icon={<CirclePause className="h-3.5 w-3.5" />}
          tint="warning"
        />
        <Stat
          label="With triggers"
          value={String(stats.withTriggers)}
          hint="keyword-activated"
          icon={<Zap className="h-3.5 w-3.5" />}
        />
      </div>

      {!activeProjectId ? (
        <ZoruEmptyState
          icon={<CircleAlert className="h-10 w-10" />}
          title="No project selected"
          description="Please select a project from the main dashboard to manage bot flows."
          action={<ZoruButton onClick={() => router.push('/wachat')}>Choose a project</ZoruButton>}
        />
      ) : (
        <ZoruCard className="flex min-h-[480px] flex-1 flex-col p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px] flex-1">
              <ZoruInput
                placeholder="Search flows by name or keyword…"
                leadingSlot={<Search />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <ZoruButton variant="outline" size="sm" onClick={fetchFlows} disabled={isLoading}>
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </ZoruButton>
            <span className="ml-auto text-[11.5px] tabular-nums text-zoru-ink-muted">
              {filtered.length} / {flows.length} flows
            </span>
          </div>

          <div className="mt-5 flex flex-1 flex-col overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line">
            {isLoading && flows.length === 0 ? (
              <div className="flex flex-col gap-0 divide-y divide-zoru-line p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ZoruSkeleton key={i} className="my-1 h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <ZoruEmptyState
                icon={<ServerCog className="h-10 w-10" />}
                title={query ? 'No matching flows' : 'No bot flows yet'}
                description={
                  query
                    ? `Nothing matched "${query}". Try a different search.`
                    : 'Create your first flow to automate replies, book appointments, or route leads.'
                }
                action={
                  query ? (
                    <ZoruButton size="sm" variant="outline" onClick={() => setQuery('')}>
                      Clear search
                    </ZoruButton>
                  ) : (
                    <ZoruButton
                      size="sm"
                      onClick={() => router.push('/wachat/flow-builder/new')}
                    >
                      <CirclePlus className="h-3.5 w-3.5" />
                      Create your first flow
                    </ZoruButton>
                  )
                }
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-zoru-line bg-zoru-surface text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Flow name</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Trigger keywords</th>
                    <th className="px-4 py-3 text-left">Last updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zoru-line">
                  {filtered.map((flow) => {
                    const paused = (flow.status ?? '').toUpperCase() === 'PAUSED';
                    return (
                      <tr
                        key={flow._id.toString()}
                        className="transition-colors hover:bg-zoru-surface-2"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/wachat/flow-builder/${flow._id.toString()}`}
                            className="text-zoru-ink hover:underline"
                          >
                            {flow.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <ZoruBadge variant={paused ? 'warning' : 'success'}>
                            {paused ? 'Paused' : 'Active'}
                          </ZoruBadge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(flow.triggerKeywords || []).length > 0 ? (
                              (flow.triggerKeywords || []).map((k, i) => (
                                <ZoruBadge key={`${k}-${i}`} variant="ghost">
                                  {k}
                                </ZoruBadge>
                              ))
                            ) : (
                              <span className="text-[11.5px] italic text-zoru-ink-muted">
                                No triggers
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11.5px] text-zoru-ink-muted">
                          {flow.updatedAt
                            ? format(new Date(flow.updatedAt), 'MMM d, yyyy · HH:mm')
                            : 'N/A'}
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
                                <Link href={`/wachat/flow-builder/${flow._id.toString()}`}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit flow
                                </Link>
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuSeparator />
                              <ZoruDropdownMenuItem
                                destructive
                                onClick={() => handleDelete(flow._id.toString())}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                          </ZoruDropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
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
  icon,
  tint = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tint?: 'neutral' | 'success' | 'warning';
}) {
  const chip = {
    neutral: 'bg-zoru-surface-2 text-zoru-ink',
    success: 'bg-zoru-success/10 text-zoru-success-ink',
    warning: 'bg-zoru-warning/15 text-zoru-warning-ink',
  }[tint];
  return (
    <ZoruCard className="p-4">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)]', chip)}>
        {icon}
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wide leading-none text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] tracking-[-0.01em] leading-none text-zoru-ink">
        {value}
      </div>
      {hint && (
        <div className="mt-1 truncate text-[11px] leading-tight text-zoru-ink-muted">
          {hint}
        </div>
      )}
    </ZoruCard>
  );
}
