/**
 * Trigger filter schema registry.
 *
 * Maps every `appEvent` slug from `triggerOptions.ts` to a list of filter fields
 * that the user can populate in the TriggerEventSettings panel. The runtime
 * webhook ingress (`/api/sabflow/webhook/[webhookId]`) evaluates these filters
 * against the inbound payload before queueing the flow run.
 *
 * Filters share a small set of "templates" so similar events stay in sync —
 * e.g. every CRM contact event allows filtering by tag and owner.
 */
import type { EventFilterOperator } from '@/lib/sabflow/types';

export type FilterFieldKind =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean';

export type FilterField = {
  /** Dot-path the engine will read on the inbound trigger payload. */
  path: string;
  /** Label shown above the input in the settings panel. */
  label: string;
  /** Short helper text below the input. */
  hint?: string;
  kind: FilterFieldKind;
  /** Default operator suggested when the user enables this row. */
  defaultOperator: EventFilterOperator;
  /** Allowed operators for the dropdown (defaults to a sensible set per kind). */
  operators?: EventFilterOperator[];
  /** For select / multiselect — the option list. */
  options?: { label: string; value: string }[];
  placeholder?: string;
};

/* ─── Shared filter templates ────────────────────────────────────────────── */

const FILTERS_CONTACT: FilterField[] = [
  { path: 'contact.tags', label: 'Has tag', hint: 'Fire only when the contact has this tag.', kind: 'text', defaultOperator: 'contains', placeholder: 'vip' },
  { path: 'contact.ownerId', label: 'Owner', hint: 'CRM user ID who owns the contact.', kind: 'text', defaultOperator: 'equals', placeholder: 'user_…' },
  { path: 'contact.phone', label: 'Phone equals', kind: 'text', defaultOperator: 'equals', placeholder: '+1 555 0100' },
  { path: 'contact.email', label: 'Email contains', kind: 'text', defaultOperator: 'contains', placeholder: '@example.com' },
];

const FILTERS_DEAL: FilterField[] = [
  { path: 'deal.pipelineId', label: 'Pipeline', hint: 'Limit to deals on a specific pipeline.', kind: 'text', defaultOperator: 'equals', placeholder: 'pipeline_sales' },
  { path: 'deal.stageId', label: 'Stage', hint: 'Stage the deal must be in.', kind: 'text', defaultOperator: 'equals', placeholder: 'stage_negotiation' },
  { path: 'deal.ownerId', label: 'Owner', kind: 'text', defaultOperator: 'equals', placeholder: 'user_…' },
  { path: 'deal.value', label: 'Value', kind: 'number', defaultOperator: 'gte', placeholder: '1000', operators: ['equals', 'gt', 'gte', 'lt', 'lte', 'not_equals'] },
  { path: 'deal.currency', label: 'Currency', kind: 'text', defaultOperator: 'equals', placeholder: 'USD' },
];

const FILTERS_LEAD: FilterField[] = [
  { path: 'lead.status', label: 'Status', kind: 'select', defaultOperator: 'equals',
    options: [
      { label: 'New', value: 'new' },
      { label: 'Contacted', value: 'contacted' },
      { label: 'Qualified', value: 'qualified' },
      { label: 'Unqualified', value: 'unqualified' },
      { label: 'Converted', value: 'converted' },
    ] },
  { path: 'lead.source', label: 'Source', kind: 'text', defaultOperator: 'equals', placeholder: 'campaign_x' },
  { path: 'lead.ownerId', label: 'Owner', kind: 'text', defaultOperator: 'equals', placeholder: 'user_…' },
  { path: 'lead.score', label: 'Score', kind: 'number', defaultOperator: 'gte', placeholder: '70', operators: ['equals', 'gt', 'gte', 'lt', 'lte', 'not_equals'] },
];

