/**
 * Sample payload registry — used by the TriggerEventSettings panel to render
 * a preview of what the flow's `$trigger` variable will look like at runtime,
 * and by the manual "test run" path as the default `triggerData`.
 *
 * Payloads are grouped by category so every event in a family shares a base
 * shape and only differs where it matters (`event` slug, timestamps).
 */

const isoNow = '2026-05-12T10:00:00.000Z';

const BASE_CONTACT = {
  id: 'contact_8c14a',
  name: 'Aanya Sharma',
  phone: '+91 98765 43210',
  email: 'aanya@example.com',
  tags: ['vip', 'lead'],
  ownerId: 'user_3d2e1',
  createdAt: isoNow,
  customFields: { city: 'Mumbai', plan: 'pro' },
};

const BASE_DEAL = {
  id: 'deal_a91b2',
  name: 'Acme — Annual License',
  pipelineId: 'pipeline_sales',
  stageId: 'stage_negotiation',
  value: 25000,
  currency: 'USD',
  probability: 60,
  ownerId: 'user_3d2e1',
  contactId: 'contact_8c14a',
  createdAt: isoNow,
};

const BASE_LEAD = {
  id: 'lead_5f3c8',
  name: 'Vikram Patel',
  email: 'vikram@example.com',
  phone: '+91 90000 12345',
  status: 'new',
  source: 'landing_page_demo',
  score: 72,
  ownerId: 'user_3d2e1',
  createdAt: isoNow,
};

const BASE_INVOICE = {
  id: 'inv_2025_0042',
  number: 'INV-2025-0042',
  status: 'sent',
  amount: 12500,
  currency: 'USD',
  customerId: 'contact_8c14a',
  dueDate: '2026-05-30',
  issuedAt: isoNow,
};

const BASE_QUOTATION = {
  id: 'quote_0017',
  number: 'Q-2025-0017',
  status: 'sent',
  amount: 9800,
  currency: 'USD',
  customerId: 'contact_8c14a',
  validUntil: '2026-06-15',
  issuedAt: isoNow,
};

const BASE_PRODUCT = {
  id: 'prod_keyboard_x',
  sku: 'KB-X-001',
  name: 'Mechanical Keyboard X',
  category: 'peripherals',
  price: 149,
  currency: 'USD',
  stock: 42,
  warehouseId: 'wh_mum_1',
  updatedAt: isoNow,
};

const BASE_TASK = {
  id: 'task_99af1',
  title: 'Follow up with Acme',
  description: 'Send pricing proposal',
  assigneeId: 'user_3d2e1',
  dueAt: '2026-05-14T17:00:00.000Z',
  priority: 'high',
  status: 'open',
  relatedTo: 'contact:contact_8c14a',
};

const BASE_BROADCAST = {
  id: 'bc_4477',
  name: 'May launch campaign',
  channel: 'whatsapp',
  templateName: 'launch_announce_v2',
  audienceCount: 8421,
  scheduledFor: isoNow,
  createdBy: 'user_3d2e1',
};

const BASE_TEMPLATE = {
  id: 'tpl_28f0',
  name: 'order_confirmation',
  category: 'UTILITY',
  language: 'en_US',
  status: 'APPROVED',
  components: [
    { type: 'BODY', text: 'Your order {{1}} is confirmed.' },
  ],
  updatedAt: isoNow,
};

const BASE_WHATSAPP_MESSAGE = {
  phoneNumberId: '1234567890',
  wabaId: '9988776655',
  message: {
    id: 'wamid.HBgM...',
    from: '919876543210',
    timestamp: isoNow,
    type: 'text',
    text: { body: 'Hello, I need help with my order' },
  },
  contact: { name: 'Aanya Sharma', wa_id: '919876543210' },
};

const BASE_CALL = {
  phoneNumberId: '1234567890',
  call: {
    id: 'wacall_1a2b3',
    from: '919876543210',
    to: '911100001100',
    direction: 'inbound',
    durationSec: 142,
    startedAt: isoNow,
  },
};

