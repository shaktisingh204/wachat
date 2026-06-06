'use client';

import {
  Badge,
  Button,
  IconButton,
  Card,
  CardTitle,
  CardDescription,
  StatCard,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  Input,
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';
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
  LayoutTemplate,
  Copy,
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
  executionsCount?: number;
  updatedAt: Date;
  createdAt: Date;
};


const TEMPLATES = [
  {
    id: 't1',
    name: 'Webhook to Telegram Notification',
    description: 'Listen to a generic webhook and send a text message to a Telegram chat.',
    nodes: [
      {
        id: '1',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [100, 300],
        parameters: { path: 'webhook', httpMethod: 'POST', respondWith: 'text', responseText: 'OK' }
      },
      {
        id: '2',
        name: 'Telegram',
        type: 'n8n-nodes-base.telegram',
        typeVersion: 1,
        position: [350, 300],
        parameters: { chat_id: '', text: 'Received data: {{$json.body}}', operation: 'sendMessage' }
      }
    ],
    connections: {
      'Webhook': { main: [[ { node: 'Telegram', type: 'main', index: 0 } ]] }
    }
  },
  {
    id: 't2',
    name: 'Scheduled Daily Report',
    description: 'Runs every day to gather data and send an HTTP request.',
    nodes: [
      {
        id: '1',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        position: [100, 300],
        parameters: { rule: { interval: [{ field: 'days', expression: '1' }] } }
      },
      {
        id: '2',
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 1,
        position: [350, 300],
        parameters: { url: 'https://example.com/api/report', method: 'POST' }
      }
    ],
    connections: {
      'Schedule Trigger': { main: [[ { node: 'HTTP Request', type: 'main', index: 0 } ]] }
    }
  },
  {
    id: 't3',
    name: 'WhatsApp Auto Reply',
    description: 'Receives WhatsApp messages and auto-replies with a default message.',
    nodes: [
      {
        id: '1',
        name: 'WhatsApp Trigger',
        type: 'n8n-nodes-base.whatsappTrigger',
        typeVersion: 1,
        position: [100, 300],
        parameters: {}
      },
      {
        id: '2',
        name: 'WhatsApp Reply',
        type: 'n8n-nodes-base.whatsapp',
        typeVersion: 1,
        position: [350, 300],
        parameters: { operation: 'sendMessage', message: 'Hello! This is an auto-reply.', phone: '{{$json.sender}}' }
      }
    ],
    connections: {
      'WhatsApp Trigger': { main: [[ { node: 'WhatsApp Reply', type: 'main', index: 0 } ]] }
    }
  }
];