const FILTERS_WHATSAPP_MESSAGE: FilterField[] = [
  { path: 'phoneNumberId', label: 'Phone number ID', hint: 'Only fire for messages on a specific WABA number.', kind: 'text', defaultOperator: 'equals', placeholder: '1234567890' },
  { path: 'message.from', label: 'From contact', kind: 'text', defaultOperator: 'equals', placeholder: '+1 555 0100' },
  { path: 'message.type', label: 'Message type', kind: 'select', defaultOperator: 'equals',
    options: [
      { label: 'Text', value: 'text' },
      { label: 'Image', value: 'image' },
      { label: 'Video', value: 'video' },
      { label: 'Audio', value: 'audio' },
      { label: 'Document', value: 'document' },
      { label: 'Sticker', value: 'sticker' },
      { label: 'Location', value: 'location' },
      { label: 'Contacts', value: 'contacts' },
      { label: 'Interactive', value: 'interactive' },
      { label: 'Button', value: 'button' },
      { label: 'Order', value: 'order' },
    ] },
  { path: 'message.text.body', label: 'Text contains', hint: 'Match only if message text contains this keyword.', kind: 'text', defaultOperator: 'contains', placeholder: 'hello' },
];

const FILTERS_WHATSAPP_STATUS: FilterField[] = [
  { path: 'phoneNumberId', label: 'Phone number ID', kind: 'text', defaultOperator: 'equals' },
  { path: 'status.recipientId', label: 'Recipient', kind: 'text', defaultOperator: 'equals' },
];

const FILTERS_WHATSAPP_TEMPLATE: FilterField[] = [
  { path: 'template.name', label: 'Template name', kind: 'text', defaultOperator: 'equals', placeholder: 'order_confirmation' },
  { path: 'template.language', label: 'Language', kind: 'text', defaultOperator: 'equals', placeholder: 'en_US' },
];

const FILTERS_WHATSAPP_ACCOUNT: FilterField[] = [
  { path: 'wabaId', label: 'WABA ID', kind: 'text', defaultOperator: 'equals' },
  { path: 'phoneNumberId', label: 'Phone number ID', kind: 'text', defaultOperator: 'equals' },
];

const FILTERS_CALL: FilterField[] = [
  { path: 'phoneNumberId', label: 'Phone number ID', kind: 'text', defaultOperator: 'equals' },
  { path: 'call.from', label: 'From number', kind: 'text', defaultOperator: 'equals' },
  { path: 'call.direction', label: 'Direction', kind: 'select', defaultOperator: 'equals',
    options: [
      { label: 'Inbound', value: 'inbound' },
      { label: 'Outbound', value: 'outbound' },
    ] },
];

const FILTERS_INVOICE: FilterField[] = [
  { path: 'invoice.status', label: 'Status', kind: 'select', defaultOperator: 'equals',
    options: [
      { label: 'Draft', value: 'draft' },
      { label: 'Sent', value: 'sent' },
      { label: 'Paid', value: 'paid' },
      { label: 'Partial', value: 'partial' },
      { label: 'Overdue', value: 'overdue' },
      { label: 'Cancelled', value: 'cancelled' },
    ] },
  { path: 'invoice.amount', label: 'Amount', kind: 'number', defaultOperator: 'gte', operators: ['equals', 'gt', 'gte', 'lt', 'lte', 'not_equals'] },
  { path: 'invoice.currency', label: 'Currency', kind: 'text', defaultOperator: 'equals', placeholder: 'USD' },
  { path: 'invoice.customerId', label: 'Customer', kind: 'text', defaultOperator: 'equals' },
];

const FILTERS_QUOTATION: FilterField[] = [
  { path: 'quotation.status', label: 'Status', kind: 'select', defaultOperator: 'equals',
    options: [
      { label: 'Draft', value: 'draft' },
      { label: 'Sent', value: 'sent' },
      { label: 'Accepted', value: 'accepted' },
      { label: 'Declined', value: 'declined' },
    ] },
  { path: 'quotation.amount', label: 'Amount', kind: 'number', defaultOperator: 'gte', operators: ['equals', 'gt', 'gte', 'lt', 'lte'] },
];

