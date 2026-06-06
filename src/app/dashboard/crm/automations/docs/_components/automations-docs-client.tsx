'use client';

/**
 * <AutomationsDocsClient>
 *
 * Tabs:
 *  1. My Automations — table of rules, bulk enable/disable, export CSV
 *  2. Documentation — accordion of triggers + actions (static)
 *  3. Templates — grid of pre-built automation cards with "Use Template"
 */

import * as React from 'react';
import Link from 'next/link';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button, Card, Separator, StatCard, Table, TBody, Td, Th, THead, Tr, useToast, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/sabcrm/20ui';
import { Download, Loader2, Play, Pause, Plus, Trash2, X } from 'lucide-react';

import {
  listCrmAutomations,
  bulkAutomationAction,
  type CrmAutomationListItem,
  type CrmAutomationKpis,
} from '@/app/actions/crm-automations.actions';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

// A small hydration-safe date formatter
function safeFormatDate(dateStr: string | Date): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    // Use ISO string slice to ensure consistent SSR and CSR rendering.
    // E.g. "2024-03-12"
    return d.toISOString().split('T')[0];
  } catch {
    return String(dateStr);
  }
}

/* ── static docs data ───────────────────────────────────────────────────── */

interface BlockDoc {
  title: string;
  category: 'Trigger' | 'Action' | 'Logic';
  description: string;
  properties: Array<{ name: string; desc: string }>;
  outputs: string[];
}

const BLOCK_DOCS: BlockDoc[] = [
  {
    title: 'Trigger: Tag Added',
    category: 'Trigger',
    description:
      'Starts an automation when a specific tag is added to a contact or lead.',
    properties: [
      {
        name: 'Tag Name',
        desc: 'The exact name of the tag that should fire this workflow (e.g., "new_lead").',
      },
    ],
    outputs: ['One main output that connects to the first action.'],
  },
  {
    title: 'Trigger: Status Changed',
    category: 'Trigger',
    description:
      'Fires when a record moves to a specific pipeline stage or status value.',
    properties: [
      { name: 'Entity Type', desc: 'The CRM entity to watch — Lead, Deal, Invoice, etc.' },
      { name: 'New Status', desc: 'The target status that triggers the workflow.' },
    ],
    outputs: ['One main output.'],
  },
  {
    title: 'Trigger: Form Submitted',
    category: 'Trigger',
    description: 'Fires when a visitor submits a tracked CRM web form.',
    properties: [
      { name: 'Form ID', desc: 'Select the specific form to watch.' },
    ],
    outputs: ['One main output with the submitted contact data.'],
  },
  {
    title: 'Trigger: Date Reached',
    category: 'Trigger',
    description: 'Fires on a calendar date stored in a field (e.g., renewal date, due date).',
    properties: [
      { name: 'Date Field', desc: 'The date field to watch (e.g., contract_renewal_date).' },
      { name: 'Offset', desc: 'Trigger X days before or after the date.' },
    ],
    outputs: ['One main output.'],
  },
  {
    title: 'Action: Send Email',
    category: 'Action',
    description: 'Sends a pre-defined email template to the contact or a custom address.',
    properties: [
      {
        name: 'Email Template',
        desc: 'Select one of your saved email templates. Templates are managed in CRM Settings.',
      },
      { name: 'To', desc: 'Defaults to {{contact.email}}. Override with any static address.' },
    ],
    outputs: ['One main output to continue the flow after the email is sent.'],
  },
  {
    title: 'Action: Send WhatsApp',
    category: 'Action',
    description: 'Sends a WhatsApp message via the connected SabWa personal account.',
    properties: [
      { name: 'Phone', desc: 'The recipient phone number. Use {{contact.phone}} to personalise.' },
      { name: 'Message', desc: 'The message text. Supports {{contact.*}} variables.' },
    ],
    outputs: ['One main output.'],
  },
  {
    title: 'Action: Create Task',
    category: 'Action',
    description: 'Creates a new task and optionally assigns it to a team member.',
    properties: [
      {
        name: 'Task Title',
        desc: 'The task title. Use {{contact.name}} or {{deal.title}} to personalise.',
      },
      { name: 'Assign To', desc: 'Optional. Select a user or use {{current_user}}.' },
      { name: 'Due In', desc: 'Number of days from "now" for the due date.' },
    ],
    outputs: ['One main output.'],
  },
  {
    title: 'Action: Add Tag',
    category: 'Action',
    description: 'Adds one or more tags to the contact without removing existing ones.',
    properties: [{ name: 'Tag Name', desc: 'Comma-separated list of tags to add.' }],
    outputs: ['One main output.'],
  },
  {
    title: 'Action: Remove Tag',
    category: 'Action',
    description: 'Removes a specific tag from the contact.',
    properties: [{ name: 'Tag Name', desc: 'The tag to remove.' }],
    outputs: ['One main output.'],
  },
  {
    title: 'Action: Update Field',
    category: 'Action',
    description: 'Sets a field on the contact or deal to a new value.',
    properties: [
      { name: 'Field', desc: 'The field to update (e.g., status, owner_id).' },
      { name: 'Value', desc: 'The new value. Supports static or {{variable}} syntax.' },
    ],
    outputs: ['One main output.'],
  },
  {
    title: 'Add Delay',
    category: 'Logic',
    description: 'Pauses the automation for a configured duration before continuing.',
    properties: [
      {
        name: 'Delay Duration',
        desc: 'Number of minutes, hours, or days to wait before the next step.',
      },
    ],
    outputs: ['One main output after the delay expires.'],
  },
  {
    title: 'Add Condition',
    category: 'Logic',
    description: 'Creates a branching path based on contact or deal field values.',
    properties: [
      { name: 'Check Variable', desc: 'The field to check (e.g., {{contact.status}}).' },
      {
        name: 'Operator',
        desc: 'Comparison: Equals, Not Equals, Contains, Greater Than, Less Than, Is Empty.',
      },
      { name: 'Value', desc: 'The value to compare against.' },
    ],
    outputs: ['Yes: condition is true.', 'No: condition is false.'],
  },
];

