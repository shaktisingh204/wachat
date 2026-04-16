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
  LuGitBranch,
  LuZap,
  LuCirclePause,
  LuCopy,
  LuCircleAlert,
  LuWorkflow,
} from 'react-icons/lu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  listSabFlows,
  createSabFlow,
  deleteSabFlow,
  duplicateSabFlow,
} from '@/app/actions/sabflow';
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

type FlowItem = {
  _id: string;
  name: string;
  status: string;
  groups: { id: string }[];
  edges: { id: string }[];
  updatedAt: Date;
  createdAt: Date;
};

export default function SabFlowListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, startCreating] = useTransition();

  const fetchFlows = useCallback(() => {
    startTransition(async () => {
      const data = await listSabFlows();
      setFlows(data as unknown as FlowItem[]);
    });
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const handleCreate = () => {
    startCreating(async () => {
      const result = await createSabFlow(newName || 'Untitled flow');
      if ('error' in result) {
        toast({ title: 'Error', description: result.error as string, variant: 'destructive' });
        return;
      }
      setShowCreate(false);
      setNewName('');
      router.push(`/dashboard/sabflow/flow-builder/${result.id}`);
    });
  };

  const handleDelete = async (flowId: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const result = await deleteSabFlow(flowId);
    if ('error' in result) {
      toast({ title: 'Error', description: result.error as string, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: `"${name}" was deleted.` });
      fetchFlows();
    }
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

  const filtered = React.useMemo(() => {
    if (!query.trim()) return flows;
    const q = query.toLowerCase();
    return flows.filter((f) => f.name.toLowerCase().includes(q));
  }, [flows, query]);

  const stats = React.useMemo(() => ({
    total: flows.length,
    published: flows.filter((f) => f.status === 'PUBLISHED').length,
    draft: flows.filter((f) => f.status === 'DRAFT').length,
    blocks: flows.reduce((acc, f) => acc + (f.groups?.length ?? 0), 0),
  }), [flows]);

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 dark:text-gray-100 leading-tight">
            SabFlow
          </h1>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
            Build visual conversational flows with a Typebot-style canvas editor.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="gap-2 bg-[#f76808] hover:bg-[#e25c00] text-white border-0"
        >
          <LuCirclePlus className="h-4 w-4" strokeWidth={2.5} />
          New flow
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: stats.total, icon: LuWorkflow, color: 'text-gray-600' },
          { label: 'Published', value: stats.published, icon: LuZap, color: 'text-green-600' },
          { label: 'Drafts', value: stats.draft, icon: LuCirclePause, color: 'text-amber-600' },
          { label: 'Total groups', value: stats.blocks, icon: LuGitBranch, color: 'text-blue-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <Icon className={cn('h-4 w-4 mb-2', color)} strokeWidth={1.5} />
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
            <div className="text-[22px] font-semibold text-gray-900 dark:text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Search + list */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col min-h-[480px]">
        {/* Filter bar */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative flex-1 max-w-sm">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search flows…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-[#f76808]/30 focus:border-[#f76808]"
            />
          </div>
          <button
            onClick={fetchFlows}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LuRefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} strokeWidth={2} />
            Refresh
          </button>
          <span className="ml-auto text-[11.5px] tabular-nums text-gray-400">
            {filtered.length} / {flows.length}
          </span>
        </div>

        {/* Content */}
        {isPending && flows.length === 0 ? (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="h-3 w-40 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
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
              {query ? 'No matching flows' : 'No flows yet'}
            </div>
            <div className="max-w-xs text-[11.5px] text-gray-500 dark:text-gray-400">
              {query
                ? `Nothing matched "${query}".`
                : 'Create your first SabFlow to build conversational bots.'}
            </div>
            {!query && (
              <Button
                size="sm"
                onClick={() => setShowCreate(true)}
                className="mt-1 gap-1.5 bg-[#f76808] hover:bg-[#e25c00] text-white border-0"
              >
                <LuCirclePlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Create flow
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Groups</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Updated</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((flow) => {
                const isPublished = flow.status === 'PUBLISHED';
                return (
                  <tr key={flow._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/dashboard/sabflow/flow-builder/${flow._id}`)}
                        className="font-medium text-gray-900 dark:text-white hover:text-[#f76808] dark:hover:text-[#f76808] transition-colors text-left"
                      >
                        {flow.name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold',
                        isPublished
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', isPublished ? 'bg-green-500' : 'bg-amber-500')} />
                        {isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{flow.groups?.length ?? 0}</td>
                    <td className="px-4 py-3 text-[11.5px] text-gray-400">
                      {flow.updatedAt ? format(new Date(flow.updatedAt), 'MMM d, yyyy · HH:mm') : '—'}
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
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/sabflow/flow-builder/${flow._id}`)}>
                            <LuPencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(flow._id)}>
                            <LuCopy className="mr-2 h-3.5 w-3.5" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(flow._id, flow.name)}
                          >
                            <LuTrash2 className="mr-2 h-3.5 w-3.5" /> Delete
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

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New SabFlow</DialogTitle>
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
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
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