export default function N8NWorkflowListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, startCreating] = useTransition();
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionPending, startBulkAction] = useTransition();

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
          tone: 'danger',
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
        tone: 'danger',
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
        tone: 'danger',
      });
    }
  };


  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selectedIds.size} workflows? This cannot be undone.`)) return;
    startBulkAction(async () => {
      try {
        await bulkDeleteWorkflows(Array.from(selectedIds));
        toast({ title: 'Deleted', description: `${selectedIds.size} workflows deleted.` });
        setSelectedIds(new Set());
        fetchWorkflows();
      } catch {
        toast({ title: 'Error', description: 'Failed to delete workflows.', tone: 'danger' });
      }
    });
  };

  const handleBulkActivate = () => {
    startBulkAction(async () => {
      try {
        await bulkActivateWorkflows(Array.from(selectedIds));
        toast({ title: 'Activated', description: `${selectedIds.size} workflows activated.` });
        setSelectedIds(new Set());
        fetchWorkflows();
      } catch {
        toast({ title: 'Error', description: 'Failed to activate workflows.', tone: 'danger' });
      }
    });
  };

  const handleBulkDeactivate = () => {
    startBulkAction(async () => {
      try {
        await bulkDeactivateWorkflows(Array.from(selectedIds));
        toast({ title: 'Deactivated', description: `${selectedIds.size} workflows deactivated.` });
        setSelectedIds(new Set());
        fetchWorkflows();
      } catch {
        toast({ title: 'Error', description: 'Failed to deactivate workflows.', tone: 'danger' });
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((w) => w._id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
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

  const runStatusTone = (
    status: WorkflowItem['lastRunStatus'],
  ): 'success' | 'danger' | 'warning' | 'neutral' => {
    if (status === 'success') return 'success';
    if (status === 'error') return 'danger';
    if (status === 'running') return 'warning';
    return 'neutral';
  };

  const runStatusLabel = (status: WorkflowItem['lastRunStatus']) => {
    if (status === 'success') return 'Success';
    if (status === 'error') return 'Error';
    if (status === 'running') return 'Running';
    return 'Not run';
  };

  const allSelected = selectedIds.size === filtered.length && filtered.length > 0;

  return (
    <div className="flex min-h-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader bordered={false}>
          <PageHeading>
            <PageTitle>n8n Workflows</PageTitle>
            <PageDescription>
              Build and automate multi-step workflows with a node-based visual editor.
            </PageDescription>
          </PageHeading>
        </PageHeader>
        <div className="flex items-center gap-2">
          <Button variant="outline" iconLeft={LayoutTemplate} onClick={() => setShowTemplates(true)}>
            Templates
          </Button>
          <Button variant="primary" iconLeft={CirclePlus} onClick={() => setShowCreate(true)}>
            New workflow
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={Workflow} />
        <StatCard label="Active" value={stats.active} icon={Zap} />
        <StatCard label="Inactive" value={stats.inactive} icon={CirclePause} />
        <StatCard label="Total nodes" value={stats.totalNodes} icon={Activity} />
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] p-3 shadow-sm">
          <span className="text-[13px] font-medium text-[var(--st-text)]">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-[var(--st-border)] mx-2" />
          <Button variant="outline" size="sm" iconLeft={Play} onClick={handleBulkActivate} disabled={bulkActionPending}>
            Activate
          </Button>
          <Button variant="outline" size="sm" iconLeft={CirclePause} onClick={handleBulkDeactivate} disabled={bulkActionPending}>
            Deactivate
          </Button>
          <Button variant="danger" size="sm" iconLeft={Trash2} onClick={handleBulkDelete} disabled={bulkActionPending}>
            Delete
          </Button>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} disabled={bulkActionPending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Search + list */}
      <Card padding="none" className="flex flex-col min-h-[480px]">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--st-border)]">
          <Field className="max-w-sm flex-1">
            <Input
              type="text"
              placeholder="Search workflows..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              iconLeft={Search}
              aria-label="Search workflows"
            />
          </Field>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={RefreshCw}
            onClick={fetchWorkflows}
            disabled={isPending}
            className={cn(isPending && '[&_svg]:animate-spin')}
          >
            Refresh
          </Button>
          <span className="ml-auto text-[11.5px] tabular-nums text-[var(--st-text-secondary)]">
            {filtered.length} / {workflows.length}
          </span>
        </div>

        {isPending && workflows.length === 0 ? (
          <div className="flex flex-col divide-y divide-[var(--st-border)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="h-3 w-48 animate-pulse rounded-full bg-[var(--st-bg-muted)]" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-[var(--st-bg-muted)]" />
                <div className="ml-auto h-6 w-6 animate-pulse rounded-full bg-[var(--st-bg-muted)]" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <EmptyState
              icon={CircleAlert}
              title={query ? 'No matching workflows' : 'No workflows yet'}
              description={
                query
                  ? `Nothing matched "${query}".`
                  : 'Create your first n8n workflow to start automating tasks.'
              }
              action={
                !query ? (
                  <Button variant="primary" size="sm" iconLeft={CirclePlus} onClick={() => setShowCreate(true)}>
                    Create workflow
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <Table hover>
            <THead>
              <Tr>
                <Th align="center" width={48}>
                  <Checkbox
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all workflows"
                  />
                </Th>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Nodes</Th>
                <Th>Executions</Th>
                <Th>Last run</Th>
                <Th>Updated</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.map((wf) => (
                <Tr key={wf._id} selected={selectedIds.has(wf._id)}>
                  <Td align="center">
                    <Checkbox
                      checked={selectedIds.has(wf._id)}
                      onChange={() => toggleSelect(wf._id)}
                      aria-label={`Select ${wf.name}`}
                    />
                  </Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-0 font-normal text-[var(--st-text)] hover:underline"
                      onClick={() => router.push(`/dashboard/n8n/${wf._id}`)}
                    >
                      {wf.name}
                    </Button>
                  </Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="group gap-1.5 px-1"
                      title={wf.active ? 'Click to deactivate' : 'Click to activate'}
                      onClick={() => handleToggleActive(wf)}
                    >
                      <Badge tone={wf.active ? 'success' : 'neutral'} dot>
                        {wf.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {wf.active ? (
                        <ToggleRight className="h-4 w-4 text-[var(--st-status-ok)] opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-[var(--st-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                      )}
                    </Button>
                  </Td>
                  <Td className="text-[var(--st-text-secondary)]">{wf.nodes?.length ?? 0}</Td>
                  <Td className="text-[var(--st-text-secondary)]">{wf.executionsCount ?? 0}</Td>
                  <Td>
                    <Badge tone={runStatusTone(wf.lastRunStatus)}>
                      {runStatusLabel(wf.lastRunStatus)}
                    </Badge>
                    {wf.lastRunAt && (
                      <span className="ml-1.5 text-[11px] text-[var(--st-text-secondary)]">
                        {format(new Date(wf.lastRunAt), 'MMM d, HH:mm')}
                      </span>
                    )}
                  </Td>
                  <Td className="text-[11.5px] text-[var(--st-text-secondary)]">
                    {wf.updatedAt ? format(new Date(wf.updatedAt), 'MMM d, yyyy, HH:mm') : 'Not set'}
                  </Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton variant="ghost" label="Workflow actions" icon={Ellipsis} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          iconLeft={Pencil}
                          onClick={() => router.push(`/dashboard/n8n/${wf._id}`)}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem iconLeft={Play} onClick={() => handleToggleActive(wf)}>
                          {wf.active ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="danger"
                          iconLeft={Trash2}
                          onClick={() => handleDelete(wf._id, wf.name)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Workflow</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Field label="Workflow name">
              <Input
                placeholder="Workflow name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} loading={creating}>
              {creating ? 'Creating' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Templates dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-[var(--st-border)] flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Template Library
            </DialogTitle>
            <DialogDescription>
              Start quickly by cloning a pre-built n8n workflow template.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 bg-[var(--st-bg-muted)]/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className="flex flex-col bg-[var(--st-bg-secondary)] hover:border-[var(--st-accent)]/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <CardTitle>{template.name}</CardTitle>
                    <Badge tone="neutral" className="shrink-0">{template.nodes.length} nodes</Badge>
                  </div>
                  <CardDescription className="mb-6 flex-1">
                    {template.description}
                  </CardDescription>
                  <Button
                    variant="outline"
                    block
                    iconLeft={Copy}
                    loading={creating}
                    onClick={() => {
                      startCreating(async () => {
                        try {
                          const result = await createWorkflow({
                            name: template.name + ' (Clone)',
                            nodes: template.nodes as any,
                            connections: template.connections as any
                          });
                          setShowTemplates(false);
                          router.push(`/dashboard/n8n/${result._id}`);
                        } catch (err: unknown) {
                          toast({
                            title: 'Error',
                            description: err instanceof Error ? err.message : 'Failed to clone template.',
                            tone: 'danger',
                          });
                        }
                      });
                    }}
                  >
                    Use Template
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