const VARIABLES_DOC = {
  contact: ['name', 'email', 'phone', 'company', 'status', 'owner_id'],
  deal: ['title', 'value', 'stage', 'close_date'],
  invoice: ['number', 'total', 'due_date', 'status'],
  system: ['current_user', 'today', 'now'],
};

/* ── automation templates ────────────────────────────────────────────────── */

interface AutomationTemplate {
  id: string;
  title: string;
  description: string;
  trigger: string;
  actionsCount: number;
  tags: string[];
}

const TEMPLATES: AutomationTemplate[] = [
  {
    id: 'tpl-new-lead-welcome',
    title: 'New Lead Welcome Sequence',
    description:
      'Automatically sends a welcome email + WhatsApp message when a new lead is tagged.',
    trigger: 'Tag Added',
    actionsCount: 3,
    tags: ['lead', 'email', 'whatsapp'],
  },
  {
    id: 'tpl-abandoned-cart',
    title: 'Abandoned Cart Recovery',
    description:
      'Sends a reminder email to customers who left items in their cart.',
    trigger: 'Status Changed',
    actionsCount: 2,
    tags: ['deal', 'email'],
  },
  {
    id: 'tpl-deal-won-onboard',
    title: 'Deal Won → Onboarding Task',
    description:
      'Creates an onboarding task and updates the contact status when a deal moves to "Won".',
    trigger: 'Status Changed',
    actionsCount: 2,
    tags: ['deal', 'task'],
  },
  {
    id: 'tpl-invoice-overdue',
    title: 'Invoice Overdue Reminder',
    description:
      'Sends a payment reminder email and WhatsApp 3 days after an invoice due date passes.',
    trigger: 'Date Reached',
    actionsCount: 2,
    tags: ['invoice', 'email', 'whatsapp'],
  },
  {
    id: 'tpl-contract-renewal',
    title: 'Contract Renewal Alert',
    description:
      'Notifies the account owner and creates a follow-up task 30 days before contract renewal.',
    trigger: 'Date Reached',
    actionsCount: 3,
    tags: ['contract', 'task', 'email'],
  },
  {
    id: 'tpl-form-lead-nurture',
    title: 'Form Submission → Lead Nurture',
    description:
      'Converts a form submission into a lead, adds a tag, and starts a 3-step email drip.',
    trigger: 'Form Submitted',
    actionsCount: 4,
    tags: ['lead', 'email', 'form'],
  },
  {
    id: 'tpl-idle-lead-reactivate',
    title: 'Idle Lead Re-engagement',
    description:
      'Adds a re-engage tag and sends a check-in message to leads with no activity in 30 days.',
    trigger: 'Date Reached',
    actionsCount: 2,
    tags: ['lead', 'whatsapp'],
  },
];

/* ── props ────────────────────────────────────────────────────────────────── */

export interface AutomationsDocsClientProps {
  kpis: CrmAutomationKpis;
  initialAutomations: CrmAutomationListItem[];
  initialTotal: number;
}

/* ── component ────────────────────────────────────────────────────────────── */

