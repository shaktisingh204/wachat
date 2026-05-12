/**
 * Unified node-documentation registry for SabFlow.
 *
 * Keyed by either a block `type` (e.g. `text`, `webhook`, `condition`) or a
 * trigger `appEvent` (e.g. `whatsapp_message_received`, `contact_created`).
 *
 * Used by:
 *   • TriggerEventSettings  — to render the "About this trigger" docs section
 *   • BlockSettingsPanel    — to render the "About this step" docs section
 *   • /dashboard/sabflow/docs — to render the full node catalog
 *
 * Doc entries are intentionally short — 1-3 sentence overview, a few field
 * notes, a few outputs/variables, and an example use case. Long-form guides
 * belong elsewhere; this is the in-product reference.
 */

export type NodeDocField = {
  /** Field name as shown in the settings panel. */
  name: string;
  /** What the field does. */
  description: string;
  /** Marked when omission breaks the node. */
  required?: boolean;
  /** Default value if the user leaves the field empty. */
  defaultValue?: string;
};

export type NodeDocOutput = {
  /** Variable token (e.g. `{{$trigger.contact.email}}`). */
  token: string;
  description: string;
};

export type NodeDoc = {
  /** Human-readable label — usually matches the block/trigger label. */
  label: string;
  /** Section the node belongs to in the docs page. */
  section:
    | 'trigger.general'
    | 'trigger.whatsapp'
    | 'trigger.calls'
    | 'trigger.crm'
    | 'trigger.broadcasts'
    | 'trigger.templates'
    | 'trigger.social'
    | 'trigger.email-sms'
    | 'trigger.payments'
    | 'trigger.orders'
    | 'trigger.seo'
    | 'trigger.integrations'
    | 'block.bubbles'
    | 'block.inputs'
    | 'block.logic'
    | 'block.integrations'
    | 'block.forge';
  /** 1-3 sentence summary shown at the top of the docs surface. */
  summary: string;
  /** When this trigger fires — only set for trigger entries. */
  whenItFires?: string;
  /** What this step does — only set for block entries. */
  whatItDoes?: string;
  /** Key settings the user configures. */
  fields?: NodeDocField[];
  /** Variables / outputs the step exposes to downstream nodes. */
  outputs?: NodeDocOutput[];
  /** Short example scenarios. */
  examples?: string[];
  /** Common gotchas / things to know. */
  notes?: string[];
};

/* ──────────────────────────────────────────────────────────────────────── */
/*  Shared output token sets (keep in sync with samplePayloads.ts)         */
/* ──────────────────────────────────────────────────────────────────────── */

const OUT_TRIGGER_GENERIC: NodeDocOutput[] = [
  { token: '{{$trigger}}', description: 'Full inbound payload as JSON.' },
  { token: '{{$execution.id}}', description: 'Unique ID for this run.' },
];

const OUT_CONTACT: NodeDocOutput[] = [
  { token: '{{$trigger.contact.id}}', description: 'CRM contact ID.' },
  { token: '{{$trigger.contact.name}}', description: 'Contact display name.' },
  { token: '{{$trigger.contact.email}}', description: 'Contact email.' },
  { token: '{{$trigger.contact.phone}}', description: 'Contact phone (E.164).' },
  { token: '{{$trigger.contact.tags}}', description: 'Array of tag strings.' },
];

const OUT_DEAL: NodeDocOutput[] = [
  { token: '{{$trigger.deal.id}}', description: 'Deal ID.' },
  { token: '{{$trigger.deal.value}}', description: 'Numeric deal value.' },
  { token: '{{$trigger.deal.currency}}', description: 'Currency code.' },
  { token: '{{$trigger.deal.stageId}}', description: 'Current pipeline stage ID.' },
];

const OUT_LEAD: NodeDocOutput[] = [
  { token: '{{$trigger.lead.id}}', description: 'Lead ID.' },
  { token: '{{$trigger.lead.email}}', description: 'Lead email.' },
  { token: '{{$trigger.lead.status}}', description: 'Lead status (new / contacted / …).' },
  { token: '{{$trigger.lead.source}}', description: 'Attribution source.' },
];

const OUT_INVOICE: NodeDocOutput[] = [
  { token: '{{$trigger.invoice.id}}', description: 'Invoice ID.' },
  { token: '{{$trigger.invoice.amount}}', description: 'Invoice total.' },
  { token: '{{$trigger.invoice.status}}', description: 'Invoice status.' },
];

const OUT_WA_MESSAGE: NodeDocOutput[] = [
  { token: '{{$trigger.message.from}}', description: 'Sender WhatsApp ID.' },
  { token: '{{$trigger.message.text.body}}', description: 'Text body for text messages.' },
  { token: '{{$trigger.message.type}}', description: 'Message type (text / image / …).' },
  { token: '{{$trigger.contact.name}}', description: 'Sender profile name.' },
];

const OUT_CALL: NodeDocOutput[] = [
  { token: '{{$trigger.call.id}}', description: 'Call ID.' },
  { token: '{{$trigger.call.from}}', description: 'Caller number.' },
  { token: '{{$trigger.call.direction}}', description: 'inbound / outbound.' },
];

/* ──────────────────────────────────────────────────────────────────────── */
/*  Registry                                                                */
/* ──────────────────────────────────────────────────────────────────────── */