const BASE_EMAIL = {
  email: {
    id: 'mail_8f2',
    to: 'aanya@example.com',
    from: 'sales@yourbrand.com',
    subject: 'Welcome to YourBrand',
    campaignId: 'cmp_spring_launch',
    timestamp: isoNow,
  },
};

const BASE_SMS = {
  sms: {
    id: 'sms_a99',
    to: '+919876543210',
    from: 'SHRT',
    text: 'Your OTP is 123456',
    timestamp: isoNow,
  },
};

const BASE_PAYMENT = {
  payment: {
    id: 'pay_44a1',
    amount: 4999,
    currency: 'INR',
    method: 'upi',
    status: 'captured',
    transactionId: 'txn_77bc12',
    capturedAt: isoNow,
  },
};

const BASE_ORDER = {
  order: {
    id: 'ord_2025_777',
    status: 'confirmed',
    total: 8997,
    currency: 'INR',
    customerId: 'contact_8c14a',
    items: [
      { sku: 'KB-X-001', name: 'Mechanical Keyboard X', qty: 1, price: 8997 },
    ],
    channel: 'whatsapp_catalog',
    placedAt: isoNow,
  },
};

const BASE_SOCIAL_MESSAGE = {
  pageId: '102937485',
  contactId: 'fb_user_abc123',
  message: {
    id: 'mid.$4abc',
    text: 'Is the latest model in stock?',
    timestamp: isoNow,
  },
};

