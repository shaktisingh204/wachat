/**
 * Legal vertical — boutique law firms and in-house teams. Matter management,
 * client intake and engagement letters with privilege flags.
 */

import type { Vertical } from '../types';

export const LEGAL_VERTICAL: Vertical = {
  id: 'legal',
  name: 'Legal',
  industry: 'Legal Services',
  icon: 'scale',
  description:
    'Matter-centric workspace for law firms. Client intake, conflict checks, ' +
    'engagement letters and privileged document handling.',
  dataModel: {
    id: 'legal',
    defaultTags: ['legal', 'lawfirm', 'privileged'],
    entities: [
      {
        name: 'matter',
        label: 'Matters',
        stages: ['intake', 'conflict_check', 'engaged', 'active', 'on_hold', 'closed'],
        fields: [
          { key: 'matter_no', label: 'Matter #', type: 'string', required: true },
          { key: 'title', label: 'Title', type: 'string', required: true },
          { key: 'practice_area', label: 'Practice Area', type: 'enum', options: ['corporate', 'litigation', 'ip', 'employment', 'tax'] },
          { key: 'lead_attorney', label: 'Lead Attorney', type: 'reference', ref: 'user' },
          { key: 'opened_at', label: 'Opened', type: 'date' },
          { key: 'rate_card', label: 'Rate Card', type: 'string' },
          { key: 'privileged', label: 'Privileged', type: 'boolean' },
        ],
      },
      {
        name: 'client',
        label: 'Clients',
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true, sensitive: true },
          { key: 'entity_type', label: 'Entity Type', type: 'enum', options: ['individual', 'company', 'trust', 'gov'] },
          { key: 'email', label: 'Email', type: 'email', sensitive: true },
          { key: 'phone', label: 'Phone', type: 'phone', sensitive: true },
          { key: 'jurisdictions', label: 'Jurisdictions', type: 'text' },
          { key: 'kyc_passed', label: 'KYC Passed', type: 'boolean' },
        ],
      },
      {
        name: 'time_entry',
        label: 'Billable Time',
        fields: [
          { key: 'matter_id', label: 'Matter', type: 'reference', ref: 'matter', required: true },
          { key: 'attorney_id', label: 'Attorney', type: 'reference', ref: 'user', required: true },
          { key: 'hours', label: 'Hours', type: 'number', required: true },
          { key: 'rate', label: 'Rate', type: 'currency' },
          { key: 'narrative', label: 'Narrative', type: 'text', sensitive: true },
          { key: 'date', label: 'Date', type: 'date' },
        ],
      },
    ],
  },
  sampleData: {
    client: [
      { name: 'Acme Holdings Pvt Ltd', entity_type: 'company', email: 'legal@acme.example', kyc_passed: true, jurisdictions: 'IN, US-DE' },
    ],
    matter: [
      { matter_no: 'M-2026-0007', title: 'Series B Financing', practice_area: 'corporate', opened_at: '2026-03-10', privileged: true },
    ],
    time_entry: [
      { matter_id: 'sample:1', attorney_id: 'sample:1', hours: 2.4, rate: 18000, narrative: 'Reviewed term sheet', date: '2026-04-21' },
    ],
  },
  baselineFlows: [
    {
      id: 'legal.intake',
      name: 'Client Intake',
      description: 'Collect intake form, run conflict check, send engagement letter on pass.',
      trigger: 'client.created',
      steps: ['send_form:intake', 'wait_form_response', 'task:conflict_check', 'gate:approval', 'send_doc:engagement_letter'],
      category: 'intake',
    },
    {
      id: 'legal.matter-status',
      name: 'Matter Status Update',
      description: 'Send a monthly privileged-status update to the client contact.',
      trigger: 'cron:monthly-1st',
      steps: ['aggregate:time_entries', 'compose:privileged_status', 'send_email:status'],
      category: 'comms',
    },
  ],
  dashboards: [
    {
      id: 'legal.partner',
      name: 'Partner Dashboard',
      audience: 'owner',
      widgets: [
        { id: 'wip', type: 'kpi', title: 'Open Matters', source: 'matters.open', width: 3 },
        { id: 'billable', type: 'kpi', title: 'Billable Hours (MTD)', source: 'time.billable_mtd', width: 3 },
        { id: 'realisation', type: 'kpi', title: 'Realisation %', source: 'time.realisation', width: 3 },
        { id: 'ar', type: 'kpi', title: 'A/R', source: 'invoices.ar', width: 3 },
        { id: 'matter-table', type: 'table', title: 'Open Matters', source: 'matters.table_open', width: 12 },
      ],
    },
  ],
  aiAgents: [
    {
      id: 'legal.research-bot',
      name: 'Legal Research Assistant',
      role: 'Summarise cases and statutes for matters; never gives legal advice.',
      tools: ['kb.statutes', 'kb.cases', 'matters.read'],
    },
  ],
  complianceHooks: [
    { id: 'gdpr.lawful-basis', reason: 'EU client data is processed under lawful basis.', on: 'write' },
  ],
  messagingTemplates: [
    {
      id: 'legal.intake-link',
      channel: 'email',
      name: 'Intake Form Link',
      body: 'Dear {{client_name}}, please complete the intake form: {{form_url}}',
      variables: ['client_name', 'form_url'],
    },
  ],
  contractTemplates: [
    {
      id: 'legal.engagement-letter',
      name: 'Engagement Letter',
      body: 'This engagement letter between {{firm}} and {{client}} dated {{date}} for matter {{matter_no}}…',
      signers: ['firm', 'client'],
    },
    {
      id: 'legal.nda',
      name: 'Mutual NDA',
      body: 'This mutual NDA between {{party_a}} and {{party_b}} dated {{date}}…',
      signers: ['party_a', 'party_b'],
    },
  ],
  recommendedAddons: [
    { id: 'docusign', reason: 'E-signature for engagement letters.' },
    { id: 'data-fabric:privilege-vault', reason: 'Privileged document vault with WORM retention.', required: true },
  ],
};