export const NODE_DOCS: Record<string, NodeDoc> = {
  /* ── Generic triggers ─────────────────────────────────────────────── */
  flow_start: {
    label: 'When the flow starts',
    section: 'trigger.general',
    summary: 'Default entry point — fires every time the flow is executed.',
    whenItFires: 'On every flow run, regardless of source. Use this when downstream steps determine how the flow runs (manual, embed, link).',
    outputs: OUT_TRIGGER_GENERIC,
    examples: ['Embedded chatbot on a website that always starts from a greeting.'],
  },
  manual_trigger: {
    label: 'Trigger manually',
    section: 'trigger.general',
    summary: 'Runs the flow when a user clicks the "Run" button in the editor or hits the manual API.',
    whenItFires: 'On manual invocation. Sample payload is used as $trigger data.',
    fields: [
      { name: 'Sample payload', description: 'JSON used as $trigger when running manually. Lets you simulate realistic input.', defaultValue: '{}' },
    ],
    outputs: OUT_TRIGGER_GENERIC,
    examples: ['Internal one-off automation that an operator launches from the dashboard.'],
  },
  on_schedule: {
    label: 'On a schedule',
    section: 'trigger.general',
    summary: 'Fires on a recurring cron schedule.',
    whenItFires: 'At each tick of the cron expression in the configured timezone.',
    fields: [
      { name: 'Cron expression', description: 'Five-field cron (minute, hour, day-of-month, month, day-of-week).', required: true, defaultValue: '0 9 * * 1-5' },
      { name: 'Timezone', description: 'IANA timezone (e.g. Asia/Kolkata). Defaults to UTC.', defaultValue: 'UTC' },
    ],
    outputs: [
      { token: '{{$trigger.firedAt}}', description: 'ISO timestamp the cron tick fired at.' },
      { token: '{{$trigger.cron}}', description: 'The cron expression that fired this run.' },
    ],
    examples: ['Send a daily 9am sales digest to the team.'],
    notes: ['Cron times are evaluated in the configured timezone. Daylight saving transitions follow the IANA database.'],
  },
  on_webhook: {
    label: 'On webhook call',
    section: 'trigger.general',
    summary: 'Public HTTP endpoint that fires the flow when called.',
    whenItFires: 'On every HTTP request matching the configured method on the webhook URL.',
    fields: [
      { name: 'Path', description: 'Public path under /api/sabflow/webhook.' },
      { name: 'Method', description: 'HTTP method to accept. ANY accepts all.', defaultValue: 'POST' },
      { name: 'Authentication', description: 'Optional header / basic auth / query auth.', defaultValue: 'none' },
      { name: 'Response mode', description: 'Immediately, last node output, or from a dedicated Response node.' },
      { name: 'Filters', description: 'Optional payload filters — drop requests that do not match.' },
    ],
    outputs: [
      { token: '{{$trigger.body}}', description: 'Parsed request body.' },
      { token: '{{$trigger.headers}}', description: 'Request headers.' },
      { token: '{{$trigger.query}}', description: 'Query parameters.' },
      { token: '{{$trigger.method}}', description: 'HTTP method.' },
    ],
    examples: ['Receive payment confirmations from a third-party processor.'],
    notes: ['Use authentication for production webhooks — open endpoints are public.'],
  },
  on_error: {
    label: 'On error',
    section: 'trigger.general',
    summary: 'Fires when another flow throws an unhandled error.',
    whenItFires: 'When a referencing flow fails — useful for centralised alerts.',
    outputs: [
      { token: '{{$trigger.flowId}}', description: 'ID of the flow that failed.' },
      { token: '{{$trigger.executionId}}', description: 'Execution that errored.' },
      { token: '{{$trigger.error.message}}', description: 'Error message.' },
      { token: '{{$trigger.error.code}}', description: 'Error code if available.' },
    ],
    examples: ['Send a Slack alert whenever any flow fails.'],
  },

  /* ── WhatsApp triggers ───────────────────────────────────────────── */
  whatsapp_message_received: {
    label: 'New WhatsApp message',
    section: 'trigger.whatsapp',
    summary: 'A contact sends an inbound WhatsApp message on a connected number.',
    whenItFires: 'On every inbound message webhook delivered by Meta.',
    fields: [
      { name: 'Phone number ID', description: 'Limit to messages on a specific WABA number.' },
      { name: 'From contact', description: 'Match only when the message is from a specific contact.' },
      { name: 'Message type', description: 'Restrict to text, image, video, interactive, etc.' },
      { name: 'Text contains', description: 'Fire only when the message text contains a keyword.' },
    ],
    outputs: OUT_WA_MESSAGE,
    examples: ['Auto-reply with FAQ answers when message contains "pricing".', 'Open a CRM ticket for every inbound media message.'],
  },
  whatsapp_message_read: {
    label: 'Message read',
    section: 'trigger.whatsapp',
    summary: 'A user opens and reads a message you sent.',
    whenItFires: 'When Meta delivers a "read" status webhook for an outbound message.',
    outputs: [
      { token: '{{$trigger.status.id}}', description: 'Message ID that was read.' },
      { token: '{{$trigger.status.recipientId}}', description: 'WhatsApp ID of the reader.' },
    ],
    examples: ['Mark a CRM activity as "delivered → read" for read-receipt analytics.'],
  },
  whatsapp_message_failed: {
    label: 'Message delivery failed',
    section: 'trigger.whatsapp',
    summary: 'A sent message bounces or is rejected before delivery.',
    whenItFires: 'On the failure status callback from Meta.',
    outputs: [
      { token: '{{$trigger.status.errors}}', description: 'Array of error objects from Meta.' },
      { token: '{{$trigger.status.recipientId}}', description: 'Intended recipient WA ID.' },
    ],
    examples: ['Route failed sends to a retry queue or notify the agent.'],
  },
  whatsapp_template_approved: {
    label: 'Template approved',
    section: 'trigger.whatsapp',
    summary: 'A submitted WhatsApp template is approved by Meta.',
    whenItFires: 'On the template status callback when status becomes APPROVED.',
    outputs: [
      { token: '{{$trigger.name}}', description: 'Template name.' },
      { token: '{{$trigger.language}}', description: 'Template locale.' },
    ],
    examples: ['Auto-enable a broadcast campaign once its template clears review.'],
  },
  whatsapp_template_rejected: {
    label: 'Template rejected',
    section: 'trigger.whatsapp',
    summary: 'Meta rejects a submitted template, with a reason.',
    whenItFires: 'When status becomes REJECTED.',
    outputs: [
      { token: '{{$trigger.name}}', description: 'Template name.' },
      { token: '{{$trigger.rejectionReason}}', description: 'Meta-provided reason code.' },
    ],
    examples: ['Notify the marketing channel and pause the broadcast that referenced this template.'],
  },
  whatsapp_contact_opted_in: {
    label: 'Contact opted in',
    section: 'trigger.whatsapp',
    summary: 'A user sends RESUME (or equivalent) to re-subscribe.',
    whenItFires: 'On the opt-in webhook for any connected number.',
    outputs: [
      { token: '{{$trigger.contact.wa_id}}', description: 'Opted-in WhatsApp ID.' },
    ],
    examples: ['Welcome a returning user with a thank-you message.'],
  },
  whatsapp_contact_opted_out: {
    label: 'Contact opted out',
    section: 'trigger.whatsapp',
    summary: 'A user unsubscribes from messaging.',
    whenItFires: 'On the opt-out webhook (STOP keyword or block).',
    outputs: [
      { token: '{{$trigger.contact.wa_id}}', description: 'Opted-out WhatsApp ID.' },
      { token: '{{$trigger.reason}}', description: 'Stop reason.' },
    ],
    examples: ['Suppress this user from all future broadcast audiences.'],
  },
  whatsapp_phone_quality_updated: {
    label: 'Phone number quality changed',
    section: 'trigger.whatsapp',
    summary: 'Meta updates the quality rating (GREEN/YELLOW/RED) of a number.',
    whenItFires: 'On phone quality update webhook.',
    outputs: [
      { token: '{{$trigger.quality}}', description: 'New quality bucket.' },
      { token: '{{$trigger.previousQuality}}', description: 'Quality before this change.' },
    ],
    examples: ['Alert ops the moment quality drops to YELLOW or RED.'],
  },
  whatsapp_phone_verified: {
    label: 'Phone number verified',
    section: 'trigger.whatsapp',
    summary: 'Display-name verification is approved by Meta.',
    whenItFires: 'On the verification approval webhook.',
    outputs: [{ token: '{{$trigger.displayName}}', description: 'Verified display name.' }],
    examples: ['Auto-enable a green-tick campaign once verification completes.'],
  },
  whatsapp_account_violation: {
    label: 'Account violation detected',
    section: 'trigger.whatsapp',
    summary: 'A policy violation or warning is recorded on the WABA.',
    whenItFires: 'On Meta\'s account_alerts webhook with a violation severity.',
    outputs: [
      { token: '{{$trigger.violation}}', description: 'Violation code.' },
      { token: '{{$trigger.severity}}', description: 'HIGH / MEDIUM / LOW.' },
    ],
    examples: ['Escalate to the compliance team immediately.'],
  },
  whatsapp_account_disabled: {
    label: 'Account disabled',
    section: 'trigger.whatsapp',
    summary: 'The WABA is banned or disabled.',
    whenItFires: 'On the disable webhook from Meta.',
    outputs: [{ token: '{{$trigger.reason}}', description: 'Disable reason from Meta.' }],
    examples: ['Page the on-call engineer; pause all flows that depend on this number.'],
  },

  /* ── Calls triggers ──────────────────────────────────────────────── */
  call_incoming: {
    label: 'Incoming call',
    section: 'trigger.calls',
    summary: 'A contact initiates a WhatsApp voice call to your business.',
    whenItFires: 'On inbound call webhook from Meta.',
    outputs: OUT_CALL,
    examples: ['Route the call to an available agent based on contact tag.'],
  },
  call_outgoing_started: {
    label: 'Outgoing call started',
    section: 'trigger.calls',
    summary: 'Your business places a call to a contact.',
    whenItFires: 'On the outbound-call-started webhook.',
    outputs: OUT_CALL,
    examples: ['Log the activity in CRM the moment the agent dials.'],
  },
  call_answered: {
    label: 'Call answered',
    section: 'trigger.calls',
    summary: 'An incoming call is picked up.',
    whenItFires: 'On the call_answered webhook.',
    outputs: OUT_CALL,
    examples: ['Stop the missed-call follow-up sequence.'],
  },
  call_missed: {
    label: 'Missed call',
    section: 'trigger.calls',
    summary: 'An incoming call is not answered before the caller hangs up.',
    whenItFires: 'On the call_missed webhook.',
    outputs: OUT_CALL,
    examples: ['Send an automatic "Sorry we missed you" WhatsApp message.'],
  },
  call_completed: {
    label: 'Call completed',
    section: 'trigger.calls',
    summary: 'A call ends normally with both parties connected.',
    whenItFires: 'On call completion.',
    outputs: [
      ...OUT_CALL,
      { token: '{{$trigger.call.durationSec}}', description: 'Call duration in seconds.' },
    ],
    examples: ['Trigger a post-call CSAT survey via WhatsApp.'],
  },
  call_terminated: {
    label: 'Call terminated',
    section: 'trigger.calls',
    summary: 'A call ends for any reason — answered or missed.',
    whenItFires: 'On call termination, regardless of outcome.',
    outputs: OUT_CALL,
    examples: ['Update the agent\'s availability status.'],
  },
  calling_settings_updated: {
    label: 'Calling settings updated',
    section: 'trigger.calls',
    summary: 'Call hours, restrictions, or SIP config changed.',
    whenItFires: 'When a calling config update completes.',
    outputs: [{ token: '{{$trigger.settings}}', description: 'New settings object.' }],
    examples: ['Audit log every change to calling rules.'],
  },

  /* ── CRM Contacts ────────────────────────────────────────────────── */
  contact_created: {
    label: 'New contact created',
    section: 'trigger.crm',
    summary: 'A contact record is added to the CRM database.',
    whenItFires: 'On every contact create event (manual entry, import, API, integration).',
    outputs: OUT_CONTACT,
    examples: ['Send a personalised welcome WhatsApp message.', 'Auto-tag based on email domain.'],
  },
  contact_updated: {
    label: 'Contact updated',
    section: 'trigger.crm',
    summary: 'Name, phone, email, or tags on a contact change.',
    whenItFires: 'On any field change.',
    outputs: [
      ...OUT_CONTACT,
      { token: '{{$trigger.changedFields}}', description: 'Array of field names that changed.' },
    ],
    examples: ['Re-sync the contact to a connected mailing list.'],
  },
  contact_tagged: {
    label: 'Contact tagged',
    section: 'trigger.crm',
    summary: 'A contact is assigned a new tag or label.',
    whenItFires: 'When a tag is added or removed.',
    outputs: [
      ...OUT_CONTACT,
      { token: '{{$trigger.addedTags}}', description: 'Tags added in this event.' },
      { token: '{{$trigger.removedTags}}', description: 'Tags removed in this event.' },
    ],
    examples: ['Start a VIP onboarding sequence when "vip" is added.'],
  },
  contact_assigned: {
    label: 'Contact assigned',
    section: 'trigger.crm',
    summary: 'Ownership of a contact transfers to a different team member.',
    whenItFires: 'On owner change.',
    outputs: [
      ...OUT_CONTACT,
      { token: '{{$trigger.newOwnerId}}', description: 'New owner user ID.' },
      { token: '{{$trigger.previousOwnerId}}', description: 'Previous owner.' },
    ],
    examples: ['DM the new owner with an intro context summary.'],
  },
  contact_merged: {
    label: 'Contacts merged',
    section: 'trigger.crm',
    summary: 'Two duplicate contact records are consolidated.',
    whenItFires: 'On merge completion.',
    outputs: [
      { token: '{{$trigger.primary.id}}', description: 'Winning contact ID.' },
      { token: '{{$trigger.mergedIds}}', description: 'Array of merged-away IDs.' },
    ],
    examples: ['Audit-log the merge for compliance.'],
  },
  contact_imported: {
    label: 'Contacts imported',
    section: 'trigger.crm',
    summary: 'A CSV or file-based contact import completes.',
    whenItFires: 'When the import finishes (success or partial).',
    outputs: [
      { token: '{{$trigger.import.totalCount}}', description: 'Total rows in the import file.' },
      { token: '{{$trigger.import.successCount}}', description: 'Rows imported successfully.' },
      { token: '{{$trigger.import.errorCount}}', description: 'Rows that failed.' },
    ],
    examples: ['Email a completion summary to the importer.'],
  },
  account_created: {
    label: 'New account created',
    section: 'trigger.crm',
    summary: 'A company / organisation account is added to the CRM.',
    whenItFires: 'On account create event.',
    outputs: [
      { token: '{{$trigger.account.id}}', description: 'Account ID.' },
      { token: '{{$trigger.account.name}}', description: 'Account display name.' },
      { token: '{{$trigger.account.industry}}', description: 'Account industry.' },
    ],
    examples: ['Enrich the account with Clearbit data and tag based on size.'],
  },
  account_updated: {
    label: 'Account updated',
    section: 'trigger.crm',
    summary: 'Account details (name, industry, size) are modified.',
    whenItFires: 'On account update.',
    outputs: [
      { token: '{{$trigger.account.id}}', description: 'Account ID.' },
      { token: '{{$trigger.changedFields}}', description: 'Array of fields that changed.' },
    ],
    examples: ['Sync the change back to an external CRM of record.'],
  },
  contact_note_added: {
    label: 'Note added to contact',
    section: 'trigger.crm',
    summary: 'A team member leaves a note on a contact record.',
    whenItFires: 'On note create.',
    outputs: [
      { token: '{{$trigger.note.body}}', description: 'Note text.' },
      { token: '{{$trigger.note.authorId}}', description: 'User who wrote the note.' },
    ],
    examples: ['Tag the contact based on note keywords.'],
  },

  /* ── CRM Deals ───────────────────────────────────────────────────── */
  deal_created: {
    label: 'New deal created',
    section: 'trigger.crm',
    summary: 'A sales opportunity is added to a pipeline.',
    whenItFires: 'On deal create event.',
    outputs: OUT_DEAL,
    examples: ['Post to #sales on Slack so the team celebrates new pipeline.'],
  },
  deal_moved: {
    label: 'Deal moved to stage',
    section: 'trigger.crm',
    summary: 'A deal transitions between pipeline stages.',
    whenItFires: 'On stage change.',
    outputs: [
      ...OUT_DEAL,
      { token: '{{$trigger.previousStageId}}', description: 'Stage the deal moved from.' },
    ],
    examples: ['Send a contract on entering the "negotiation" stage.'],
  },
  deal_closed_won: {
    label: 'Deal closed — won',
    section: 'trigger.crm',
    summary: 'A deal is marked as completed and won.',
    whenItFires: 'On stage move to closed-won.',
    outputs: OUT_DEAL,
    examples: ['Provision the customer and email the finance team.'],
  },
  deal_closed_lost: {
    label: 'Deal closed — lost',
    section: 'trigger.crm',
    summary: 'A deal is marked as completed and lost.',
    whenItFires: 'On stage move to closed-lost.',
    outputs: [
      ...OUT_DEAL,
      { token: '{{$trigger.lostReason}}', description: 'Reason recorded by the rep.' },
    ],
    examples: ['Enroll the contact in a long-term nurture sequence.'],
  },
  deal_assigned: {
    label: 'Deal assigned',
    section: 'trigger.crm',
    summary: 'Deal ownership transfers to a team member.',
    whenItFires: 'On deal owner change.',
    outputs: [
      ...OUT_DEAL,
      { token: '{{$trigger.newOwnerId}}', description: 'New owner.' },
    ],
    examples: ['Notify the new owner with a quick deal brief.'],
  },
  deal_probability_updated: {
    label: 'Deal probability updated',
    section: 'trigger.crm',
    summary: 'Win probability percentage on a deal changes.',
    whenItFires: 'On probability edit.',
    outputs: [
      ...OUT_DEAL,
      { token: '{{$trigger.previousProbability}}', description: 'Probability before the change.' },
      { token: '{{$trigger.newProbability}}', description: 'Probability after the change.' },
    ],
    examples: ['Re-run the forecast model when high-value deals shift confidence.'],
  },
  deal_value_updated: {
    label: 'Deal value changed',
    section: 'trigger.crm',
    summary: 'Deal amount or currency is modified.',
    whenItFires: 'On value edit.',
    outputs: [
      ...OUT_DEAL,
      { token: '{{$trigger.previousValue}}', description: 'Old amount.' },
      { token: '{{$trigger.newValue}}', description: 'New amount.' },
    ],
    examples: ['Require approval when value increases above a threshold.'],
  },

  /* ── CRM Leads ───────────────────────────────────────────────────── */
  lead_created: {
    label: 'New lead created',
    section: 'trigger.crm',
    summary: 'A lead record is added to the pipeline.',
    whenItFires: 'On every lead create event.',
    outputs: OUT_LEAD,
    examples: ['Send the lead a WhatsApp greeting and assign to the round-robin queue.'],
  },
  lead_status_changed: {
    label: 'Lead status changed',
    section: 'trigger.crm',
    summary: 'A lead moves through pipeline stages.',
    whenItFires: 'On status field change.',
    outputs: [
      ...OUT_LEAD,
      { token: '{{$trigger.previousStatus}}', description: 'Status before the change.' },
    ],
    examples: ['Notify sales the moment status becomes "qualified".'],
  },
  lead_assigned: {
    label: 'Lead assigned',
    section: 'trigger.crm',
    summary: 'A lead is delegated to a sales representative.',
    whenItFires: 'On owner change.',
    outputs: [
      ...OUT_LEAD,
      { token: '{{$trigger.newOwnerId}}', description: 'New owner.' },
    ],
    examples: ['Page the new rep on Slack.'],
  },
  lead_converted: {
    label: 'Lead converted',
    section: 'trigger.crm',
    summary: 'A lead progresses to a sales opportunity.',
    whenItFires: 'On conversion to contact + deal.',
    outputs: [
      ...OUT_LEAD,
      { token: '{{$trigger.convertedTo.dealId}}', description: 'Created deal ID.' },
      { token: '{{$trigger.convertedTo.contactId}}', description: 'Created contact ID.' },
    ],
    examples: ['Move the new contact into a customer-onboarding journey.'],
  },
  lead_source_tracked: {
    label: 'Lead source recorded',
    section: 'trigger.crm',
    summary: 'Lead attribution is tracked (campaign, form, referral, …).',
    whenItFires: 'On attribution capture.',
    outputs: [
      ...OUT_LEAD,
      { token: '{{$trigger.attribution.campaign}}', description: 'Campaign name.' },
      { token: '{{$trigger.attribution.medium}}', description: 'Medium (whatsapp, ads, …).' },
      { token: '{{$trigger.attribution.source}}', description: 'Original source.' },
    ],
    examples: ['Feed the attribution to your analytics warehouse.'],
  },
  lead_follow_up_due: {
    label: 'Lead follow-up due',
    section: 'trigger.crm',
    summary: 'The next scheduled follow-up time arrives.',
    whenItFires: 'When the lead\'s follow-up date passes.',
    outputs: [
      ...OUT_LEAD,
      { token: '{{$trigger.followUp.scheduledAt}}', description: 'Scheduled follow-up time.' },
      { token: '{{$trigger.followUp.attempt}}', description: 'Attempt number.' },
    ],
    examples: ['Remind the owner via WhatsApp 15 minutes ahead.'],
  },

  /* ── Invoices / Quotations ───────────────────────────────────────── */
  invoice_created: {
    label: 'Invoice created',
    section: 'trigger.crm',
    summary: 'A sales invoice is generated for an account.',
    whenItFires: 'On invoice create.',
    outputs: OUT_INVOICE,
    examples: ['Auto-email the PDF to the customer.'],
  },
  invoice_sent: {
    label: 'Invoice sent',
    section: 'trigger.crm',
    summary: 'An invoice is delivered to a customer.',
    whenItFires: 'On send-success.',
    outputs: [
      ...OUT_INVOICE,
      { token: '{{$trigger.deliveryChannel}}', description: 'Where the invoice was sent (email, whatsapp).' },
    ],
    examples: ['Log the delivery in the accounting system.'],
  },
  invoice_marked_paid: {
    label: 'Invoice marked paid',
    section: 'trigger.crm',
    summary: 'An invoice payment is received and recorded.',
    whenItFires: 'On status change to paid.',
    outputs: OUT_INVOICE,
    examples: ['Send a receipt and thank-you on WhatsApp.'],
  },
  invoice_payment_received: {
    label: 'Payment received',
    section: 'trigger.crm',
    summary: 'A payment is processed against an outstanding invoice.',
    whenItFires: 'On payment capture.',
    outputs: [
      ...OUT_INVOICE,
      { token: '{{$trigger.payment.amount}}', description: 'Captured amount.' },
      { token: '{{$trigger.payment.method}}', description: 'Payment method (upi, card, …).' },
    ],
    examples: ['Reconcile the payment in the GL.'],
  },
  invoice_overdue: {
    label: 'Invoice overdue',
    section: 'trigger.crm',
    summary: 'An invoice due date passes without payment.',
    whenItFires: 'On the overdue schedule sweep.',
    outputs: [
      ...OUT_INVOICE,
      { token: '{{$trigger.daysOverdue}}', description: 'Days past due.' },
    ],
    examples: ['Send a polite reminder at days 1, 7 and 14.'],
  },
  payment_receipt_created: {
    label: 'Payment receipt created',
    section: 'trigger.crm',
    summary: 'A receipt is generated after payment collection.',
    whenItFires: 'On receipt create.',
    outputs: [{ token: '{{$trigger.receipt.id}}', description: 'Receipt ID.' }],
    examples: ['Push the receipt PDF to the customer.'],
  },
  quotation_created: {
    label: 'Quotation created',
    section: 'trigger.crm',
    summary: 'A quote is generated for a prospect.',
    whenItFires: 'On quotation create.',
    outputs: [
      { token: '{{$trigger.quotation.id}}', description: 'Quotation ID.' },
      { token: '{{$trigger.quotation.amount}}', description: 'Quotation amount.' },
    ],
    examples: ['Auto-send the quote PDF.'],
  },
  quotation_sent: {
    label: 'Quotation sent',
    section: 'trigger.crm',
    summary: 'A quote is delivered and shared with a customer.',
    whenItFires: 'On send success.',
    outputs: [{ token: '{{$trigger.quotation.id}}', description: 'Quotation ID.' }],
    examples: ['Schedule a follow-up task for the owning rep.'],
  },

  /* ── CRM Products / Inventory ────────────────────────────────────── */
  product_created: {
    label: 'Product added',
    section: 'trigger.crm',
    summary: 'A new SKU is added to the product catalog.',
    whenItFires: 'On product create.',
    outputs: [
      { token: '{{$trigger.product.id}}', description: 'Product ID.' },
      { token: '{{$trigger.product.sku}}', description: 'SKU code.' },
    ],
    examples: ['Sync the product to Meta\'s commerce catalog.'],
  },
  product_updated: {
    label: 'Product updated',
    section: 'trigger.crm',
    summary: 'Price, description, or stock level on a product changes.',
    whenItFires: 'On any product field change.',
    outputs: [
      { token: '{{$trigger.product.id}}', description: 'Product ID.' },
      { token: '{{$trigger.changedFields}}', description: 'Fields that changed.' },
    ],
    examples: ['Trigger a re-render of cached PDP HTML.'],
  },
  product_stock_low: {
    label: 'Product stock low',
    section: 'trigger.crm',
    summary: 'Inventory count drops below the configured minimum level.',
    whenItFires: 'When stock falls under the threshold.',
    outputs: [
      { token: '{{$trigger.product.sku}}', description: 'SKU.' },
      { token: '{{$trigger.product.stock}}', description: 'Current stock count.' },
      { token: '{{$trigger.threshold}}', description: 'Configured low-stock threshold.' },
    ],
    examples: ['Alert the warehouse manager via WhatsApp.'],
  },
  product_stock_out: {
    label: 'Product out of stock',
    section: 'trigger.crm',
    summary: 'Inventory for a product reaches zero.',
    whenItFires: 'When stock hits 0.',
    outputs: [{ token: '{{$trigger.product.sku}}', description: 'SKU.' }],
    examples: ['Auto-hide the product from the storefront.'],
  },
  product_price_changed: {
    label: 'Product price changed',
    section: 'trigger.crm',
    summary: 'Unit price or cost on a product is updated.',
    whenItFires: 'On price edit.',
    outputs: [
      { token: '{{$trigger.previousPrice}}', description: 'Old price.' },
      { token: '{{$trigger.newPrice}}', description: 'New price.' },
    ],
    examples: ['Sync the new price to Meta catalog within seconds.'],
  },
  warehouse_stock_updated: {
    label: 'Warehouse stock updated',
    section: 'trigger.crm',
    summary: 'Stock quantity changes at a specific warehouse location.',
    whenItFires: 'On stock-delta event.',
    outputs: [
      { token: '{{$trigger.warehouseId}}', description: 'Warehouse ID.' },
      { token: '{{$trigger.delta}}', description: 'Quantity delta (negative on draw-down).' },
    ],
    examples: ['Trigger a re-order purchase request when stock dips.'],
  },

  /* ── CRM Tasks ───────────────────────────────────────────────────── */
  task_created: {
    label: 'Task created',
    section: 'trigger.crm',
    summary: 'An activity or task is assigned to a team member or contact.',
    whenItFires: 'On task create.',
    outputs: [
      { token: '{{$trigger.task.id}}', description: 'Task ID.' },
      { token: '{{$trigger.task.title}}', description: 'Task title.' },
      { token: '{{$trigger.task.assigneeId}}', description: 'Assignee user ID.' },
    ],
    examples: ['Notify the assignee on WhatsApp.'],
  },
  task_assigned: {
    label: 'Task assigned',
    section: 'trigger.crm',
    summary: 'A task delegation changes owner.',
    whenItFires: 'On assignee change.',
    outputs: [
      { token: '{{$trigger.newAssigneeId}}', description: 'New assignee.' },
    ],
    examples: ['Send a "you have a new task" notification.'],
  },
  task_completed: {
    label: 'Task completed',
    section: 'trigger.crm',
    summary: 'A task is marked as done.',
    whenItFires: 'On status change to done.',
    outputs: [{ token: '{{$trigger.task.id}}', description: 'Task ID.' }],
    examples: ['Move the parent deal one step forward if it depends on this task.'],
  },
  task_due: {
    label: 'Task due',
    section: 'trigger.crm',
    summary: 'A task deadline is reached.',
    whenItFires: 'When `task.dueAt` passes.',
    outputs: [{ token: '{{$trigger.task.id}}', description: 'Task ID.' }],
    examples: ['Send a reminder ping to the assignee.'],
  },
  crm_automation_triggered: {
    label: 'CRM automation triggered',
    section: 'trigger.crm',
    summary: 'A rule-based CRM automation executes.',
    whenItFires: 'When a CRM automation (assignment, scoring, …) fires.',
    outputs: [
      { token: '{{$trigger.automation.id}}', description: 'Automation ID.' },
      { token: '{{$trigger.automation.name}}', description: 'Automation name.' },
    ],
    examples: ['Chain external integrations onto an existing CRM rule.'],
  },

  /* ── Broadcasts ──────────────────────────────────────────────────── */
  broadcast_created: {
    label: 'Broadcast created',
    section: 'trigger.broadcasts',
    summary: 'A new bulk message campaign is added.',
    whenItFires: 'On broadcast create.',
    outputs: [{ token: '{{$trigger.broadcast.id}}', description: 'Broadcast ID.' }],
    examples: ['Push the broadcast to an approvals queue.'],
  },
  broadcast_scheduled: {
    label: 'Broadcast scheduled',
    section: 'trigger.broadcasts',
    summary: 'A campaign is queued for a scheduled send.',
    whenItFires: 'On schedule.',
    outputs: [{ token: '{{$trigger.broadcast.scheduledFor}}', description: 'Scheduled send time.' }],
    examples: ['Notify ops about an upcoming high-volume send.'],
  },
  broadcast_sent: {
    label: 'Broadcast sent',
    section: 'trigger.broadcasts',
    summary: 'A campaign begins delivery to recipients.',
    whenItFires: 'When delivery starts.',
    outputs: [{ token: '{{$trigger.broadcast.id}}', description: 'Broadcast ID.' }],
    examples: ['Spin up additional dashboards for live monitoring.'],
  },
  broadcast_completed: {
    label: 'Broadcast completed',
    section: 'trigger.broadcasts',
    summary: 'All messages in a campaign are delivered (or retries exhausted).',
    whenItFires: 'On completion.',
    outputs: [
      { token: '{{$trigger.stats.sent}}', description: 'Total sent.' },
      { token: '{{$trigger.stats.delivered}}', description: 'Total delivered.' },
      { token: '{{$trigger.stats.failed}}', description: 'Total failed.' },
    ],
    examples: ['Generate a daily campaign report.'],
  },
  broadcast_paused: {
    label: 'Broadcast paused',
    section: 'trigger.broadcasts',
    summary: 'Campaign delivery is halted mid-send.',
    whenItFires: 'On pause.',
    outputs: [{ token: '{{$trigger.reason}}', description: 'Pause reason.' }],
    examples: ['Alert the campaign owner.'],
  },
  broadcast_resumed: {
    label: 'Broadcast resumed',
    section: 'trigger.broadcasts',
    summary: 'A previously paused campaign resumes delivery.',
    whenItFires: 'On resume.',
    outputs: [{ token: '{{$trigger.broadcast.id}}', description: 'Broadcast ID.' }],
    examples: ['Log the resume event for compliance.'],
  },
  broadcast_failed: {
    label: 'Broadcast failed',
    section: 'trigger.broadcasts',
    summary: 'A campaign cannot complete due to an error.',
    whenItFires: 'On unrecoverable failure.',
    outputs: [{ token: '{{$trigger.error}}', description: 'Failure object.' }],
    examples: ['Open an incident ticket automatically.'],
  },

  /* ── Templates ───────────────────────────────────────────────────── */
  template_submitted: {
    label: 'Template submitted',
    section: 'trigger.templates',
    summary: 'A new template is sent to Meta for review.',
    whenItFires: 'On submission.',
    outputs: [{ token: '{{$trigger.template.name}}', description: 'Template name.' }],
    examples: ['Notify the marketing team about pending approvals.'],
  },
  template_quality_updated: {
    label: 'Template quality changed',
    section: 'trigger.templates',
    summary: 'A template\'s performance score or rating updates.',
    whenItFires: 'On quality webhook.',
    outputs: [
      { token: '{{$trigger.quality}}', description: 'New quality bucket.' },
      { token: '{{$trigger.previousQuality}}', description: 'Previous bucket.' },
    ],
    examples: ['Pause the campaign if quality drops to LOW.'],
  },
  template_edited: {
    label: 'Template edited',
    section: 'trigger.templates',
    summary: 'Template content or components are modified.',
    whenItFires: 'On edit.',
    outputs: [{ token: '{{$trigger.changedFields}}', description: 'Edited components.' }],
    examples: ['Track template iterations in a changelog.'],
  },

  /* ── Social ──────────────────────────────────────────────────────── */
  facebook_message_received: {
    label: 'Facebook message received',
    section: 'trigger.social',
    summary: 'An inbound message arrives on a connected Facebook page.',
    whenItFires: 'On Messenger webhook.',
    outputs: [
      { token: '{{$trigger.pageId}}', description: 'Facebook page ID.' },
      { token: '{{$trigger.message.text}}', description: 'Message text.' },
    ],
    examples: ['Run the same auto-reply flow you use for WhatsApp.'],
  },
  instagram_message_received: {
    label: 'Instagram message received',
    section: 'trigger.social',
    summary: 'An inbound DM arrives on an Instagram business account.',
    whenItFires: 'On Instagram messaging webhook.',
    outputs: [
      { token: '{{$trigger.pageId}}', description: 'Page/IG account ID.' },
      { token: '{{$trigger.message.text}}', description: 'Message text.' },
    ],
    examples: ['Forward DMs into your unified inbox.'],
  },
  facebook_broadcast_sent: {
    label: 'Facebook broadcast sent',
    section: 'trigger.social',
    summary: 'A Messenger bulk message is sent to recipients.',
    whenItFires: 'On broadcast send.',
    outputs: [{ token: '{{$trigger.broadcast.audienceCount}}', description: 'Audience size.' }],
    examples: ['Compare social vs WhatsApp broadcast performance.'],
  },
  facebook_webhook_update: {
    label: 'Facebook webhook update',
    section: 'trigger.social',
    summary: 'Custom Facebook webhook data is received.',
    whenItFires: 'On any subscribed Facebook webhook.',
    outputs: [
      { token: '{{$trigger.object}}', description: 'Webhook object type.' },
      { token: '{{$trigger.entry}}', description: 'Entries array.' },
    ],
    examples: ['Capture page-feed comments and reply automatically.'],
  },

  /* ── Email & SMS ─────────────────────────────────────────────────── */
  email_sent: {
    label: 'Email sent',
    section: 'trigger.email-sms',
    summary: 'An email message is dispatched to a recipient.',
    whenItFires: 'On email-send success.',
    outputs: [
      { token: '{{$trigger.email.to}}', description: 'Recipient address.' },
      { token: '{{$trigger.email.subject}}', description: 'Email subject.' },
    ],
    examples: ['Log every outbound email to the CRM activity feed.'],
  },
  email_opened: {
    label: 'Email opened',
    section: 'trigger.email-sms',
    summary: 'A recipient opens a sent email (tracking required).',
    whenItFires: 'On open-pixel hit.',
    outputs: [
      { token: '{{$trigger.email.to}}', description: 'Recipient.' },
      { token: '{{$trigger.openedAt}}', description: 'Open time.' },
    ],
    examples: ['Increase the lead score by 5 points.'],
  },
  email_clicked: {
    label: 'Email link clicked',
    section: 'trigger.email-sms',
    summary: 'A recipient clicks a tracked link inside an email.',
    whenItFires: 'On link click.',
    outputs: [
      { token: '{{$trigger.link.url}}', description: 'Clicked URL.' },
      { token: '{{$trigger.link.text}}', description: 'Link anchor text.' },
    ],
    examples: ['Trigger a high-intent sales follow-up.'],
  },
  sms_message_sent: {
    label: 'SMS message sent',
    section: 'trigger.email-sms',
    summary: 'An SMS delivery is initiated.',
    whenItFires: 'On SMS dispatch.',
    outputs: [
      { token: '{{$trigger.sms.to}}', description: 'Destination number.' },
      { token: '{{$trigger.sms.text}}', description: 'SMS body.' },
    ],
    examples: ['Track per-campaign SMS spend.'],
  },
  sms_delivery_confirmed: {
    label: 'SMS delivery confirmed',
    section: 'trigger.email-sms',
    summary: 'An SMS reaches the recipient phone.',
    whenItFires: 'On the carrier delivery receipt.',
    outputs: [
      { token: '{{$trigger.sms.to}}', description: 'Destination number.' },
      { token: '{{$trigger.deliveredAt}}', description: 'Delivery time.' },
    ],
    examples: ['Mark the OTP message as delivered in your auth pipeline.'],
  },

  /* ── Payments ────────────────────────────────────────────────────── */
  payment_received: {
    label: 'Payment received',
    section: 'trigger.payments',
    summary: 'A customer completes a payment through WhatsApp Pay.',
    whenItFires: 'On payment capture.',
    outputs: [
      { token: '{{$trigger.payment.amount}}', description: 'Amount paid.' },
      { token: '{{$trigger.payment.currency}}', description: 'Currency.' },
      { token: '{{$trigger.payment.method}}', description: 'Method (upi, card, …).' },
    ],
    examples: ['Send an instant receipt and start fulfilment.'],
  },
  payment_failed: {
    label: 'Payment failed',
    section: 'trigger.payments',
    summary: 'A payment transaction is declined or cancelled.',
    whenItFires: 'On payment failure callback.',
    outputs: [
      { token: '{{$trigger.payment.failureReason}}', description: 'Failure reason code.' },
    ],
    examples: ['Offer the buyer an alternative payment method.'],
  },
  payment_configuration_updated: {
    label: 'Payment configuration updated',
    section: 'trigger.payments',
    summary: 'Payment settings on a connected number change.',
    whenItFires: 'On configuration update.',
    outputs: [{ token: '{{$trigger.settings.provider}}', description: 'Provider in use.' }],
    examples: ['Audit-log all payment config changes for compliance.'],
  },

  /* ── Orders ──────────────────────────────────────────────────────── */
  order_created: {
    label: 'New order created',
    section: 'trigger.orders',
    summary: 'A customer places a new order via the commerce platform.',
    whenItFires: 'On order create.',
    outputs: [
      { token: '{{$trigger.order.id}}', description: 'Order ID.' },
      { token: '{{$trigger.order.total}}', description: 'Order total.' },
      { token: '{{$trigger.order.items}}', description: 'Array of order line items.' },
    ],
    examples: ['Confirm the order on WhatsApp and start fulfilment.'],
  },
  order_updated: {
    label: 'Order updated',
    section: 'trigger.orders',
    summary: 'An order\'s status or details change.',
    whenItFires: 'On any order field change.',
    outputs: [
      { token: '{{$trigger.order.status}}', description: 'Current order status.' },
      { token: '{{$trigger.changedFields}}', description: 'Fields that changed.' },
    ],
    examples: ['Send a status-update WhatsApp message to the customer.'],
  },
  order_shipped: {
    label: 'Order shipped',
    section: 'trigger.orders',
    summary: 'Fulfilment is completed and tracking is available.',
    whenItFires: 'On status move to shipped.',
    outputs: [
      { token: '{{$trigger.shipment.carrier}}', description: 'Carrier name.' },
      { token: '{{$trigger.shipment.trackingId}}', description: 'Tracking number.' },
    ],
    examples: ['Share the tracking link via WhatsApp.'],
  },
  catalog_product_event: {
    label: 'Catalog product event',
    section: 'trigger.orders',
    summary: 'Price or inventory changes for a product in the catalog.',
    whenItFires: 'On any catalog sync event.',
    outputs: [
      { token: '{{$trigger.product.sku}}', description: 'SKU.' },
      { token: '{{$trigger.event}}', description: 'Event subtype.' },
    ],
    examples: ['Sync catalog updates to Meta.'],
  },

  /* ── SEO ─────────────────────────────────────────────────────────── */
  seo_audit_completed: {
    label: 'SEO audit completed',
    section: 'trigger.seo',
    summary: 'A website SEO analysis finishes and a report is generated.',
    whenItFires: 'On audit completion.',
    outputs: [
      { token: '{{$trigger.score}}', description: 'Overall site score.' },
      { token: '{{$trigger.issuesCount}}', description: 'Number of issues detected.' },
    ],
    examples: ['Email the report to the marketing manager.'],
  },
  ranking_improved: {
    label: 'Keyword ranking improved',
    section: 'trigger.seo',
    summary: 'A tracked keyword position improves in SERP.',
    whenItFires: 'On daily ranking sweep when rank decreases (better).',
    outputs: [
      { token: '{{$trigger.keyword}}', description: 'Keyword.' },
      { token: '{{$trigger.previousRank}}', description: 'Previous position.' },
      { token: '{{$trigger.newRank}}', description: 'New position.' },
    ],
    examples: ['Celebrate wins by posting to Slack.'],
  },
  ranking_dropped: {
    label: 'Keyword ranking dropped',
    section: 'trigger.seo',
    summary: 'A tracked keyword position declines in SERP.',
    whenItFires: 'On daily ranking sweep when rank increases (worse).',
    outputs: [
      { token: '{{$trigger.keyword}}', description: 'Keyword.' },
      { token: '{{$trigger.previousRank}}', description: 'Previous position.' },
      { token: '{{$trigger.newRank}}', description: 'New position.' },
    ],
    examples: ['Open an SEO ticket when a top-10 keyword falls.'],
  },
  indexing_issue_detected: {
    label: 'Indexing issue detected',
    section: 'trigger.seo',
    summary: 'A page crawl or index error is discovered by the SEO module.',
    whenItFires: 'On site crawler error.',
    outputs: [
      { token: '{{$trigger.url}}', description: 'Affected URL.' },
      { token: '{{$trigger.issue}}', description: 'Issue code.' },
    ],
    examples: ['Notify the engineering team immediately.'],
  },

  /* ── Integrations ───────────────────────────────────────────────── */
  webhook_received: {
    label: 'Custom webhook received',
    section: 'trigger.integrations',
    summary: 'A custom HTTP POST hits the workflow webhook endpoint.',
    whenItFires: 'On every matching request to the configured webhook URL.',
    outputs: [
      { token: '{{$trigger.body}}', description: 'Parsed body.' },
      { token: '{{$trigger.headers}}', description: 'Request headers.' },
    ],
    examples: ['Connect arbitrary upstream systems (e-commerce platforms, internal apps).'],
  },
  integration_connected: {
    label: 'Integration connected',
    section: 'trigger.integrations',
    summary: 'A third-party OAuth or API integration is authenticated.',
    whenItFires: 'On successful OAuth connect.',
    outputs: [{ token: '{{$trigger.integration.provider}}', description: 'Provider slug.' }],
    examples: ['Run a first-time sync once the user connects Google Sheets.'],
  },
  integration_disconnected: {
    label: 'Integration disconnected',
    section: 'trigger.integrations',
    summary: 'API credentials are revoked or expire on an integration.',
    whenItFires: 'On disconnect / token expiry.',
    outputs: [
      { token: '{{$trigger.integration.provider}}', description: 'Provider slug.' },
      { token: '{{$trigger.integration.reason}}', description: 'Reason (revoked, expired, …).' },
    ],
    examples: ['Alert the workspace owner to reconnect.'],
  },
  whatsapp_flow_triggered: {
    label: 'WhatsApp Flow triggered',
    section: 'trigger.integrations',
    summary: 'A Meta Interactive Form (Flow) is initiated by a user.',
    whenItFires: 'On flow_triggered webhook.',
    outputs: [
      { token: '{{$trigger.flow.id}}', description: 'Meta Flow ID.' },
      { token: '{{$trigger.response}}', description: 'Form responses object.' },
    ],
    examples: ['Pipe form responses into the CRM as a new lead.'],
  },

  /* ── Blocks · Bubbles ────────────────────────────────────────────── */
  text: {
    label: 'Text',
    section: 'block.bubbles',
    summary: 'Send a text message bubble to the chat.',
    whatItDoes: 'Renders rich text with markdown support and variable interpolation. Use the `{{variable}}` syntax to inject values.',
    fields: [
      { name: 'Content', description: 'Message text with `{{variable}}` placeholders.', required: true },
    ],
    examples: ['Welcome users with "Hi {{contact.name}} 👋"'],
    notes: ['Supports basic markdown: **bold**, *italic*, [links](https://), bullet lists.'],
  },
  image: {
    label: 'Image',
    section: 'block.bubbles',
    summary: 'Display an image bubble.',
    whatItDoes: 'Renders an image from a SabFiles URL. Supports alt-text for accessibility.',
    fields: [
      { name: 'URL', description: 'SabFiles image URL.', required: true },
      { name: 'Alt', description: 'Screen-reader description.' },
    ],
    notes: ['Pick images via the SabFiles picker — direct URLs from external sites are blocked.'],
  },
  video: {
    label: 'Video',
    section: 'block.bubbles',
    summary: 'Embed a video bubble.',
    whatItDoes: 'Plays a video from SabFiles in the configured aspect ratio.',
    fields: [
      { name: 'URL', description: 'SabFiles video URL.', required: true },
      { name: 'Aspect ratio', description: '16/9, 4/3, 1/1, 9/16.', defaultValue: '16/9' },
    ],
  },
  audio: {
    label: 'Audio',
    section: 'block.bubbles',
    summary: 'Embed an audio clip.',
    whatItDoes: 'Plays an audio file from SabFiles.',
    fields: [
      { name: 'URL', description: 'SabFiles audio URL.', required: true },
    ],
  },
  embed: {
    label: 'Embed',
    section: 'block.bubbles',
    summary: 'Embed an external page or widget via iframe.',
    whatItDoes: 'Renders a sandboxed iframe at the given URL and height.',
    fields: [
      { name: 'URL', description: 'Page to embed.', required: true },
      { name: 'Height', description: 'Iframe height in px or %.', defaultValue: '300px' },
    ],
    notes: ['The target site must allow framing (no X-Frame-Options: DENY).'],
  },

  /* ── Blocks · Inputs ─────────────────────────────────────────────── */
  text_input: {
    label: 'Text Input',
    section: 'block.inputs',
    summary: 'Ask the user for a free-text answer.',
    whatItDoes: 'Displays an input field and stores the answer in the configured variable.',
    fields: [
      { name: 'Placeholder', description: 'Greyed-out hint inside the field.' },
      { name: 'Button label', description: 'Send button caption.', defaultValue: 'Send' },
      { name: 'Variable', description: 'Variable to write the answer into.' },
    ],
    outputs: [{ token: '{{<variable>}}', description: 'The text the user submitted.' }],
  },
  number_input: {
    label: 'Number',
    section: 'block.inputs',
    summary: 'Collect a numeric answer.',
    whatItDoes: 'Validates the input is a number before continuing.',
    fields: [{ name: 'Placeholder', description: 'Example hint.', defaultValue: '0' }],
  },
  email_input: {
    label: 'Email',
    section: 'block.inputs',
    summary: 'Collect a valid email address.',
    whatItDoes: 'Runs RFC 5322 validation before storing.',
  },
  phone_input: {
    label: 'Phone',
    section: 'block.inputs',
    summary: 'Collect an E.164 phone number with country code.',
    whatItDoes: 'Renders a country-aware phone field.',
    fields: [{ name: 'Default country', description: 'ISO-2 country code.', defaultValue: 'US' }],
  },
  url_input: {
    label: 'URL',
    section: 'block.inputs',
    summary: 'Collect a URL.',
    whatItDoes: 'Validates the input is a syntactically valid URL.',
  },
  date_input: {
    label: 'Date',
    section: 'block.inputs',
    summary: 'Pick a date.',
    fields: [{ name: 'Format', description: 'Display format.', defaultValue: 'YYYY-MM-DD' }],
  },
  time_input: {
    label: 'Time',
    section: 'block.inputs',
    summary: 'Pick a time of day.',
    fields: [{ name: 'Format', description: 'Display format.', defaultValue: 'HH:mm' }],
  },
  rating_input: {
    label: 'Rating',
    section: 'block.inputs',
    summary: 'Collect a numeric rating (e.g. 1-5 stars).',
    fields: [{ name: 'Length', description: 'Maximum rating value.', defaultValue: '5' }],
  },
  file_input: {
    label: 'File Upload',
    section: 'block.inputs',
    summary: 'Let the user upload a file.',
    whatItDoes: 'Uploads to SabFiles and stores the resulting URL.',
    fields: [{ name: 'Allow multiple', description: 'Accept more than one file.', defaultValue: 'false' }],
  },
  payment_input: {
    label: 'Payment',
    section: 'block.inputs',
    summary: 'Collect a payment via Stripe, Razorpay, or WhatsApp Pay.',
    fields: [
      { name: 'Provider', description: 'stripe, razorpay, whatsapp_pay.', defaultValue: 'stripe' },
      { name: 'Amount', description: 'Numeric amount in the smallest currency unit.', required: true },
      { name: 'Currency', description: 'ISO-4217 currency code.', defaultValue: 'USD' },
    ],
    notes: ['Set up provider credentials in Settings → Integrations.'],
  },
  choice_input: {
    label: 'Buttons',
    section: 'block.inputs',
    summary: 'Show clickable buttons (multi or single choice).',
    fields: [
      { name: 'Items', description: 'Array of button labels.' },
      { name: 'Multiple choice', description: 'Let the user pick more than one.', defaultValue: 'false' },
    ],
  },
  picture_choice_input: {
    label: 'Picture Choice',
    section: 'block.inputs',
    summary: 'Show clickable picture cards as the choice options.',
    fields: [
      { name: 'Items', description: 'Array of { image, label } options.' },
    ],
  },

  /* ── Blocks · Logic ──────────────────────────────────────────────── */
  condition: {
    label: 'Condition',
    section: 'block.logic',
    summary: 'Branch the flow based on variable values.',
    whatItDoes: 'Evaluates one or more comparisons and routes execution down the matching branch.',
    fields: [{ name: 'Items', description: 'List of comparison groups; each group becomes its own outgoing edge.' }],
    examples: ['Send VIPs to a different path: `contact.tags contains "vip"`.'],
  },
  set_variable: {
    label: 'Set Variable',
    section: 'block.logic',
    summary: 'Compute and store a single variable.',
    whatItDoes: 'Evaluates an expression and assigns the result to the target variable.',
    fields: [
      { name: 'Variable', description: 'Target variable.', required: true },
      { name: 'Expression', description: 'JavaScript-style expression or static value.' },
    ],
  },
  set: {
    label: 'Set Multiple',
    section: 'block.logic',
    summary: 'Compute and store multiple variables in one step.',
    whatItDoes: 'Like Set Variable, but bulk.',
  },
  redirect: {
    label: 'Redirect',
    section: 'block.logic',
    summary: 'Open a URL — same tab or new tab.',
    fields: [
      { name: 'URL', description: 'Destination URL.', required: true },
      { name: 'New tab', description: 'Open in a new tab.', defaultValue: 'false' },
    ],
  },
  script: {
    label: 'Script',
    section: 'block.logic',
    summary: 'Run a sandboxed JavaScript snippet.',
    whatItDoes: 'Executes the script in a server-side sandbox. Variables in scope, fetch is allowed.',
    fields: [{ name: 'Content', description: 'JavaScript code.', required: true }],
    notes: ['Sandbox limits: 5s wall time, 64 MB memory.'],
  },
  typebot_link: {
    label: 'Jump to Flow',
    section: 'block.logic',
    summary: 'Jump into another flow as a sub-flow.',
    fields: [{ name: 'Flow ID', description: 'Target flow.', required: true }],
  },
  wait: {
    label: 'Wait',
    section: 'block.logic',
    summary: 'Pause the flow for a fixed delay.',
    fields: [{ name: 'Seconds', description: 'Delay in seconds.', defaultValue: '1' }],
    notes: ['Long waits are durable — workers persist the schedule and resume after restarts.'],
  },
  jump: {
    label: 'Jump',
    section: 'block.logic',
    summary: 'Jump to a different group in this flow.',
    fields: [{ name: 'Group ID', description: 'Target group.', required: true }],
  },
  ab_test: {
    label: 'A/B Test',
    section: 'block.logic',
    summary: 'Randomly split traffic between variants.',
    fields: [{ name: 'Items', description: 'Array of weighted variants — weights are normalised to 100.' }],
    examples: ['Test two message templates and measure click-through.'],
  },
  loop: {
    label: 'Loop',
    section: 'block.logic',
    summary: 'Iterate over a list, running the inner steps for each item.',
    fields: [
      { name: 'List variable', description: 'Array to iterate over.', required: true },
      { name: 'Max iterations', description: 'Safety cap.', defaultValue: '100' },
    ],
    outputs: [
      { token: '{{$item}}', description: 'Current iteration item.' },
      { token: '{{$index}}', description: 'Zero-based iteration index.' },
    ],
  },
  merge: {
    label: 'Merge',
    section: 'block.logic',
    summary: 'Combine multiple incoming branches into one.',
    fields: [{ name: 'Mode', description: 'append / wait-all / first.', defaultValue: 'append' }],
  },
  switch: {
    label: 'Switch',
    section: 'block.logic',
    summary: 'Multi-way branch on a single variable.',
    fields: [
      { name: 'Variable', description: 'Variable to inspect.', required: true },
      { name: 'Cases', description: 'Value → branch mapping.' },
    ],
  },
  filter: {
    label: 'Filter',
    section: 'block.logic',
    summary: 'Filter items of a list by a condition.',
    fields: [
      { name: 'List variable', description: 'Source list.', required: true },
      { name: 'Condition', description: 'Comparison applied per item.' },
    ],
  },
  sort: {
    label: 'Sort',
    section: 'block.logic',
    summary: 'Sort the items of a list.',
    fields: [
      { name: 'List variable', description: 'Source list.', required: true },
      { name: 'Key', description: 'Property path to sort by.' },
      { name: 'Direction', description: 'asc / desc.', defaultValue: 'asc' },
    ],
  },
  execute_workflow: {
    label: 'Execute Workflow',
    section: 'block.logic',
    summary: 'Invoke another workflow synchronously.',
    fields: [{ name: 'Workflow ID', description: 'Target workflow.', required: true }],
  },
  respond_to_webhook: {
    label: 'Respond Webhook',
    section: 'block.logic',
    summary: 'Send a custom HTTP response back to the caller.',
    whatItDoes: 'Only valid in webhook-triggered flows configured with responseMode = "responseNode".',
    fields: [
      { name: 'Status code', description: 'HTTP status to return.', defaultValue: '200' },
      { name: 'Body', description: 'Response body.' },
      { name: 'Headers', description: 'Response headers.' },
    ],
  },

  /* ── Blocks · Integrations ───────────────────────────────────────── */
  webhook: {
    label: 'HTTP Request',
    section: 'block.integrations',
    summary: 'Call an external HTTP endpoint.',
    whatItDoes: 'Makes an outbound HTTP request and stores the response in `{{$step.response}}`.',
    fields: [
      { name: 'URL', description: 'Endpoint URL.', required: true },
      { name: 'Method', description: 'HTTP method.', defaultValue: 'POST' },
      { name: 'Headers', description: 'Key/value list.' },
      { name: 'Body', description: 'JSON or raw body.' },
    ],
    outputs: [
      { token: '{{$step.response.body}}', description: 'Parsed response body.' },
      { token: '{{$step.response.status}}', description: 'HTTP status code.' },
    ],
  },
  send_email: {
    label: 'Send Email',
    section: 'block.integrations',
    summary: 'Send an email via the configured SMTP / provider.',
    fields: [
      { name: 'To', description: 'Recipient address(es).', required: true },
      { name: 'Subject', description: 'Subject line.' },
      { name: 'Body', description: 'HTML or plain-text body.' },
    ],
  },
  google_sheets: {
    label: 'Google Sheets',
    section: 'block.integrations',
    summary: 'Append, update, or read rows in a Google spreadsheet.',
    fields: [
      { name: 'Operation', description: 'append / update / get.', defaultValue: 'append' },
      { name: 'Spreadsheet ID', description: 'The doc ID from the URL.', required: true },
      { name: 'Sheet name', description: 'Tab name.' },
    ],
  },
  google_analytics: {
    label: 'Google Analytics',
    section: 'block.integrations',
    summary: 'Record events into Google Analytics.',
  },
  open_ai: {
    label: 'OpenAI',
    section: 'block.integrations',
    summary: 'Call an OpenAI / AI Gateway model.',
    fields: [
      { name: 'Model', description: 'Provider/model identifier — defaults to gpt-4o-mini.', defaultValue: 'openai/gpt-4o-mini' },
      { name: 'Task', description: 'Chat completion, embedding, image generation, etc.' },
      { name: 'Messages', description: 'Chat messages array.' },
    ],
    outputs: [{ token: '{{$step.response}}', description: 'Model output.' }],
  },
  zapier: { label: 'Zapier', section: 'block.integrations', summary: 'Forward the step payload to a Zapier zap.' },
  make_com: { label: 'Make', section: 'block.integrations', summary: 'Forward the step payload to a Make.com scenario.' },
  pabbly_connect: { label: 'Pabbly', section: 'block.integrations', summary: 'Forward the step payload to a Pabbly Connect workflow.' },
  chatwoot: { label: 'Chatwoot', section: 'block.integrations', summary: 'Push the conversation to Chatwoot for human handover.' },
  pixel: { label: 'Pixel', section: 'block.integrations', summary: 'Fire a Meta/Facebook pixel event.' },
  segment: { label: 'Segment', section: 'block.integrations', summary: 'Track an event into Segment.' },
  cal_com: { label: 'Cal.com', section: 'block.integrations', summary: 'Create or query a Cal.com booking.' },
  nocodb: { label: 'NocoDB', section: 'block.integrations', summary: 'Insert / update a NocoDB row.' },
  elevenlabs: { label: 'ElevenLabs', section: 'block.integrations', summary: 'Synthesise speech via ElevenLabs.' },
  anthropic: { label: 'Anthropic', section: 'block.integrations', summary: 'Call a Claude model. Output is stored in `{{$step.response}}`.' },
  together_ai: { label: 'Together AI', section: 'block.integrations', summary: 'Call a Together AI model.' },
  mistral: { label: 'Mistral AI', section: 'block.integrations', summary: 'Call a Mistral hosted model.' },

  /* ── Blocks · Forge (declarative) ────────────────────────────────── */
  forge_notion: { label: 'Notion', section: 'block.forge', summary: 'Read / write Notion databases via a stored credential.' },
  forge_airtable: { label: 'Airtable', section: 'block.forge', summary: 'CRUD rows in an Airtable base.' },
  forge_slack: { label: 'Slack', section: 'block.forge', summary: 'Post messages or read conversations from Slack.' },
  forge_discord: { label: 'Discord', section: 'block.forge', summary: 'Send messages to Discord channels or DMs.' },
  forge_github: { label: 'GitHub', section: 'block.forge', summary: 'Create issues, PRs, comments via GitHub API.' },
  forge_twilio: { label: 'Twilio', section: 'block.forge', summary: 'Send SMS / WhatsApp / voice via Twilio.' },
  forge_sendgrid: { label: 'SendGrid', section: 'block.forge', summary: 'Send transactional emails via SendGrid.' },
};

