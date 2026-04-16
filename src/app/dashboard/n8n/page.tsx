'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  LuCirclePlus,
  LuTrash2,
  LuPencil,
  LuEllipsis,
  LuSearch,
  LuRefreshCw,
  LuWorkflow,
  LuZap,
  LuCirclePause,
  LuCircleAlert,
  LuPlay,
  LuToggleLeft,
  LuToggleRight,
  LuActivity,
} from 'react-icons/lu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  listN8NWorkflows,
  createWorkflow,
  deleteWorkflow,
  activateWorkflow,
  deactivateWorkflow,
} from '@/app/actions/n8n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type WorkflowItem = {
  _id: string;
  name: string;
  active: boolean;
  nodes: { id: string }[];
  tags?: string[];
  lastRunAt?: Date;
  lastRunStatus?: 'success' | 'error' | 'running' | null;
  updatedAt: Date;
  createdAt: Date;
};

export default function N8NWorkflowListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, startCreating] = useTransition();

  const fetchWorkflows = useCallback(() => {
    startTransition(async () => {
      const data = await listN8NWorkflows();
      setWorkflows(data as unknown as WorkflowItem[]);
    });
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleCreate = () => {
    startCreating(async () => {
      try {
        const result = await createWorkflow({ name: newName || 'Untitled Workflow' });
        setShowCreate(false);
        setNewName('');
        router.push(`/dashboard/n8n/${result._id}`);
      } catch (err: unknown) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to create workflow.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDelete = async (wfId: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteWorkflow(wfId);
      toast({ title: 'Deleted', description: `"${name}" was deleted.` });
      fetchWorkflows();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete workflow.', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (wf: WorkflowItem) => {
    try {
      if (wf.active) {
        await deactivateWorkflow(wf._id);
        toast({ title: 'Deactivated', description: `"${wf.name}" is now inactive.` });
      } else {
        await activateWorkflow(wf._id);
        toast({ title: 'Activated', description: `"${wf.name}" is now active.` });
      }
      fetchWorkflows();
    } catch {
      toast({ title: 'Error', description: 'Failed to update workflow status.', variant: 'destructive' });
    }
  };

  const filtered = React.useMemo(() => {
    if (!query.trim()) return workflows;
    const q = query.toLowerCase();
    return workflows.filter((w) => w.name.toLowerCase().includes(q));
  }, [workflows, query]);

  const stats = React.useMemo(
    () => ({
      total: workflows.length,
      active: workflows.filter((w) => w.active).length,
      inactive: workflows.filter((w) => !w.active).length,
      totalNodes: workflows.reduce((acc, w) => acc + (w.nodes?.length ?? 0), 0),
    }),
    [workflows],
  );

  const runStatusColor = (status: WorkflowItem['lastRunStatus']) => {
    if (status === 'success') return 'text-green-600';
    if (status === 'error') return 'text-red-500';
    if (status === 'running') return 'text-amber-500';
    return 'text-gray-400';
  };

  const runStatusLabel = (status: WorkflowItem['lastRunStatus']) => {
    if (status === 'success') return 'Success';
    if (status === 'error') return 'Error';
    if (status === 'running') return 'Running…';
    return '—';
  };

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 dark:text-gray-100 leading-tight">
            n8n Workflows
          </h1>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
            Build and automate multi-step workflows with a node-based visual editor.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="gap-2 bg-[#f76808] hover:bg-[#e25c00] text-white border-0"
        >
          <LuCirclePlus className="h-4 w-4" strokeWidth={2.5} />
          New workflow
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: stats.total, icon: LuWorkflow, color: 'text-gray-600' },
          { label: 'Active', value: stats.active, icon: LuZap, color: 'text-green-600' },
          { label: 'Inactive', value: stats.inactive, icon: LuCirclePause, color: 'text-amber-600' },
          { label: 'Total nodes', value: stats.totalNodes, icon: LuActivity, color: 'text-blue-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
          >
            <Icon className={cn('h-4 w-4 mb-2', color)} strokeWidth={1.5} />
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {label}
            </div>
            <div className="text-[22px] font-semibold text-gray-900 dark:text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Search + list */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col min-h-[480px]">
        {/* Filter bar */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative flex-1 max-w-sm">
            <LuSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"
              strokeWidth={2}
            />
            <input
              type="text"
              placeholder="Search workflows…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f76808]/30 focus:border-[#f76808]"
            />
          </div>
          <button
            onClick={fetchWorkflows}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LuRefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} strokeWidth={2} />
            Refresh
          </button>
          <span className="ml-auto text-[11.5px] tabular-nums text-gray-400">
            {filtered.length} / {workflows.length}
          </span>
        </div>

        {/* Content */}
        {isPending && workflows.length === 0 ? (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="h-3 w-48 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
                <div className="ml-auto h-6 w-6 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
              <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="text-[13px] font-semibold text-gray-900 dark:text-white">
              {query ? 'No matching workflows' : 'No workflows yet'}
            </div>
            <div className="max-w-xs text-[11.5px] text-gray-500 dark:text-gray-400">
              {query
                ? `Nothing matched "${query}".`
                : 'Create your first n8n workflow to start automating tasks.'}
            </div>
            {!query && (
              <Button
                size="sm"
                onClick={() => setShowCreate(true)}
                className="mt-1 gap-1.5 bg-[#f76808] hover:bg-[#e25c00] text-white border-0"
              >
                <LuCirclePlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Create workflow
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Nodes
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Last run
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Updated
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((wf) => (
                <tr
                  key={wf._id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => router.push(`/dashboard/n8n/${wf._id}`)}
                      className="font-medium text-gray-900 dark:text-white hover:text-[#f76808] dark:hover:text-[#f76808] transition-colors text-left"
                    >
                      {wf.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(wf)}
                      className="inline-flex items-center gap-1.5 group"
                      title={wf.active ? 'Click to deactivate' : 'Click to activate'}
                    >
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors',
                          wf.active
                            ? 'bg-green-50 text-green-700 border-green-200 group-hover:bg-green-100'
                            : 'bg-gray-50 text-gray-500 border-gray-200 group-hover:bg-gray-100',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            wf.active ? 'bg-green-500' : 'bg-gray-400',
                          )}
                        />
                        {wf.active ? 'Active' : 'Inactive'}
                      </span>
                      {wf.active ? (
                        <LuToggleRight className="h-4 w-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                      ) : (
                        <LuToggleLeft className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{wf.nodes?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[11.5px]', runStatusColor(wf.lastRunStatus))}>
                      {runStatusLabel(wf.lastRunStatus)}
                    </span>
                    {wf.lastRunAt && (
                      <span className="ml-1.5 text-[11px] text-gray-400">
                        {format(new Date(wf.lastRunAt), 'MMM d · HH:mm')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11.5px] text-gray-400">
                    {wf.updatedAt ? format(new Date(wf.updatedAt), 'MMM d, yyyy · HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <LuEllipsis className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => router.push(`/dashboard/n8n/${wf._id}`)}
                        >
                          <LuPencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(wf)}>
                          <LuPlay className="mr-2 h-3.5 w-3.5" />
                          {wf.active ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(wf._id, wf.name)}
                        >
                          <LuTrash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Workflow</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Workflow name…"
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
              className="bg-[#f76808] hover:bg-[#e25c00] text-white border-0"
            >
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
