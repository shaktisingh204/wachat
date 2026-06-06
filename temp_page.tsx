'use client';

import {
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Input,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  cn,
  useZoruToast,
  Checkbox,
} from "@/components/sabcrm/20ui/compat";
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  CirclePlus,
  Trash2,
  Pencil,
  Ellipsis,
  Search,
  RefreshCw,
  Workflow,
  Zap,
  CirclePause,
  CircleAlert,
  Play,
  ToggleLeft,
  ToggleRight,
  Activity,
  } from 'lucide-react';

import * as React from 'react';

import {
  listN8NWorkflows,
  createWorkflow,
  deleteWorkflow,
  activateWorkflow,
  deactivateWorkflow,
  bulkDeleteWorkflows,
  bulkActivateWorkflows,
  bulkDeactivateWorkflows,
} from '@/app/actions/n8n';

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


const WORKFLOW_TEMPLATES = [
  {
    name: 'Webhook to Slack',
    description: 'Triggered by a webhook, formats data, and sends a Slack message.',
    nodes: [
      { id: 'webhook-1', type: 'n8n-nodes-base.webhook', name: 'Webhook', position: [250, 300] },
      { id: 'slack-1', type: 'n8n-nodes-base.slack', name: 'Slack', position: [450, 300] }
    ],
    connections: { 'Webhook': { main: [[{ node: 'Slack', type: 'main', index: 0 }]] } }
  },
  {
    name: 'Daily Email Report',
    description: 'Runs daily at 8AM, queries database, and emails a summary report.',
    nodes: [
      { id: 'cron-1', type: 'n8n-nodes-base.cron', name: 'Cron', position: [250, 300] },
      { id: 'postgres-1', type: 'n8n-nodes-base.postgres', name: 'Postgres', position: [450, 300] },
      { id: 'email-1', type: 'n8n-nodes-base.emailSend', name: 'Email Send', position: [650, 300] }
    ],
    connections: { 'Cron': { main: [[{ node: 'Postgres', type: 'main', index: 0 }]] }, 'Postgres': { main: [[{ node: 'Email Send', type: 'main', index: 0 }]] } }
  },
  {
    name: 'Stripe Payment to CRM',
    description: 'Listens for Stripe successful payments and creates a record in HubSpot CRM.',
    nodes: [
      { id: 'stripe-1', type: 'n8n-nodes-base.stripeTrigger', name: 'Stripe Trigger', position: [250, 300] },
      { id: 'hubspot-1', type: 'n8n-nodes-base.hubspot', name: 'HubSpot', position: [450, 300] }
    ],
    connections: { 'Stripe Trigger': { main: [[{ node: 'HubSpot', type: 'main', index: 0 }]] } }
  }
];