const FILTERS_PRODUCT: FilterField[] = [
  { path: 'product.sku', label: 'SKU', kind: 'text', defaultOperator: 'equals' },
  { path: 'product.category', label: 'Category', kind: 'text', defaultOperator: 'equals' },
  { path: 'product.warehouseId', label: 'Warehouse', kind: 'text', defaultOperator: 'equals' },
];

const FILTERS_TASK: FilterField[] = [
  { path: 'task.assigneeId', label: 'Assignee', kind: 'text', defaultOperator: 'equals' },
  { path: 'task.priority', label: 'Priority', kind: 'select', defaultOperator: 'equals',
    options: [
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'Urgent', value: 'urgent' },
    ] },
  { path: 'task.relatedTo', label: 'Related entity', kind: 'text', defaultOperator: 'equals', placeholder: 'contact:abc123' },
];

const FILTERS_BROADCAST: FilterField[] = [
  { path: 'broadcast.id', label: 'Broadcast ID', kind: 'text', defaultOperator: 'equals' },
  { path: 'broadcast.channel', label: 'Channel', kind: 'select', defaultOperator: 'equals',
    options: [
      { label: 'WhatsApp', value: 'whatsapp' },
      { label: 'Email', value: 'email' },
      { label: 'SMS', value: 'sms' },
      { label: 'Facebook', value: 'facebook' },
    ] },
  { path: 'broadcast.templateName', label: 'Template name', kind: 'text', defaultOperator: 'equals' },
];

const FILTERS_TEMPLATE: FilterField[] = [
  { path: 'template.name', label: 'Template name', kind: 'text', defaultOperator: 'equals' },
  { path: 'template.category', label: 'Category', kind: 'select', defaultOperator: 'equals',
    options: [
      { label: 'Marketing', value: 'MARKETING' },
      { label: 'Utility', value: 'UTILITY' },
      { label: 'Authentication', value: 'AUTHENTICATION' },
    ] },
  { path: 'template.language', label: 'Language', kind: 'text', defaultOperator: 'equals', placeholder: 'en_US' },
];

const FILTERS_SOCIAL_MESSAGE: FilterField[] = [
  { path: 'pageId', label: 'Page ID', kind: 'text', defaultOperator: 'equals' },
  { path: 'message.text', label: 'Text contains', kind: 'text', defaultOperator: 'contains' },
];

const FILTERS_EMAIL: FilterField[] = [
  { path: 'email.to', label: 'To address', kind: 'text', defaultOperator: 'equals' },
  { path: 'email.from', label: 'From address', kind: 'text', defaultOperator: 'equals' },
  { path: 'email.subject', label: 'Subject contains', kind: 'text', defaultOperator: 'contains' },
  { path: 'email.campaignId', label: 'Campaign ID', kind: 'text', defaultOperator: 'equals' },
];

const FILTERS_SMS: FilterField[] = [
  { path: 'sms.to', label: 'To number', kind: 'text', defaultOperator: 'equals' },
  { path: 'sms.from', label: 'From number', kind: 'text', defaultOperator: 'equals' },
];

const FILTERS_PAYMENT: FilterField[] = [
  { path: 'payment.amount', label: 'Amount', kind: 'number', defaultOperator: 'gte', operators: ['equals', 'gt', 'gte', 'lt', 'lte'] },
  { path: 'payment.currency', label: 'Currency', kind: 'text', defaultOperator: 'equals', placeholder: 'INR' },
  { path: 'payment.method', label: 'Method', kind: 'select', defaultOperator: 'equals',
    options: [
      { label: 'UPI', value: 'upi' },
      { label: 'Card', value: 'card' },
      { label: 'Net banking', value: 'netbanking' },
      { label: 'Wallet', value: 'wallet' },
    ] },
];

