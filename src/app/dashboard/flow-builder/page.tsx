'use client';

/**
 * Flow Builder — SabFlow chatbot list, rebuilt on Clay primitives.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { format } from 'date-fns';

import {
  LuCircleAlert,
  LuCirclePlus,
  LuServerCog,
  LuTrash2,
  LuPencil,
  LuEllipsis,
  LuSearch,
  LuRefreshCw,
  LuGitBranch,
  LuZap,
  LuCirclePause,
} from 'react-icons/lu';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getFlowsForProject, deleteFlow } from '@/app/actions/flow.actions';
import type { Flow } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

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

export default function FlowBuilderListPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<WithId<Flow>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
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
    if (
      !confirm('Are you sure you want to delete this flow? This cannot be undone.')
    ) {
      return;
    }
    const result = await deleteFlow(flowId);
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
    const active = flows.filter(
      (f) => (f.status ?? 'ACTIVE').toUpperCase() !== 'PAUSED',
    ).length;
    const paused = flows.filter(
      (f) => (f.status ?? '').toUpperCase() === 'PAUSED',
    ).length;
    const withTriggers = flows.filter(
      (f) => (f.triggerKeywords ?? []).length > 0,
    ).length;
    return { active, paused, withTriggers };
  }, [flows]);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      {/* Breadcrumb */}
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Flow Builder' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Bot Flows
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
            Automate replies with visual chatbot flows — trigger on keywords,
            branch on user input, and hand off to a human when needed.
          </p>
        </div>
        <ClayButton
          variant="obsidian"
          size="md"
          className="px-5"
          leading={<LuCirclePlus className="h-3.5 w-3.5" strokeWidth={2.5} />}
          onClick={() => router.push('/dashboard/flow-builder/new')}
          disabled={!activeProjectId}
        >
          Create new flow
        </ClayButton>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total flows"
          value={String(flows.length)}
          icon={<LuGitBranch className="h-3.5 w-3.5" strokeWidth={2} />}
          tint="neutral"
        />
        <Stat
          label="Active"
          value={String(stats.active)}
          hint={
            flows.length > 0
              ? `${Math.round((stats.active / flows.length) * 100)}% live`
              : 'none yet'
          }
          icon={<LuZap className="h-3.5 w-3.5" strokeWidth={2} />}
          tint="green"
        />
        <Stat
          label="Paused"
          value={String(stats.paused)}
          icon={<LuCirclePause className="h-3.5 w-3.5" strokeWidth={2} />}
          tint="amber"
        />
        <Stat
          label="With triggers"
          value={String(stats.withTriggers)}
          hint="keyword-activated"
          icon={<LuZap className="h-3.5 w-3.5" strokeWidth={2} />}
          tint="rose"
        />
      </div>

      {/* No project state */}
      {!activeProjectId ? (
        <ClayCard padded={false} className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-rose-soft text-clay-rose-ink">
            <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-clay-ink">
            No project selected
          </div>
          <div className="mt-1.5 text-[12.5px] text-clay-ink-muted">
            Please select a project from the main dashboard to manage bot
            flows.
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
        <ClayCard padded={false} className="flex min-h-[480px] flex-1 flex-col p-6">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px] flex-1">
              <ClayInput
                sizeVariant="md"
                placeholder="Search flows by name or keyword…"
                leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <ClayButton
              variant="pill"
              size="md"
              leading={
                <LuRefreshCw
                  className={cn(
                    'h-3.5 w-3.5',
                    isLoading && 'animate-spin',
                  )}
                  strokeWidth={2}
                />
              }
              onClick={fetchFlows}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </ClayButton>
            <span className="ml-auto text-[11.5px] tabular-nums text-clay-ink-muted">
              {filtered.length} / {flows.length} flows
            </span>
          </div>

          {/* Table / empty / skeleton — grows to fill remaining card space */}
          <div className="mt-5 flex flex-1 flex-col overflow-hidden rounded-[12px] border border-clay-border">
            {isLoading && flows.length === 0 ? (
              <div className="flex flex-col gap-0 divide-y divide-clay-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4">
                    <div className="h-3 w-32 animate-pulse rounded-full bg-clay-bg-2" />
                    <div className="h-3 w-16 animate-pulse rounded-full bg-clay-bg-2" />
                    <div className="h-3 w-24 animate-pulse rounded-full bg-clay-bg-2" />
                    <div className="ml-auto h-6 w-6 animate-pulse rounded-full bg-clay-bg-2" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-bg-2 text-clay-ink-muted">
                  <LuServerCog className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div className="mt-2 text-[13px] font-semibold text-clay-ink">
                  {query ? 'No matching flows' : 'No bot flows yet'}
                </div>
                <div className="max-w-[380px] text-[11.5px] text-clay-ink-muted">
                  {query
                    ? `Nothing matched "${query}". Try a different search.`
                    : 'Create your first flow to automate replies to common questions, book appointments, or route leads to the right agent.'}
                </div>
                {!query ? (
                  <ClayButton
                    variant="rose"
                    size="sm"
                    leading={
                      <LuCirclePlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    }
                    onClick={() => router.push('/dashboard/flow-builder/new')}
                    className="mt-2"
                  >
                    Create your first flow
                  </ClayButton>
                ) : (
                  <ClayButton
                    variant="pill"
                    size="sm"
                    onClick={() => setQuery('')}
                    className="mt-2"
                  >
                    Clear search
                  </ClayButton>
                )}
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="bg-clay-surface-2 border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Flow name</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Trigger keywords</th>
                    <th className="px-4 py-3 text-left">Last updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clay-border">
                  {filtered.map((flow) => {
                    const paused =
                      (flow.status ?? '').toUpperCase() === 'PAUSED';
                    return (
                      <tr
                        key={flow._id.toString()}
                        className="transition-colors hover:bg-clay-surface-2"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/flow-builder/${flow._id.toString()}`}
                            className="font-medium text-clay-ink hover:text-clay-rose transition-colors"
                          >
                            {flow.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold',
                              paused
                                ? 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]'
                                : 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                paused ? 'bg-clay-amber' : 'bg-clay-green',
                              )}
                            />
                            {paused ? 'Paused' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(flow.triggerKeywords || []).length > 0 ? (
                              (flow.triggerKeywords || []).map((k, i) => (
                                <span
                                  key={`${k}-${i}`}
                                  className="inline-flex h-5 items-center rounded-full border border-clay-border bg-clay-bg-2 px-2 text-[10.5px] font-medium text-clay-ink-muted"
                                >
                                  {k}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11.5px] italic text-clay-ink-soft">
                                No triggers
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11.5px] text-clay-ink-muted">
                          {flow.updatedAt
                            ? format(new Date(flow.updatedAt), 'MMM d, yyyy · HH:mm')
                            : 'N/A'}
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
                                  href={`/dashboard/flow-builder/${flow._id.toString()}`}
                                >
                                  <LuPencil className="mr-2 h-4 w-4" />
                                  Edit flow
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(flow._id.toString())}
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
  icon,
  tint = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tint?: 'neutral' | 'green' | 'amber' | 'rose';
}) {
  const chip = {
    neutral: 'bg-clay-bg-2 text-clay-ink-muted',
    green: 'bg-[#DCFCE7] text-[#166534]',
    amber: 'bg-[#FEF3C7] text-[#92400E]',
    rose: 'bg-clay-rose-soft text-clay-rose-ink',
  }[tint];
  return (
    <div className="rounded-[14px] border border-clay-border bg-clay-surface p-4">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-[10px]',
          chip,
        )}
      >
        {icon}
      </div>
      <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-clay-ink-muted leading-none">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.01em] text-clay-ink leading-none">
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
