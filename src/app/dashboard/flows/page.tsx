'use client';

/**
 * Wachat Meta Flows — rebuilt on Clay primitives.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';

import {
  LuCircleAlert,
  LuBookOpen,
  LuPencil,
  LuEllipsis,
  LuCirclePlus,
  LuRefreshCw,
  LuSearch,
  LuServerCog,
  LuTrash2,
  LuChevronDown,
} from 'react-icons/lu';

import { deleteMetaFlow, getMetaFlows } from '@/app/actions/meta-flow.actions';
import type { MetaFlow } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/context/project-context';
import { SyncMetaFlowsButton } from '@/components/wabasimplify/sync-meta-flows-button';

import { cn } from '@/lib/utils';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { ClayInput } from '@/components/clay/clay-input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ── helpers ────────────────────────────────────────────────────── */

function statusTone(status?: string): {
  dot: string;
  label: string;
  chip: string;
} {
  const s = (status ?? '').toLowerCase();
  if (s === 'published')
    return {
      dot: 'bg-clay-green',
      label: 'Published',
      chip: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
    };
  if (s === 'draft' || !s)
    return {
      dot: 'bg-clay-ink-fade',
      label: 'Draft',
      chip: 'bg-clay-bg-2 text-clay-ink-muted border-clay-border',
    };
  return {
    dot: 'bg-clay-red',
    label: status!,
    chip: 'bg-clay-red-soft text-clay-red border-clay-red/40',
  };
}

/* ── page ───────────────────────────────────────────────────────── */

export default function MetaFlowsPage() {
  const router = useRouter();
  const { activeProject, activeProjectId } = useProject();
  const [flows, setFlows] = useState<WithId<MetaFlow>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const { toast } = useToast();
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
    if (
      !confirm(
        'Are you sure you want to delete this flow? This cannot be undone.',
      )
    ) {
      return;
    }
    const result = await deleteMetaFlow(flowId, metaId);
    if (result.error) {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
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
    const published = flows.filter(
      (f) => (f.status ?? '').toLowerCase() === 'published',
    ).length;
    const draft = flows.filter(
      (f) => (f.status ?? '').toLowerCase() === 'draft' || !f.status,
    ).length;
    return { published, draft };
  }, [flows]);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      {/* Breadcrumb */}
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Meta Flows' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Meta Flows
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
            Interactive multi-step WhatsApp experiences — forms, bookings,
            order flows — managed directly from SabNode.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncMetaFlowsButton
            projectId={activeProjectId}
            onSyncComplete={fetchFlows}
          />
          <ClayButton
            variant="pill"
            size="md"
            leading={<LuBookOpen className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={() => router.push('/dashboard/flows/docs')}
          >
            API docs
          </ClayButton>
          <ClayButton
            variant="obsidian"
            size="md"
            className="px-5"
            leading={<LuCirclePlus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            onClick={() => router.push('/dashboard/flows/create')}
            disabled={!activeProjectId}
          >
            New flow
          </ClayButton>
        </div>
      </div>

      {/* Stats strip */}
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
          tint="green"
        />
        <Stat label="Drafts" value={String(stats.draft)} tint="neutral" />
      </div>

      {!activeProjectId ? (
        <ClayCard padded={false} className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-rose-soft text-clay-rose-ink">
            <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-clay-ink">
            No project selected
          </div>
          <div className="mt-1.5 text-[12.5px] text-clay-ink-muted">
            Please select a project from the main dashboard to manage Meta
            Flows.
          </div>
          <ClayButton
            variant="rose"
            size="md"
            onClick={() => router.push('/dashboard')}
            className="mt-5"
          >
            Choose a project
          </ClayButton>
        </ClayCard>
      ) : (
        <ClayCard padded={false} className="p-6">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px] flex-1">
              <ClayInput
                sizeVariant="md"
                placeholder="Search flows by name or Meta ID…"
                leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <ClayButton
              variant="pill"
              size="md"
              leading={<LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
              onClick={fetchFlows}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </ClayButton>
            <span className="ml-auto text-[11.5px] tabular-nums text-clay-ink-muted">
              {filteredFlows.length} / {flows.length} flows
            </span>
          </div>

          {/* Table / empty / skeleton */}
          <div className="mt-5 overflow-hidden rounded-[12px] border border-clay-border">
            {isLoading && flows.length === 0 ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-32 w-[85%] animate-pulse rounded-[10px] bg-clay-bg-2" />
              </div>
            ) : filteredFlows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-bg-2 text-clay-ink-muted">
                  <LuServerCog className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div className="mt-2 text-[13px] font-semibold text-clay-ink">
                  {searchQuery ? 'No matching flows' : 'No Meta Flows yet'}
                </div>
                <div className="max-w-[360px] text-[11.5px] text-clay-ink-muted">
                  {searchQuery
                    ? `Nothing matched "${searchQuery}". Try a different search.`
                    : 'Create a flow to let customers fill out forms, book slots, or order items inside a WhatsApp conversation.'}
                </div>
                {!searchQuery ? (
                  <ClayButton
                    variant="rose"
                    size="sm"
                    leading={
                      <LuCirclePlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    }
                    onClick={() => router.push('/dashboard/flows/create')}
                    className="mt-2"
                  >
                    Create your first flow
                  </ClayButton>
                ) : null}
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="bg-clay-surface-2 border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Flow name</th>
                    <th className="px-4 py-3 text-left">Meta ID</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clay-border">
                  {filteredFlows.map((flow) => {
                    const tone = statusTone(flow.status);
                    return (
                      <tr
                        key={flow._id.toString()}
                        className="transition-colors hover:bg-clay-surface-2"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-clay-ink">
                            {flow.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-clay-ink-muted tabular-nums">
                          {flow.metaId}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {flow.categories?.map((cat) => (
                              <span
                                key={cat}
                                className="inline-flex h-5 items-center rounded-full border border-clay-border bg-clay-bg-2 px-2 text-[10.5px] font-medium text-clay-ink-muted"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold',
                              tone.chip,
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                tone.dot,
                              )}
                            />
                            {tone.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Open menu"
                                className="flex h-7 w-7 items-center justify-center rounded-md text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink transition-colors"
                              >
                                <LuEllipsis className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/flows/create?flowId=${flow._id.toString()}`}
                                >
                                  <LuPencil className="mr-2 h-4 w-4" />
                                  Edit flow
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  handleDelete(
                                    flow._id.toString(),
                                    flow.metaId,
                                  )
                                }
                              >
                                <LuTrash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </ClayCard>
      )}

      <div className="h-6" />
    </div>
  );
}

/* ── stat tile ──────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  hint,
  tint = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tint?: 'neutral' | 'green';
}) {
  return (
    <div className="rounded-[14px] border border-clay-border bg-clay-surface p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-clay-ink-muted">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div
          className={cn(
            'text-[22px] font-semibold tracking-[-0.01em] leading-none',
            tint === 'green' ? 'text-clay-green' : 'text-clay-ink',
          )}
        >
          {value}
        </div>
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-clay-ink-muted leading-tight truncate">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