const FILTERS_ORDER: FilterField[] = [
  { path: 'order.status', label: 'Status', kind: 'select', defaultOperator: 'equals',
    options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Confirmed', value: 'confirmed' },
      { label: 'Shipped', value: 'shipped' },
      { label: 'Delivered', value: 'delivered' },
      { label: 'Cancelled', value: 'cancelled' },
      { label: 'Refunded', value: 'refunded' },
    ] },
  { path: 'order.total', label: 'Total', kind: 'number', defaultOperator: 'gte', operators: ['equals', 'gt', 'gte', 'lt', 'lte'] },
  { path: 'order.channel', label: 'Channel', kind: 'text', defaultOperator: 'equals' },
];

const FILTERS_SEO: FilterField[] = [
  { path: 'site.domain', label: 'Domain', kind: 'text', defaultOperator: 'equals', placeholder: 'example.com' },
  { path: 'keyword', label: 'Keyword', kind: 'text', defaultOperator: 'equals' },
];

const FILTERS_INTEGRATION: FilterField[] = [
  { path: 'integration.provider', label: 'Provider', kind: 'text', defaultOperator: 'equals' },
];

/* ─── Master map ─────────────────────────────────────────────────────────── */

export const TRIGGER_FILTERS: Record<string, FilterField[]> = {
  /* General — generic types have their own dedicated panels (cron, sample
     payload, webhook auth) so no extra filters are needed. */

  // WhatsApp
  whatsapp_message_received: FILTERS_WHATSAPP_MESSAGE,
  whatsapp_message_read: FILTERS_WHATSAPP_STATUS,
  whatsapp_message_failed: FILTERS_WHATSAPP_STATUS,
  whatsapp_template_approved: FILTERS_WHATSAPP_TEMPLATE,
  whatsapp_template_rejected: FILTERS_WHATSAPP_TEMPLATE,
  whatsapp_contact_opted_in: FILTERS_WHATSAPP_ACCOUNT,
  whatsapp_contact_opted_out: FILTERS_WHATSAPP_ACCOUNT,
  whatsapp_phone_quality_updated: FILTERS_WHATSAPP_ACCOUNT,
  whatsapp_phone_verified: FILTERS_WHATSAPP_ACCOUNT,
  whatsapp_account_violation: FILTERS_WHATSAPP_ACCOUNT,
  whatsapp_account_disabled: FILTERS_WHATSAPP_ACCOUNT,

  // Calls
  call_incoming: FILTERS_CALL,
  call_outgoing_started: FILTERS_CALL,
  call_answered: FILTERS_CALL,
  call_missed: FILTERS_CALL,
  call_completed: FILTERS_CALL,
  call_terminated: FILTERS_CALL,
  calling_settings_updated: [
    { path: 'phoneNumberId', label: 'Phone number ID', kind: 'text', defaultOperator: 'equals' },
  ],

  // Contacts & accounts
  contact_created: FILTERS_CONTACT,
  contact_updated: FILTERS_CONTACT,
  contact_tagged: FILTERS_CONTACT,
  contact_assigned: FILTERS_CONTACT,
  contact_merged: FILTERS_CONTACT,
  contact_imported: [
    { path: 'import.source', label: 'Import source', kind: 'text', defaultOperator: 'equals' },
    { path: 'import.totalCount', label: 'Min total imported', kind: 'number', defaultOperator: 'gte', operators: ['gt', 'gte'] },
  ],
  account_created: [
    { path: 'account.industry', label: 'Industry', kind: 'text', defaultOperator: 'equals' },
    { path: 'account.size', label: 'Size', kind: 'text', defaultOperator: 'equals' },
    { path: 'account.ownerId', label: 'Owner', kind: 'text', defaultOperator: 'equals' },
  ],
  account_updated: [
    { path: 'account.industry', label: 'Industry', kind: 'text', defaultOperator: 'equals' },
    { path: 'account.ownerId', label: 'Owner', kind: 'text', defaultOperator: 'equals' },
  ],
  contact_note_added: [
    { path: 'note.authorId', label: 'Author', kind: 'text', defaultOperator: 'equals' },
    { path: 'note.body', label: 'Body contains', kind: 'text', defaultOperator: 'contains' },
  ],

  // Deals
  deal_created: FILTERS_DEAL,
  deal_moved: FILTERS_DEAL,
  deal_closed_won: FILTERS_DEAL,
  deal_closed_lost: FILTERS_DEAL,
  deal_assigned: FILTERS_DEAL,
  deal_probability_updated: FILTERS_DEAL,
  deal_value_updated: FILTERS_DEAL,

  // Leads
  lead_created: FILTERS_LEAD,
  lead_status_changed: FILTERS_LEAD,
  lead_assigned: FILTERS_LEAD,
  lead_converted: FILTERS_LEAD,
  lead_source_tracked: FILTERS_LEAD,
  lead_follow_up_due: FILTERS_LEAD,

  // Invoices / Quotations
  invoice_created: FILTERS_INVOICE,
  invoice_sent: FILTERS_INVOICE,
  invoice_marked_paid: FILTERS_INVOICE,
  invoice_payment_received: FILTERS_INVOICE,
  invoice_overdue: FILTERS_INVOICE,
  payment_receipt_created: FILTERS_INVOICE,
  quotation_created: FILTERS_QUOTATION,
  quotation_sent: FILTERS_QUOTATION,

  // Products / inventory
  product_created: FILTERS_PRODUCT,
  product_updated: FILTERS_PRODUCT,
  product_stock_low: FILTERS_PRODUCT,
  product_stock_out: FILTERS_PRODUCT,
  product_price_changed: FILTERS_PRODUCT,
  warehouse_stock_updated: FILTERS_PRODUCT,

  // Tasks
  task_created: FILTERS_TASK,
  task_assigned: FILTERS_TASK,
  task_completed: FILTERS_TASK,
  task_due: FILTERS_TASK,
  crm_automation_triggered: [
    { path: 'automation.name', label: 'Automation name', kind: 'text', defaultOperator: 'equals' },
    { path: 'automation.id', label: 'Automation ID', kind: 'text', defaultOperator: 'equals' },
  ],

  // Broadcasts
  broadcast_created: FILTERS_BROADCAST,
  broadcast_scheduled: FILTERS_BROADCAST,
  broadcast_sent: FILTERS_BROADCAST,
  broadcast_completed: FILTERS_BROADCAST,
  broadcast_paused: FILTERS_BROADCAST,
  broadcast_resumed: FILTERS_BROADCAST,
  broadcast_failed: FILTERS_BROADCAST,

  // Templates
  template_submitted: FILTERS_TEMPLATE,
  template_quality_updated: FILTERS_TEMPLATE,
  template_edited: FILTERS_TEMPLATE,

  // Social
  facebook_message_received: FILTERS_SOCIAL_MESSAGE,
  instagram_message_received: FILTERS_SOCIAL_MESSAGE,
  facebook_broadcast_sent: [
    { path: 'pageId', label: 'Page ID', kind: 'text', defaultOperator: 'equals' },
    { path: 'broadcast.id', label: 'Broadcast ID', kind: 'text', defaultOperator: 'equals' },
  ],
  facebook_webhook_update: [
    { path: 'object', label: 'Object', kind: 'text', defaultOperator: 'equals', placeholder: 'page' },
    { path: 'entry[0].changes[0].field', label: 'Change field', kind: 'text', defaultOperator: 'equals' },
  ],

  // Email & SMS
  email_sent: FILTERS_EMAIL,
  email_opened: FILTERS_EMAIL,
  email_clicked: FILTERS_EMAIL,
  sms_message_sent: FILTERS_SMS,
  sms_delivery_confirmed: FILTERS_SMS,

  // Payments
  payment_received: FILTERS_PAYMENT,
  payment_failed: FILTERS_PAYMENT,
  payment_configuration_updated: [
    { path: 'phoneNumberId', label: 'Phone number ID', kind: 'text', defaultOperator: 'equals' },
  ],

  // Orders
  order_created: FILTERS_ORDER,
  order_updated: FILTERS_ORDER,
  order_shipped: FILTERS_ORDER,
  catalog_product_event: [
    { path: 'product.sku', label: 'SKU', kind: 'text', defaultOperator: 'equals' },
    { path: 'product.catalogId', label: 'Catalog ID', kind: 'text', defaultOperator: 'equals' },
  ],

  // SEO
  seo_audit_completed: FILTERS_SEO,
  ranking_improved: FILTERS_SEO,
  ranking_dropped: FILTERS_SEO,
  indexing_issue_detected: FILTERS_SEO,

  // Integrations
  webhook_received: [
    { path: 'body.event', label: 'Event field', kind: 'text', defaultOperator: 'equals' },
    { path: 'headers["x-source"]', label: 'Source header', kind: 'text', defaultOperator: 'equals' },
  ],
  integration_connected: FILTERS_INTEGRATION,
  integration_disconnected: FILTERS_INTEGRATION,
  whatsapp_flow_triggered: [
    { path: 'flow.id', label: 'Flow ID', kind: 'text', defaultOperator: 'equals' },
    { path: 'flow.name', label: 'Flow name', kind: 'text', defaultOperator: 'equals' },
  ],
};

