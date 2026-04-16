'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  LuPlus,
  LuSearch,
  LuLayoutGrid,
  LuList,
  LuRefreshCw,
  LuWorkflow,
  LuZap,
  LuCirclePause,
  LuGitBranch,
  LuTriangle,
  LuLoader,
  LuSparkles,
} from 'react-icons/lu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  listSabFlows,
  createSabFlow,
  deleteSabFlow,
  duplicateSabFlow,
  saveSabFlow,
} from '@/app/actions/sabflow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FlowCard, type FlowItem } from '@/components/sabflow/FlowCard';
import { FlowTemplates } from '@/components/sabflow/FlowTemplates';
import { format } from 'date-fns';
import {
  LuPencil,
  LuTrash2,
  LuCopy,
  LuEllipsis,
  LuChartColumn,
  LuCircle,
} from 'react-icons/lu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ── Component ─────────────────────────────────────────────────────────── */

type ViewMode = 'grid' | 'list';

export default function SabFlowListPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, startCreating] = useTransition();

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  /* ── Data fetching ─────────────────────────────────────────────────── */

  const fetchFlows = useCallback(() => {
    startTransition(async () => {
      const data = await listSabFlows();
      if (Array.isArray(data)) {
        setFlows(data as FlowItem[]);
      } else if (data && 'error' in data) {
        toast({ title: 'Error', description: data.error as string, variant: 'destructive' });
      }
    });
  }, [toast]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  /* ── Handlers ──────────────────────────────────────────────────────── */

  const handleCreate = () => {
    startCreating(async () => {
      const result = await createSabFlow(newName.trim() || 'Untitled flow');
      if ('error' in result) {
        toast({ title: 'Error', description: result.error as string, variant: 'destructive' });
        return;
      }
      setShowCreate(false);
      setNewName('');
      router.push(`/dashboard/sabflow/flow-builder/${result.id}`);
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    startDeleting(async () => {
      const result = await deleteSabFlow(id);
      setDeleteTarget(null);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error as string, variant: 'destructive' });
      } else {
        toast({ title: 'Deleted', description: `"${name}" was deleted.` });
        fetchFlows();
      }
    });
  };

  const handleDuplicate = async (flowId: string) => {
    const result = await duplicateSabFlow(flowId);
    if ('error' in result) {
      toast({ title: 'Error', description: result.error as string, variant: 'destructive' });
    } else {
      toast({ title: 'Duplicated', description: 'Flow was duplicated.' });
      fetchFlows();
    }
  };

  const handleRename = async (flowId: string, newName: string) => {
    const result = await saveSabFlow(flowId, { name: newName });
    if ('error' in result) {
      toast({ title: 'Error', description: result.error as string, variant: 'destructive' });
    } else {
      setFlows((prev) =>
        prev.map((f) => (f._id === flowId ? { ...f, name: newName } : f)),
      );
    }
  };

  /* ── Derived data ──────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    if (!query.trim()) return flows;
    const q = query.toLowerCase();
    return flows.filter((f) => f.name.toLowerCase().includes(q));
  }, [flows, query]);

  const stats = useMemo(
    () => ({
      total: flows.length,
      published: flows.filter((f) => f.status === 'PUBLISHED').length,
      draft: flows.filter((f) => f.status === 'DRAFT').length,
      groups: flows.reduce((acc, f) => acc + (f.groups?.length ?? 0), 0),
    }),
    [flows],
  );

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
            <LuWorkflow className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
              SabFlow
            </h1>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
              Build visual conversational flows
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm"
        >
          <LuPlus className="h-4 w-4" strokeWidth={2.5} />
          New Flow
        </Button>
      </div>

      {/* ── Stats cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { label: 'Total', value: stats.total, icon: LuWorkflow, color: 'text-zinc-500 dark:text-zinc-400' },
          { label: 'Published', value: stats.published, icon: LuZap, color: 'text-green-600' },
          { label: 'Drafts', value: stats.draft, icon: LuCirclePause, color: 'text-amber-500' },
          { label: 'Groups', value: stats.groups, icon: LuGitBranch, color: 'text-blue-500' },
        ] as const).map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
          >
            <Icon className={cn('h-4 w-4 mb-2', color)} strokeWidth={1.5} />
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {label}
            </div>
            <div className="text-[22px] font-semibold text-zinc-900 dark:text-white tabular-nums">
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Templates section ─────────────────────────────────────────── */}
      {flows.length === 0 && !isPending && (
        <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <LuSparkles className="h-4 w-4 text-amber-500" strokeWidth={2} />
            <span className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-300">
              Get started quickly
            </span>
          </div>
          <FlowTemplates onFlowCreated={fetchFlows} />
        </div>
      )}

      {flows.length > 0 && (
        <FlowTemplates onFlowCreated={fetchFlows} />
      )}

      {/* ── My Flows section ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 mr-auto">
            My Flows
          </h2>

          {/* Search */}
          <div className="relative w-48 sm:w-64">
            <LuSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
              strokeWidth={2}
            />
            <input
              type="text"
              placeholder="Search flows…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchFlows}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <LuRefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} strokeWidth={2} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex h-8 w-8 items-center justify-center transition-colors',
                viewMode === 'grid'
                  ? 'bg-amber-500 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
              )}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <LuLayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex h-8 w-8 items-center justify-center transition-colors',
                viewMode === 'list'
                  ? 'bg-amber-500 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
              )}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <LuList className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Skeleton while first load */}
        {isPending && flows.length === 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="h-[130px] animate-pulse bg-zinc-100 dark:bg-zinc-800" />
                  <div className="p-3 flex flex-col gap-2">
                    <div className="h-3 w-3/4 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <div className="h-3 w-44 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
                  <div className="h-3 w-16 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
                  <div className="ml-auto h-6 w-6 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/50 dark:to-orange-950/50">
              <LuWorkflow className="h-7 w-7 text-amber-500" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[15px] font-semibold text-zinc-900 dark:text-white">
                {query ? 'No matching flows' : 'No flows yet'}
              </div>
              <div className="max-w-xs text-[12px] text-zinc-500 dark:text-zinc-400">
                {query
                  ? `Nothing matched "${query}". Try a different keyword.`
                  : 'Create your first SabFlow to build conversational bots.'}
              </div>
            </div>
            {!query && (
              <Button
                size="sm"
                onClick={() => setShowCreate(true)}
                className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0"
              >
                <LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Create your first flow
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* ── Grid view ──────────────────────────────────────────────── */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((flow) => (
              <FlowCard
                key={flow._id}
                flow={flow}
                onDelete={setDeleteTarget}
                onDuplicate={handleDuplicate}
                onRename={handleRename}
              />
            ))}
          </div>
        ) : (
          /* ── List view ──────────────────────────────────────────────── */
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Groups
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filtered.map((flow) => {
                  const isPublished = flow.status === 'PUBLISHED';
                  return (
                    <tr
                      key={flow._id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group"
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            router.push(`/dashboard/sabflow/flow-builder/${flow._id}`)
                          }
                          className="font-medium text-zinc-900 dark:text-white hover:text-amber-500 dark:hover:text-amber-400 transition-colors text-left"
                        >
                          {flow.name}
                        </button>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold',
                            isPublished
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900'
                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
                          )}
                        >
                          <LuCircle
                            className={cn(
                              'h-1.5 w-1.5 fill-current',
                              isPublished ? 'text-green-500' : 'text-amber-500',
                            )}
                          />
                          {isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>

                      {/* Groups count */}
                      <td className="px-4 py-3 text-zinc-500 tabular-nums">
                        {flow.groups?.length ?? 0}
                      </td>

                      {/* Created date */}
                      <td className="px-4 py-3 text-[11.5px] text-zinc-400 hidden sm:table-cell">
                        {flow.createdAt
                          ? format(new Date(flow.createdAt), 'MMM d, yyyy')
                          : '—'}
                      </td>

                      {/* Updated date */}
                      <td className="px-4 py-3 text-[11.5px] text-zinc-400">
                        {flow.updatedAt
                          ? format(new Date(flow.updatedAt), 'MMM d, yyyy · HH:mm')
                          : '—'}
                      </td>

                      {/* Actions dropdown */}
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <LuEllipsis className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-[11px] text-zinc-400">
                              Actions
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/dashboard/sabflow/flow-builder/${flow._id}`)
                              }
                            >
                              <LuPencil className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/dashboard/sabflow/logs?flowId=${flow._id}`)
                              }
                            >
                              <LuChartColumn className="mr-2 h-3.5 w-3.5" />
                              Results
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(flow._id)}>
                              <LuCopy className="mr-2 h-3.5 w-3.5" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget({ id: flow._id, name: flow.name })}
                            >
                              <LuTrash2 className="mr-2 h-3.5 w-3.5" />
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
          </div>
        )}
      </div>

      {/* ── Create flow dialog ────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New SabFlow</DialogTitle>
            <DialogDescription>
              Give your flow a name. You can change it later in the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Flow name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0"
            >
              {creating ? (
                <>
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ─────────────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40 text-red-600">
                <LuTriangle className="h-4 w-4" strokeWidth={2} />
              </div>
              <DialogTitle>Delete flow?</DialogTitle>
            </div>
            <DialogDescription>
              <strong className="font-medium text-zinc-900 dark:text-zinc-100">
                &ldquo;{deleteTarget?.name}&rdquo;
              </strong>{' '}
              will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                  Deleting…
                </span>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