export function getNodeDoc(key: string | undefined): NodeDoc | undefined {
  if (!key) return undefined;
  return NODE_DOCS[key];
}

export const NODE_DOC_SECTIONS: { id: NodeDoc['section']; label: string }[] = [
  { id: 'trigger.general', label: 'Triggers · Generic' },
  { id: 'trigger.whatsapp', label: 'Triggers · WhatsApp' },
  { id: 'trigger.calls', label: 'Triggers · Calls' },
  { id: 'trigger.crm', label: 'Triggers · CRM' },
  { id: 'trigger.broadcasts', label: 'Triggers · Broadcasts' },
  { id: 'trigger.templates', label: 'Triggers · Templates' },
  { id: 'trigger.social', label: 'Triggers · Facebook & Instagram' },
  { id: 'trigger.email-sms', label: 'Triggers · Email & SMS' },
  { id: 'trigger.payments', label: 'Triggers · Payments' },
  { id: 'trigger.orders', label: 'Triggers · Orders & Commerce' },
  { id: 'trigger.seo', label: 'Triggers · SEO' },
  { id: 'trigger.integrations', label: 'Triggers · Integrations' },
  { id: 'block.bubbles', label: 'Blocks · Bubbles' },
  { id: 'block.inputs', label: 'Blocks · Inputs' },
  { id: 'block.logic', label: 'Blocks · Logic' },
  { id: 'block.integrations', label: 'Blocks · Integrations' },
  { id: 'block.forge', label: 'Blocks · Forge' },
];
