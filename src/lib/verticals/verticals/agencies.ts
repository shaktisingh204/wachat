/**
 * Agencies vertical — marketing, design and dev shops running multiple
 * client engagements. Tracks clients → projects → deliverables → invoices.
 */

import type { Vertical } from '../types';

export const AGENCIES_VERTICAL: Vertical = {
  id: 'agencies',
  name: 'Agencies',
  industry: 'Professional Services',
  icon: 'briefcase',
  description:
    'Project-centric workspace for digital agencies. Includes client portal, retainer ' +
    'management, time tracking and invoicing.',
  dataModel: {
    id: 'agencies',
    defaultTags: ['agency', 'services'],
    entities: [
      {
        name: 'client',
        label: 'Clients',
        stages: ['lead', 'proposal', 'active', 'paused', 'churned'],
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'website', label: 'Website', type: 'url' },
          { key: 'primary_contact', label: 'Primary Contact', type: 'string' },
          { key: 'email', label: 'Email', type: 'email', sensitive: true },
          { key: 'mrr', label: 'MRR', type: 'currency' },
          { key: 'health', label: 'Health', type: 'enum', options: ['green', 'yellow', 'red'] },
        ],
      },
      {
        name: 'project',
        label: 'Projects',
        stages: ['kickoff', 'discovery', 'execution', 'review', 'shipped'],
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'client_id', label: 'Client', type: 'reference', ref: 'client', required: true },
          { key: 'budget', label: 'Budget', type: 'currency' },
          { key: 'start_date', label: 'Start', type: 'date' },
          { key: 'end_date', label: 'End', type: 'date' },
          { key: 'status', label: 'Status', type: 'enum', options: ['active', 'on_hold', 'shipped'] },
        ],
      },
      {
        name: 'time_entry',
        label: 'Time Entries',
        fields: [
          { key: 'project_id', label: 'Project', type: 'reference', ref: 'project', required: true },
          { key: 'user_id', label: 'User', type: 'reference', ref: 'user', required: true },
          { key: 'hours', label: 'Hours', type: 'number', required: true },
          { key: 'billable', label: 'Billable', type: 'boolean' },
          { key: 'note', label: 'Note', type: 'text' },
          { key: 'date', label: 'Date', type: 'date' },
        ],
      },
      {
        name: 'invoice',
        label: 'Invoices',
        fields: [
          { key: 'invoice_no', label: 'Invoice #', type: 'string', required: true },
          { key: 'client_id', label: 'Client', type: 'reference', ref: 'client', required: true },
          { key: 'amount', label: 'Amount', type: 'currency', required: true },
          { key: 'status', label: 'Status', type: 'enum', options: ['draft', 'sent', 'paid', 'overdue'] },
          { key: 'due_date', label: 'Due', type: 'date' },
        ],
      },
    ],
  },
  sampleData: {
    client: [
      { name: 'Acme Co', website: 'https://acme.example', primary_contact: 'Naina', mrr: 250000, health: 'green' },
    ],
    project: [
      { name: 'Acme Brand Refresh', client_id: 'sample:1', budget: 800000, status: 'active' },
    ],
    time_entry: [
      { project_id: 'sample:1', user_id: 'sample:1', hours: 4.5, billable: true, date: '2026-04-20' },
    ],
    invoice: [
      { invoice_no: 'INV-1001', client_id: 'sample:1', amount: 250000, status: 'sent', due_date: '2026-05-01' },
    ],
  },
  baselineFlows: [
    {
      id: 'agencies.weekly-status',
      name: 'Weekly Status Update',
      description: 'Compile time entries and ship a Friday status email per active client.',
      trigger: 'cron:friday-1700',
      steps: ['aggregate:time_entries', 'compose:status', 'send_email:status', 'log:client_health'],
      category: 'comms',
    },
    {
      id: 'agencies.invoice-followup',
      name: 'Invoice Follow-up',
      description: 'Polite reminders at +3, +7, +14 days for unpaid invoices.',
      trigger: 'invoice.due_passed',
      steps: ['wait:3d', 'send_email:invoice-nudge', 'wait:4d', 'send_email:invoice-firm', 'wait:7d', 'create_task:owner'],
      category: 'finance',
    },
  ],
  dashboards: [
    {
      id: 'agencies.principal',
      name: 'Principal Dashboard',
      audience: 'owner',
      widgets: [
        { id: 'mrr', type: 'kpi', title: 'MRR', source: 'clients.mrr_total', width: 3 },
        { id: 'utilisation', type: 'kpi', title: 'Team Utilisation', source: 'time.utilisation', width: 3 },
        { id: 'wip', type: 'kpi', title: 'WIP', source: 'projects.active', width: 3 },
        { id: 'ar', type: 'kpi', title: 'A/R Outstanding', source: 'invoices.ar_total', width: 3 },
        { id: 'health', type: 'table', title: 'Client Health', source: 'clients.health_table', width: 12 },
      ],
    },
  ],
  aiAgents: [
    {
      id: 'agencies.copilot',
      name: 'Agency Copilot',
      role: 'Draft client status updates and proposal sections from project data.',
      tools: ['projects.read', 'time.read', 'docs.compose'],
    },
  ],
  complianceHooks: [
    { id: 'gdpr.lawful-basis', reason: 'EU client outreach.', on: 'message' },
  ],
  messagingTemplates: [
    {
      id: 'agencies.invoice-nudge',
      channel: 'email',
      name: 'Invoice Nudge',
      body: 'Hi {{contact}}, just a friendly nudge that invoice {{invoice_no}} ({{amount}}) is past due.',
      variables: ['contact', 'invoice_no', 'amount'],
    },
    {
      id: 'agencies.status',
      channel: 'email',
      name: 'Weekly Status',
      body: 'Status for {{week}} on {{project}}: {{summary}}',
    },
  ],
  contractTemplates: [
    {
      id: 'agencies.msa',
      name: 'Master Services Agreement',
      body: 'This MSA between {{agency}} and {{client}} dated {{date}} governs all SOWs…',
      signers: ['agency', 'client'],
    },
    {
      id: 'agencies.sow',
      name: 'Statement of Work',
      body: 'SOW under MSA dated {{msa_date}} for {{project}}…',
      signers: ['agency', 'client'],
    },
  ],
  recommendedAddons: [
    { id: 'stripe', reason: 'Card-on-file invoicing.' },
    { id: 'slack', reason: 'Per-client comms channel.' },
  ],
};