export function getTriggerFilters(appEvent: string | undefined): FilterField[] {
  if (!appEvent) return [];
  return TRIGGER_FILTERS[appEvent] ?? [];
}

/**
 * Evaluate a single filter row against an inbound payload.
 * Returns true if the row matches (or is incomplete and should be ignored).
 */
export function evaluateFilter(
  filter: { path: string; operator: EventFilterOperator; value?: unknown },
  payload: unknown,
): boolean {
  const actual = readPath(payload, filter.path);
  const op = filter.operator;

  switch (op) {
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    case 'not_exists':
      return actual === undefined || actual === null || actual === '';
  }

  if (filter.value === undefined || filter.value === '') return true;

  switch (op) {
    case 'equals':
      return coerceCompare(actual) === coerceCompare(filter.value);
    case 'not_equals':
      return coerceCompare(actual) !== coerceCompare(filter.value);
    case 'contains':
      return String(actual ?? '').toLowerCase().includes(String(filter.value).toLowerCase()) ||
        (Array.isArray(actual) && actual.some((v) => String(v).toLowerCase() === String(filter.value).toLowerCase()));
    case 'not_contains':
      return !String(actual ?? '').toLowerCase().includes(String(filter.value).toLowerCase());
    case 'starts_with':
      return String(actual ?? '').toLowerCase().startsWith(String(filter.value).toLowerCase());
    case 'ends_with':
      return String(actual ?? '').toLowerCase().endsWith(String(filter.value).toLowerCase());
    case 'gt':
      return Number(actual) > Number(filter.value);
    case 'gte':
      return Number(actual) >= Number(filter.value);
    case 'lt':
      return Number(actual) < Number(filter.value);
    case 'lte':
      return Number(actual) <= Number(filter.value);
    case 'in': {
      const list = Array.isArray(filter.value)
        ? filter.value
        : String(filter.value).split(',').map((s) => s.trim());
      return list.map(coerceCompare).includes(coerceCompare(actual));
    }
    case 'not_in': {
      const list = Array.isArray(filter.value)
        ? filter.value
        : String(filter.value).split(',').map((s) => s.trim());
      return !list.map(coerceCompare).includes(coerceCompare(actual));
    }
    default:
      return true;
  }
}

function coerceCompare(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Lightweight dot-path reader supporting `a.b.c`, `a[0]`, and `a["key"]`. */
function readPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\["([^"]+)"\]/g, '.$1')
    .replace(/\['([^']+)'\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let cursor: unknown = obj;
  for (const segment of parts) {
    if (cursor === null || cursor === undefined) return undefined;
    if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
}
