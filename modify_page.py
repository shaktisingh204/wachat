import re

with open('temp_page.tsx', 'r') as f:
    content = f.read()

# 1. Import Checkbox, bulk actions
content = content.replace('useZoruToast,\n}', 'useZoruToast,\n  Checkbox,\n}')
content = content.replace('deactivateWorkflow,\n} from \'@/app/actions/n8n\';', 'deactivateWorkflow,\n  bulkDeleteWorkflows,\n  bulkActivateWorkflows,\n  bulkDeactivateWorkflows,\n} from \'@/app/actions/n8n\';')

# 2. Add WORKFLOW_TEMPLATES
templates = """
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
"""
content = content.replace('export default function N8NWorkflowListPage() {', templates)


# 3. Add state and handlers
state_and_handlers = """
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
"""
# insert after const [creating, startCreating] = useTransition();
content = content.replace('const [creating, startCreating] = useTransition();', 'const [creating, startCreating] = useTransition();\n' + state_and_handlers)


# 4. Add templates UI
templates_ui = """
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
"""
content = content.replace('{/* Search + list */}', templates_ui)

# 5. Bulk actions UI
bulk_ui = """
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
"""

content = re.sub(r'<div className="flex items-center gap-3 p-4 border-b border-zoru-line">.*?</span>\s*</div>', bulk_ui, content, flags=re.DOTALL)

# 6. Table headers and body
th_checkbox = """
              <tr>
                <th className="px-4 py-3 text-left w-8">
                  <Checkbox 
                    checked={filtered.length > 0 && selectedIds.length === filtered.length ? true : selectedIds.length > 0 ? 'indeterminate' : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-zoru-ink-muted">
"""
content = content.replace('<tr>\n                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-zoru-ink-muted">', th_checkbox)

td_checkbox = """
                <tr key={wf._id} className="hover:bg-zoru-surface transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.includes(wf._id)}
                      onCheckedChange={() => toggleSelectOne(wf._id)}
                    />
                  </td>
                  <td className="px-4 py-3">
"""
content = content.replace('<tr key={wf._id} className="hover:bg-zoru-surface transition-colors">\n                  <td className="px-4 py-3">', td_checkbox)

with open('temp_page.tsx', 'w') as f:
    f.write(content)
