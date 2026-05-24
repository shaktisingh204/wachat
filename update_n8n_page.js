const fs = require('fs');

const path = 'src/app/dashboard/n8n/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Checkbox to zoruui imports
content = content.replace(
  'useZoruToast,\n} from \'@/components/zoruui\';',
  'useZoruToast,\n  Checkbox,\n} from \'@/components/zoruui\';'
);

// 2. Add lucide icons
content = content.replace(
  'Activity,\n  } from \'lucide-react\';',
  'Activity,\n  LayoutTemplate,\n  Copy,\n  CheckSquare,\n  Square,\n} from \'lucide-react\';'
);

// 3. Add actions
content = content.replace(
  'deactivateWorkflow,\n} from \'@/app/actions/n8n\';',
  'deactivateWorkflow,\n  bulkDeleteWorkflows,\n  bulkActivateWorkflows,\n  bulkDeactivateWorkflows,\n} from \'@/app/actions/n8n\';'
);

// 4. Add TEMPLATES array
const TEMPLATES_CODE = `
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
`;

content = content.replace('export default function N8NWorkflowListPage() {', TEMPLATES_CODE + '\nexport default function N8NWorkflowListPage() {');

// 5. Add state variables for templates and selected rows
content = content.replace(
  'const [creating, startCreating] = useTransition();',
  `const [creating, startCreating] = useTransition();
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionPending, startBulkAction] = useTransition();`
);

// 6. Bulk Action handlers
const BULK_ACTIONS_CODE = `
  const handleBulkDelete = () => {
    if (!confirm(\`Delete \${selectedIds.size} workflows? This cannot be undone.\`)) return;
    startBulkAction(async () => {
      try {
        await bulkDeleteWorkflows(Array.from(selectedIds));
        toast({ title: 'Deleted', description: \`\${selectedIds.size} workflows deleted.\` });
        setSelectedIds(new Set());
        fetchWorkflows();
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to delete workflows.', variant: 'destructive' });
      }
    });
  };

  const handleBulkActivate = () => {
    startBulkAction(async () => {
      try {
        await bulkActivateWorkflows(Array.from(selectedIds));
        toast({ title: 'Activated', description: \`\${selectedIds.size} workflows activated.\` });
        setSelectedIds(new Set());
        fetchWorkflows();
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to activate workflows.', variant: 'destructive' });
      }
    });
  };

  const handleBulkDeactivate = () => {
    startBulkAction(async () => {
      try {
        await bulkDeactivateWorkflows(Array.from(selectedIds));
        toast({ title: 'Deactivated', description: \`\${selectedIds.size} workflows deactivated.\` });
        setSelectedIds(new Set());
        fetchWorkflows();
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to deactivate workflows.', variant: 'destructive' });
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
`;
content = content.replace('const filtered = React.useMemo(() => {', BULK_ACTIONS_CODE + '\n  const filtered = React.useMemo(() => {');

// 7. Update button group in header
content = content.replace(
  '<Button onClick={() => setShowCreate(true)}>\n          <CirclePlus className="h-4 w-4" />\n          New workflow\n        </Button>',
  `<div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowTemplates(true)}>
            <LayoutTemplate className="h-4 w-4 mr-1.5" />
            Templates
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <CirclePlus className="h-4 w-4 mr-1.5" />
            New workflow
          </Button>
        </div>`
);

// 8. Add Bulk Action Bar above the table / search
const BULK_ACTION_BAR = `
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-zoru-surface border border-zoru-line rounded-md p-3 shadow-sm animate-in fade-in slide-in-from-top-2">
          <span className="text-[13px] font-medium text-zoru-ink">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-zoru-line mx-2" />
          <Button variant="outline" size="sm" onClick={handleBulkActivate} disabled={bulkActionPending}>
            <Play className="h-3.5 w-3.5 mr-1.5" /> Activate
          </Button>
          <Button variant="outline" size="sm" onClick={handleBulkDeactivate} disabled={bulkActionPending}>
            <CirclePause className="h-3.5 w-3.5 mr-1.5" /> Deactivate
          </Button>
          <Button variant="danger" size="sm" onClick={handleBulkDelete} disabled={bulkActionPending}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
          </Button>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} disabled={bulkActionPending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
`;

content = content.replace('{/* Search + list */}', '{/* Search + list */}\n' + BULK_ACTION_BAR);

// 9. Add checkbox in table head and rows
content = content.replace(
  '<th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-zoru-ink-muted">\n                  Name\n                </th>',
  `<th className="w-12 px-4 py-3">
                  <Checkbox 
                    checked={selectedIds.size === filtered.length && filtered.length > 0} 
                    onCheckedChange={toggleSelectAll} 
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  Name
                </th>`
);

content = content.replace(
  '<td className="px-4 py-3">\n                    <button',
  `<td className="px-4 py-3">
                    <Checkbox 
                      checked={selectedIds.has(wf._id)} 
                      onCheckedChange={() => toggleSelect(wf._id)} 
                      aria-label={\`Select \${wf.name}\`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button`
);

// 10. Add templates dialog at the end
const TEMPLATES_DIALOG = `
      {/* Templates dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <ZoruDialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <ZoruDialogHeader className="px-6 py-4 border-b border-zoru-line flex-shrink-0">
            <ZoruDialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-zoru-ink-muted" />
              Template Library
            </ZoruDialogTitle>
            <ZoruPageDescription>
              Start quickly by cloning a pre-built n8n workflow template.
            </ZoruPageDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto p-6 bg-zoru-surface-2/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEMPLATES.map(template => (
                <Card key={template.id} className="p-5 flex flex-col bg-zoru-surface hover:border-zoru-brand/50 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="font-semibold text-[15px] text-zoru-ink">{template.name}</h3>
                    <Badge variant="ghost" className="shrink-0">{template.nodes.length} nodes</Badge>
                  </div>
                  <p className="text-[13px] text-zoru-ink-muted mb-6 flex-1">
                    {template.description}
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    disabled={creating}
                    onClick={() => {
                      startCreating(async () => {
                        try {
                          const result = await createWorkflow({ 
                            name: template.name + ' (Clone)',
                            nodes: template.nodes as any,
                            connections: template.connections as any
                          });
                          setShowTemplates(false);
                          router.push(\`/dashboard/n8n/\${result._id}\`);
                        } catch (err: any) {
                          toast({ title: 'Error', description: err.message, variant: 'destructive' });
                        }
                      });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Use Template
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </ZoruDialogContent>
      </Dialog>
`;

content = content.replace('</Dialog>\n    </div>', '</Dialog>\n' + TEMPLATES_DIALOG + '\n    </div>');

fs.writeFileSync(path, content, 'utf8');
console.log('Update script completed.');