export default function N8NWorkflowListPage() {

  const router = useRouter();
  const { toast } = useZoruToast();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, startCreating] = useTransition();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulking, startBulking] = useTransition();

  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selectedIds.length} workflows? This cannot be undone.`)) return;
    startBulking(async () => {
      try {
        await bulkDeleteWorkflows(selectedIds);
        toast({ title: 'Deleted', description: `${selectedIds.length} workflows deleted.` });
        setSelectedIds([]);
        fetchWorkflows();
      } catch {
        toast({ title: 'Error', description: 'Failed to delete workflows.', variant: 'destructive' });
      }
    });
  };

  const handleBulkActivate = () => {
    startBulking(async () => {
      try {
        await bulkActivateWorkflows(selectedIds);
        toast({ title: 'Activated', description: `${selectedIds.length} workflows activated.` });
        setSelectedIds([]);
        fetchWorkflows();
      } catch {
        toast({ title: 'Error', description: 'Failed to activate workflows.', variant: 'destructive' });
      }
    });
  };

  const handleBulkDeactivate = () => {
    startBulking(async () => {
      try {
        await bulkDeactivateWorkflows(selectedIds);
        toast({ title: 'Deactivated', description: `${selectedIds.length} workflows deactivated.` });
        setSelectedIds([]);
        fetchWorkflows();
      } catch {
        toast({ title: 'Error', description: 'Failed to deactivate workflows.', variant: 'destructive' });
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(w => w._id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };


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
      toast({
        title: 'Error',
        description: 'Failed to delete workflow.',
        variant: 'destructive',
      });
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
      toast({
        title: 'Error',
        description: 'Failed to update workflow status.',
        variant: 'destructive',
      });
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

  const runStatusVariant = (
    status: WorkflowItem['lastRunStatus'],
  ): 'success' | 'danger' | 'warning' | 'ghost' => {
    if (status === 'success') return 'success';
    if (status === 'error') return 'danger';
    if (status === 'running') return 'warning';
    return 'ghost';
  };

  const runStatusLabel = (status: WorkflowItem['lastRunStatus']) => {
    if (status === 'success') return 'Success';
    if (status === 'error') return 'Error';
    if (status === 'running') return 'Running…';
    return '—';
  };

  return (
    <div className="flex min-h-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>n8n Workflows</ZoruPageTitle>
            <ZoruPageDescription>
              Build and automate multi-step workflows with a node-based visual editor.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <Button onClick={() => setShowCreate(true)}>
          <CirclePlus className="h-4 w-4" />
          New workflow
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: stats.total, icon: Workflow },
          { label: 'Active', value: stats.active, icon: Zap },
          { label: 'Inactive', value: stats.inactive, icon: CirclePause },
          { label: 'Total nodes', value: stats.totalNodes, icon: Activity },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <Icon className="h-4 w-4 mb-2 text-zoru-ink-muted" />
            <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
              {label}
            </div>
            <div className="text-[22px] text-zoru-ink">{value}</div>
          </Card>
        ))}
      </div>

      
      {/* Templates */}
      <div>
        <h3 className="mb-3 text-[13px] font-medium text-zoru-ink">Pre-built Templates</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {WORKFLOW_TEMPLATES.map((tpl) => (
            <Card key={tpl.name} className="flex flex-col p-4">
              <div className="flex items-center gap-2 font-medium text-[13px] text-zoru-ink mb-1">
                <Workflow className="h-4 w-4 text-zoru-ink" />
                {tpl.name}
              </div>
              <p className="text-[11.5px] text-zoru-ink-muted mb-4 flex-1">
                {tpl.description}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  startCreating(async () => {
                    try {
                      const result = await createWorkflow({
                        name: tpl.name,
                        nodes: tpl.nodes as any,
                        connections: tpl.connections,
                      });
                      router.push(`/dashboard/n8n/${result._id}`);
                    } catch (err: unknown) {
                      toast({
                        title: 'Error',
                        description: 'Failed to clone template.',
                        variant: 'destructive',
                      });
                    }
                  });
                }}
                disabled={creating}
              >
                Clone Template
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Search + list */}

      <Card className="flex flex-col min-h-[480px] p-0">
        
        <div className="flex items-center gap-3 p-4 border-b border-zoru-line flex-wrap">
          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[13px] font-medium text-zoru-ink">
                {selectedIds.length} selected
              </span>
              <Button size="sm" variant="outline" onClick={handleBulkActivate} disabled={isBulking}>
                Activate
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkDeactivate} disabled={isBulking}>
                Deactivate
              </Button>
              <Button size="sm" variant="danger" onClick={handleBulkDelete} disabled={isBulking}>
                Delete
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-1">
              <Input
                type="text"
                placeholder="Search workflows…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                leadingSlot={<Search className="h-3.5 w-3.5" />}
                className="max-w-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchWorkflows}
                disabled={isPending}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          )}
          
          <span className="ml-auto text-[11.5px] tabular-nums text-zoru-ink-muted">
            {filtered.length} / {workflows.length}
          </span>
        </div>


        {isPending && workflows.length === 0 ? (
          <div className="flex flex-col divide-y divide-zoru-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="h-3 w-48 animate-pulse rounded-full bg-zoru-surface-2" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-zoru-surface-2" />
                <div className="ml-auto h-6 w-6 animate-pulse rounded-full bg-zoru-surface-2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
              <CircleAlert className="h-5 w-5" />
            </div>
            <div className="text-[13px] text-zoru-ink">
              {query ? 'No matching workflows' : 'No workflows yet'}
            </div>
            <div className="max-w-xs text-[11.5px] text-zoru-ink-muted">
              {query
                ? `Nothing matched "${query}".`
                : 'Create your first n8n workflow to start automating tasks.'}
            </div>
            {!query && (
              <Button size="sm" onClick={() => setShowCreate(true)} className="mt-1">
                <CirclePlus className="h-3.5 w-3.5" />
                Create workflow
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-zoru-surface border-b border-zoru-line">
              
              <tr>
                <th className="px-4 py-3 text-left w-8">
                  <Checkbox 
                    checked={filtered.length > 0 && selectedIds.length === filtered.length ? true : selectedIds.length > 0 ? 'indeterminate' : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-zoru-ink-muted">

                  Name
                </th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  Nodes
                </th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  Last run
                </th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  Updated
                </th>
                <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zoru-line">
              {filtered.map((wf) => (
                
                <tr key={wf._id} className="hover:bg-zoru-surface transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.includes(wf._id)}
                      onCheckedChange={() => toggleSelectOne(wf._id)}
                    />
                  </td>
                  <td className="px-4 py-3">

                    <button
                      onClick={() => router.push(`/dashboard/n8n/${wf._id}`)}
                      className="text-zoru-ink hover:underline text-left"
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
                      <Badge variant={wf.active ? 'success' : 'ghost'}>
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            wf.active ? 'bg-zoru-success' : 'bg-zoru-ink-muted',
                          )}
                        />
                        {wf.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {wf.active ? (
                        <ToggleRight className="h-4 w-4 text-zoru-success-ink opacity-0 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-zoru-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-zoru-ink-muted">{wf.nodes?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={runStatusVariant(wf.lastRunStatus)}>
                      {runStatusLabel(wf.lastRunStatus)}
                    </Badge>
                    {wf.lastRunAt && (
                      <span className="ml-1.5 text-[11px] text-zoru-ink-muted">
                        {format(new Date(wf.lastRunAt), 'MMM d · HH:mm')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11.5px] text-zoru-ink-muted">
                    {wf.updatedAt ? format(new Date(wf.updatedAt), 'MMM d, yyyy · HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Ellipsis className="h-4 w-4" />
                        </Button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent align="end" className="w-48">
                        <ZoruDropdownMenuLabel>Actions</ZoruDropdownMenuLabel>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem
                          onClick={() => router.push(`/dashboard/n8n/${wf._id}`)}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem onClick={() => handleToggleActive(wf)}>
                          <Play className="mr-2 h-3.5 w-3.5" />
                          {wf.active ? 'Deactivate' : 'Activate'}
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem
                          className="text-zoru-danger-ink focus:text-zoru-danger-ink"
                          onClick={() => handleDelete(wf._id, wf.name)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <ZoruDialogContent className="max-w-sm">
          <ZoruDialogHeader>
            <ZoruDialogTitle>New Workflow</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="py-2">
            <Input
              placeholder="Workflow name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