export const SAMPLE_PAYLOADS: Record<string, unknown> = {
  // ── General ────────────────────────────────────────────────────────────
  flow_start: { startedAt: isoNow },
  manual_trigger: { userId: 'user_3d2e1', startedAt: isoNow },
  on_schedule: { firedAt: isoNow, cron: '0 9 * * 1-5' },
  on_webhook: {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    query: { source: 'partner' },
    body: { event: 'demo.request', email: 'aanya@example.com' },
  },
  on_error: {
    failedAt: isoNow,
    flowId: 'flow_abc',
    executionId: 'exec_xyz',
    error: { message: 'Step "webhook" timed out', code: 'TIMEOUT' },
  },

  // ── WhatsApp ───────────────────────────────────────────────────────────
  whatsapp_message_received: BASE_WHATSAPP_MESSAGE,
  whatsapp_message_read: {
    phoneNumberId: '1234567890',
    status: { id: 'wamid.HBgM...', recipientId: '919876543210', status: 'read', timestamp: isoNow },
  },
  whatsapp_message_failed: {
    phoneNumberId: '1234567890',
    status: { id: 'wamid.HBgM...', recipientId: '919876543210', status: 'failed', errors: [{ code: 131026, title: 'Recipient phone number not in allowed list' }], timestamp: isoNow },
  },
  whatsapp_template_approved: { ...BASE_TEMPLATE, status: 'APPROVED' },
  whatsapp_template_rejected: { ...BASE_TEMPLATE, status: 'REJECTED', rejectionReason: 'TAG_CONTENT_MISMATCH' },
  whatsapp_contact_opted_in: { wabaId: '9988776655', phoneNumberId: '1234567890', contact: { wa_id: '919876543210' }, occurredAt: isoNow },
  whatsapp_contact_opted_out: { wabaId: '9988776655', phoneNumberId: '1234567890', contact: { wa_id: '919876543210' }, reason: 'STOP', occurredAt: isoNow },
  whatsapp_phone_quality_updated: { wabaId: '9988776655', phoneNumberId: '1234567890', quality: 'YELLOW', previousQuality: 'GREEN' },
  whatsapp_phone_verified: { wabaId: '9988776655', phoneNumberId: '1234567890', displayName: 'YourBrand', verifiedAt: isoNow },
  whatsapp_account_violation: { wabaId: '9988776655', violation: 'POLICY_VIOLATION', severity: 'MEDIUM', occurredAt: isoNow },
  whatsapp_account_disabled: { wabaId: '9988776655', reason: 'POLICY_VIOLATION', disabledAt: isoNow },

  // ── Calls ──────────────────────────────────────────────────────────────
  call_incoming: BASE_CALL,
  call_outgoing_started: { ...BASE_CALL, call: { ...BASE_CALL.call, direction: 'outbound' } },
  call_answered: { ...BASE_CALL, call: { ...BASE_CALL.call, answeredAt: isoNow } },
  call_missed: { ...BASE_CALL, call: { ...BASE_CALL.call, status: 'missed' } },
  call_completed: { ...BASE_CALL, call: { ...BASE_CALL.call, status: 'completed', endedAt: isoNow } },
  call_terminated: { ...BASE_CALL, call: { ...BASE_CALL.call, status: 'terminated', endedAt: isoNow } },
  calling_settings_updated: { phoneNumberId: '1234567890', settings: { callHours: '09:00-18:00 IST', sipEnabled: true }, updatedAt: isoNow },

  // ── CRM Contacts ───────────────────────────────────────────────────────
  contact_created: { contact: BASE_CONTACT, occurredAt: isoNow },
  contact_updated: { contact: BASE_CONTACT, changedFields: ['email', 'tags'], occurredAt: isoNow },
  contact_tagged: { contact: BASE_CONTACT, addedTags: ['vip'], removedTags: [], occurredAt: isoNow },
  contact_assigned: { contact: BASE_CONTACT, previousOwnerId: 'user_old', newOwnerId: 'user_3d2e1', occurredAt: isoNow },
  contact_merged: { primary: BASE_CONTACT, mergedIds: ['contact_dup1', 'contact_dup2'], occurredAt: isoNow },
  contact_imported: { import: { id: 'imp_22b', source: 'csv_upload', totalCount: 421, successCount: 415, errorCount: 6, completedAt: isoNow } },
  account_created: { account: { id: 'acc_771', name: 'Acme Corp', industry: 'saas', size: '50-200', ownerId: 'user_3d2e1' }, occurredAt: isoNow },
  account_updated: { account: { id: 'acc_771', name: 'Acme Corp', industry: 'saas', ownerId: 'user_3d2e1' }, changedFields: ['size'], occurredAt: isoNow },
  contact_note_added: { contact: BASE_CONTACT, note: { id: 'note_a1', body: 'Called and confirmed renewal', authorId: 'user_3d2e1', createdAt: isoNow } },

  // ── CRM Deals ──────────────────────────────────────────────────────────
  deal_created: { deal: BASE_DEAL, occurredAt: isoNow },
  deal_moved: { deal: BASE_DEAL, previousStageId: 'stage_qualified', occurredAt: isoNow },
  deal_closed_won: { deal: { ...BASE_DEAL, stageId: 'stage_closed_won' }, occurredAt: isoNow },
  deal_closed_lost: { deal: { ...BASE_DEAL, stageId: 'stage_closed_lost' }, lostReason: 'price', occurredAt: isoNow },
  deal_assigned: { deal: BASE_DEAL, previousOwnerId: 'user_old', newOwnerId: 'user_3d2e1', occurredAt: isoNow },
  deal_probability_updated: { deal: BASE_DEAL, previousProbability: 40, newProbability: 60, occurredAt: isoNow },
  deal_value_updated: { deal: BASE_DEAL, previousValue: 20000, newValue: 25000, occurredAt: isoNow },

  // ── CRM Leads ──────────────────────────────────────────────────────────
  lead_created: { lead: BASE_LEAD, occurredAt: isoNow },
  lead_status_changed: { lead: BASE_LEAD, previousStatus: 'new', occurredAt: isoNow },
  lead_assigned: { lead: BASE_LEAD, previousOwnerId: 'user_old', newOwnerId: 'user_3d2e1', occurredAt: isoNow },
  lead_converted: { lead: BASE_LEAD, convertedTo: { dealId: 'deal_a91b2', contactId: 'contact_8c14a' }, occurredAt: isoNow },
  lead_source_tracked: { lead: BASE_LEAD, attribution: { campaign: 'spring_demo', medium: 'whatsapp', source: 'broadcast' }, occurredAt: isoNow },
  lead_follow_up_due: { lead: BASE_LEAD, followUp: { scheduledAt: isoNow, attempt: 2 } },

  // ── CRM Sales ──────────────────────────────────────────────────────────
  invoice_created: { invoice: BASE_INVOICE, occurredAt: isoNow },
  invoice_sent: { invoice: BASE_INVOICE, deliveryChannel: 'whatsapp', occurredAt: isoNow },
  invoice_marked_paid: { invoice: { ...BASE_INVOICE, status: 'paid' }, occurredAt: isoNow },
  invoice_payment_received: { invoice: BASE_INVOICE, payment: BASE_PAYMENT.payment, occurredAt: isoNow },
  invoice_overdue: { invoice: { ...BASE_INVOICE, status: 'overdue' }, daysOverdue: 7 },
  payment_receipt_created: { receipt: { id: 'rcpt_88a', invoiceId: BASE_INVOICE.id, amount: BASE_INVOICE.amount, currency: BASE_INVOICE.currency, issuedAt: isoNow } },
  quotation_created: { quotation: BASE_QUOTATION, occurredAt: isoNow },
  quotation_sent: { quotation: BASE_QUOTATION, deliveryChannel: 'email', occurredAt: isoNow },

  // ── CRM Products ───────────────────────────────────────────────────────
  product_created: { product: BASE_PRODUCT, occurredAt: isoNow },
  product_updated: { product: BASE_PRODUCT, changedFields: ['price'], occurredAt: isoNow },
  product_stock_low: { product: { ...BASE_PRODUCT, stock: 4 }, threshold: 5 },
  product_stock_out: { product: { ...BASE_PRODUCT, stock: 0 } },
  product_price_changed: { product: BASE_PRODUCT, previousPrice: 129, newPrice: 149, occurredAt: isoNow },
  warehouse_stock_updated: { product: BASE_PRODUCT, warehouseId: 'wh_mum_1', delta: -3, occurredAt: isoNow },

  // ── CRM Tasks ──────────────────────────────────────────────────────────
  task_created: { task: BASE_TASK, occurredAt: isoNow },
  task_assigned: { task: BASE_TASK, previousAssigneeId: 'user_old', newAssigneeId: 'user_3d2e1', occurredAt: isoNow },
  task_completed: { task: { ...BASE_TASK, status: 'done' }, occurredAt: isoNow },
  task_due: { task: BASE_TASK },
  crm_automation_triggered: { automation: { id: 'auto_88c', name: 'Auto-tag inbound leads', triggeredBy: 'lead_created' }, payload: { lead: BASE_LEAD } },

  // ── Broadcasts ─────────────────────────────────────────────────────────
  broadcast_created: { broadcast: BASE_BROADCAST, occurredAt: isoNow },
  broadcast_scheduled: { broadcast: BASE_BROADCAST, scheduledFor: isoNow },
  broadcast_sent: { broadcast: BASE_BROADCAST, startedAt: isoNow },
  broadcast_completed: { broadcast: BASE_BROADCAST, stats: { sent: 8421, delivered: 8275, failed: 146 }, completedAt: isoNow },
  broadcast_paused: { broadcast: BASE_BROADCAST, pausedAt: isoNow, reason: 'rate_limited' },
  broadcast_resumed: { broadcast: BASE_BROADCAST, resumedAt: isoNow },
  broadcast_failed: { broadcast: BASE_BROADCAST, error: { code: 'TEMPLATE_DISAPPROVED', message: 'Template was rejected mid-send' } },

  // ── Templates ──────────────────────────────────────────────────────────
  template_submitted: { template: { ...BASE_TEMPLATE, status: 'PENDING' }, submittedAt: isoNow },
  template_quality_updated: { template: BASE_TEMPLATE, quality: 'HIGH', previousQuality: 'MEDIUM' },
  template_edited: { template: BASE_TEMPLATE, changedFields: ['components'], occurredAt: isoNow },

  // ── Social ─────────────────────────────────────────────────────────────
  facebook_message_received: BASE_SOCIAL_MESSAGE,
  instagram_message_received: { ...BASE_SOCIAL_MESSAGE, platform: 'instagram' },
  facebook_broadcast_sent: { pageId: '102937485', broadcast: { id: 'fbc_771', audienceCount: 5400, sentAt: isoNow } },
  facebook_webhook_update: {
    object: 'page',
    entry: [{ id: '102937485', time: 1714999999, changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', commentId: 'c_22' } }] }],
  },

  // ── Email & SMS ────────────────────────────────────────────────────────
  email_sent: BASE_EMAIL,
  email_opened: { ...BASE_EMAIL, openedAt: isoNow, userAgent: 'Mozilla/5.0' },
  email_clicked: { ...BASE_EMAIL, link: { url: 'https://yourbrand.com/promo', text: 'See the offer' }, clickedAt: isoNow },
  sms_message_sent: BASE_SMS,
  sms_delivery_confirmed: { ...BASE_SMS, deliveredAt: isoNow },

  // ── Payments ───────────────────────────────────────────────────────────
  payment_received: BASE_PAYMENT,
  payment_failed: { payment: { ...BASE_PAYMENT.payment, status: 'failed', failureReason: 'INSUFFICIENT_FUNDS' } },
  payment_configuration_updated: { phoneNumberId: '1234567890', settings: { provider: 'razorpay', enabled: true }, updatedAt: isoNow },

  // ── Orders ─────────────────────────────────────────────────────────────
  order_created: BASE_ORDER,
  order_updated: { ...BASE_ORDER, order: { ...BASE_ORDER.order, status: 'confirmed' }, changedFields: ['status'] },
  order_shipped: { ...BASE_ORDER, order: { ...BASE_ORDER.order, status: 'shipped' }, shipment: { carrier: 'Bluedart', trackingId: 'BD123456789' } },
  catalog_product_event: { product: BASE_PRODUCT, catalogId: 'cat_main', event: 'update' },

  // ── SEO ────────────────────────────────────────────────────────────────
  seo_audit_completed: { site: { domain: 'example.com' }, score: 84, issuesCount: 7, completedAt: isoNow },
  ranking_improved: { site: { domain: 'example.com' }, keyword: 'whatsapp crm', previousRank: 12, newRank: 7 },
  ranking_dropped: { site: { domain: 'example.com' }, keyword: 'whatsapp crm', previousRank: 7, newRank: 12 },
  indexing_issue_detected: { site: { domain: 'example.com' }, url: 'https://example.com/blog/x', issue: 'NOINDEX_DETECTED', detectedAt: isoNow },

  // ── Integrations ───────────────────────────────────────────────────────
  webhook_received: {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-source': 'partner' },
    query: { token: 'abc' },
    body: { event: 'demo.request', payload: { email: 'aanya@example.com' } },
  },
  integration_connected: { integration: { provider: 'google_sheets', accountId: 'ggl_1' }, connectedAt: isoNow },
  integration_disconnected: { integration: { provider: 'google_sheets', accountId: 'ggl_1', reason: 'token_expired' }, disconnectedAt: isoNow },
  whatsapp_flow_triggered: {
    phoneNumberId: '1234567890',
    flow: { id: '4422', name: 'lead_capture', token: 'ftok_aa' },
    response: { name: 'Aanya', email: 'aanya@example.com' },
    submittedAt: isoNow,
  },
};

export function getSamplePayload(appEvent: string | undefined): unknown {
  if (!appEvent) return undefined;
  return SAMPLE_PAYLOADS[appEvent];
}