export function AutomationsDocsClient({
  kpis,
  initialAutomations,
  initialTotal,
}: AutomationsDocsClientProps): React.JSX.Element {
  const { toast } = useToast();

  /* ── my-automations state ────────────────────────────────────────────── */
  const [automations, setAutomations] = React.useState(initialAutomations);
  const [total, setTotal] = React.useState(initialTotal);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = React.useState(false);

  const loadPage = React.useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await listCrmAutomations(p, 20);
      setAutomations(result.items);
      setTotal(result.total);
      setPage(p);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelect = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    if (selected.size === automations.length) setSelected(new Set());
    else setSelected(new Set(automations.map((a) => a._id)));
  }, [selected.size, automations]);

  const handleBulk = React.useCallback(
    async (op: 'activate' | 'pause' | 'delete') => {
      if (selected.size === 0) return;
      setBulkWorking(true);
      try {
        const result = await bulkAutomationAction([...selected], op);
        if (result.error) {
          toast({ title: 'Failed', description: result.error, variant: 'destructive' });
        } else {
          toast({ title: `${result.processed ?? selected.size} automation(s) ${op}d` });
          void loadPage(page);
        }
      } finally {
        setBulkWorking(false);
      }
    },
    [selected, page, loadPage, toast],
  );

  const exportCsv = React.useCallback(() => {
    const headers = ['Name', 'Trigger', 'Actions', 'Status', 'Last run', 'Run count'];
    const rows = automations.map((a) => [
      a.name,
      a.trigger ?? '',
      String(a.actionsCount ?? 0),
      a.isActive ? 'active' : 'paused',
      a.lastRunAt ? safeFormatDate(a.lastRunAt) : '',
      String(a.runCount ?? 0),
    ]);
    downloadCsv(`automations-${dateStamp()}.csv`, headers, rows);
  }, [automations]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col gap-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total rules" value={String(kpis.total)} />
        <StatCard label="Active rules" value={String(kpis.active)} />
        <StatCard label="Triggers fired today" value={String(kpis.executionsToday)} />
        <StatCard
          label="Actions executed today"
          value={String(kpis.executionsToday)}
        />
      </div>

      <Tabs defaultValue="automations">
        <TabsList>
          <TabsTrigger value="automations">My Automations</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* ── My Automations tab ──────────────────────────────────────── */}
        <TabsContent value="automations" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] text-[var(--st-text-secondary)]">
              {total.toLocaleString()} automation{total !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button size="sm" asChild>
                <Link href="/dashboard/crm/automations/new">
                  <Plus className="h-3.5 w-3.5" /> New automation
                </Link>
              </Button>
            </div>
          </div>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2">
              <span className="text-[12.5px] text-[var(--st-text)]">{selected.size} selected</span>
              <Button
                size="sm"
                onClick={() => void handleBulk('activate')}
                disabled={bulkWorking}
              >
                {bulkWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Enable
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleBulk('pause')}
                disabled={bulkWorking}
              >
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleBulk('delete')}
                disabled={bulkWorking}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          )}

          <Card className="overflow-hidden p-0">
            {loading ? (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--st-text-secondary)]" />
              </div>
            ) : automations.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-[13px] text-[var(--st-text-secondary)]">
                  No automations yet.{' '}
                  <Link
                    href="/dashboard/crm/automations/new"
                    className="text-[var(--st-text)] hover:underline"
                  >
                    Create your first automation
                  </Link>
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr className="hover:bg-transparent">
                      <Th className="w-8">
                        <input
                          type="checkbox"
                          checked={
                            selected.size === automations.length && automations.length > 0
                          }
                          onChange={toggleAll}
                          className="h-3.5 w-3.5"
                        />
                      </Th>
                      <Th>Name</Th>
                      <Th>Trigger</Th>
                      <Th>Actions</Th>
                      <Th>Status</Th>
                      <Th>Last run</Th>
                      <Th>Run count</Th>
                      <Th />
                    </Tr>
                  </THead>
                  <TBody>
                    {automations.map((a) => (
                      <Tr key={a._id}>
                        <Td>
                          <input
                            type="checkbox"
                            checked={selected.has(a._id)}
                            onChange={() => toggleSelect(a._id)}
                            className="h-3.5 w-3.5"
                          />
                        </Td>
                        <Td className="text-[13px] font-medium text-[var(--st-text)]">
                          <Link
                            href={`/dashboard/crm/automations/${a._id}`}
                            className="hover:underline"
                          >
                            {a.name}
                          </Link>
                        </Td>
                        <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                          {a.trigger ?? '—'}
                        </Td>
                        <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                          {a.actionsCount ?? 0}
                        </Td>
                        <Td>
                          {a.isActive ? (
                            <Badge variant="success" className="text-[11px]">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[11px]">Paused</Badge>
                          )}
                        </Td>
                        <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                          {a.lastRunAt ? safeFormatDate(a.lastRunAt) : '—'}
                        </Td>
                        <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                          {a.runCount ?? 0}
                        </Td>
                        <Td>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/dashboard/crm/automations/${a._id}/edit`}>Edit</Link>
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </Card>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] text-[var(--st-text-secondary)]">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => void loadPage(page - 1)}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => void loadPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Documentation tab ───────────────────────────────────────── */}
        <TabsContent value="docs" className="mt-4 space-y-6">
          {/* Variables section */}
          <Card>
            <div className="mb-4">
              <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Using Variables</h2>
              <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                Variables let you personalise automations using live CRM data. Use double
                curly braces:{' '}
                <Badge variant="ghost" className="font-mono">
                  {'{{contact.name}}'}
                </Badge>
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(VARIABLES_DOC).map(([ns, fields]) => (
                <div key={ns}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                    {ns}
                  </p>
                  <ul className="space-y-1">
                    {fields.map((f) => (
                      <li key={f}>
                        <Badge variant="ghost" className="font-mono text-[11px]">
                          {`{{${ns}.${f}}}`}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          <Separator />

          <div>
            <h2 className="text-[18px] font-bold text-[var(--st-text)]">Automation Blocks</h2>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
              All available triggers, actions, and logic nodes.
            </p>
          </div>

          {/* Triggers */}
          <div>
            <h3 className="mb-2 text-[14px] font-semibold text-[var(--st-text)]">Triggers</h3>
            <Accordion type="multiple" className="w-full">
              {BLOCK_DOCS.filter((d) => d.category === 'Trigger').map((doc, idx) => (
                <AccordionItem value={`trigger-${idx}`} key={idx}>
                  <AccordionTrigger className="text-[14px] font-semibold">
                    {doc.title}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-1">
                    <p className="text-[13px] text-[var(--st-text-secondary)]">{doc.description}</p>
                    <div>
                      <p className="mb-1 text-[12px] font-semibold text-[var(--st-text)]">
                        Properties
                      </p>
                      <ul className="space-y-1 text-[12.5px]">
                        {doc.properties.map((p) => (
                          <li key={p.name}>
                            <span className="font-medium">{p.name}:</span> {p.desc}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-[12px] font-semibold text-[var(--st-text)]">Outputs</p>
                      <ul className="space-y-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                        {doc.outputs.map((o) => (
                          <li key={o}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Actions */}
          <div>
            <h3 className="mb-2 text-[14px] font-semibold text-[var(--st-text)]">Actions</h3>
            <Accordion type="multiple" className="w-full">
              {BLOCK_DOCS.filter((d) => d.category === 'Action').map((doc, idx) => (
                <AccordionItem value={`action-${idx}`} key={idx}>
                  <AccordionTrigger className="text-[14px] font-semibold">
                    {doc.title}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-1">
                    <p className="text-[13px] text-[var(--st-text-secondary)]">{doc.description}</p>
                    <div>
                      <p className="mb-1 text-[12px] font-semibold text-[var(--st-text)]">
                        Properties
                      </p>
                      <ul className="space-y-1 text-[12.5px]">
                        {doc.properties.map((p) => (
                          <li key={p.name}>
                            <span className="font-medium">{p.name}:</span> {p.desc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Logic */}
          <div>
            <h3 className="mb-2 text-[14px] font-semibold text-[var(--st-text)]">Logic</h3>
            <Accordion type="multiple" className="w-full">
              {BLOCK_DOCS.filter((d) => d.category === 'Logic').map((doc, idx) => (
                <AccordionItem value={`logic-${idx}`} key={idx}>
                  <AccordionTrigger className="text-[14px] font-semibold">
                    {doc.title}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-1">
                    <p className="text-[13px] text-[var(--st-text-secondary)]">{doc.description}</p>
                    <div>
                      <p className="mb-1 text-[12px] font-semibold text-[var(--st-text)]">
                        Properties
                      </p>
                      <ul className="space-y-1 text-[12.5px]">
                        {doc.properties.map((p) => (
                          <li key={p.name}>
                            <span className="font-medium">{p.name}:</span> {p.desc}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-[12px] font-semibold text-[var(--st-text)]">Outputs</p>
                      <ul className="space-y-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                        {doc.outputs.map((o) => (
                          <li key={o}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </TabsContent>

        {/* ── Templates tab ───────────────────────────────────────────── */}
        <TabsContent value="templates" className="mt-4">
          <div className="mb-4">
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Pre-built templates</h2>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
              Start from a working automation and customise it for your workflow.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((tpl) => (
              <Card key={tpl.id} className="flex flex-col gap-3 p-4">
                <div className="flex-1">
                  <h3 className="text-[14px] font-semibold text-[var(--st-text)]">{tpl.title}</h3>
                  <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">{tpl.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="outline" className="text-[11px]">
                    Trigger: {tpl.trigger}
                  </Badge>
                  <Badge variant="secondary" className="text-[11px]">
                    {tpl.actionsCount} action{tpl.actionsCount !== 1 ? 's' : ''}
                  </Badge>
                  {tpl.tags.map((tag) => (
                    <Badge key={tag} variant="ghost" className="text-[11px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/crm/automations/new?template=${tpl.id}`}>
                    Use template
                  </Link>
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
