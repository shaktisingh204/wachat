/**
 * Catalogue of every named dropdown enum used across the CRM + HRM.
 *
 * Backs the `<EntityFormField entity="enum" filter={{ enumName: '...' }} />`
 * (and its `<EnumFormField>` shorthand) so that any select that was
 * previously a hard-coded `<select>` gets the standard picker UX:
 * search, recents, inline-create, dual-write of the human label, plus
 * the same chip rendering as every other entity reference.
 *
 * Inline-create writes are stored locally as the typed string today
 * (id = label). When tenants ask to customize an enum, we'll promote
 * the entry to a Mongo collection (`crm_enum_values`) and the picker
 * keeps working unchanged — the registry just swaps its `fetch` impl.
 *
 * Adding a new enum: append a key to `CRM_ENUMS` and reference it from
 * the form via `<EnumFormField enumName="..." />`. The picker pulls
 * values via `lookupEntity('enum', { filter: { enumName: '...' } })`.
 */

export interface EnumValue {
  /** Stable identifier — usually the slug. */
  id: string;
  /** Human label shown in chips and dropdown rows. */
  label: string;
  /** Optional sub-label (e.g. tone hint, description). */
  description?: string;
  /** Optional tone for the picker chip / pill. */
  tone?: 'neutral' | 'success' | 'warning' | 'destructive' | 'info';
}

const v = (id: string, label?: string, opts: Partial<EnumValue> = {}): EnumValue => ({
  id,
  label: label ?? id,
  ...opts,
});

/* ------------------------------------------------------------------ */
/* Status enums                                                        */
/* ------------------------------------------------------------------ */

export const LEAD_STATUS: EnumValue[] = [
  v('new', 'New', { tone: 'info' }),
  v('contacted', 'Contacted', { tone: 'info' }),
  v('qualified', 'Qualified', { tone: 'success' }),
  v('proposal', 'Proposal sent', { tone: 'info' }),
  v('negotiation', 'In negotiation', { tone: 'warning' }),
  v('won', 'Won', { tone: 'success' }),
  v('lost', 'Lost', { tone: 'destructive' }),
  v('unqualified', 'Unqualified', { tone: 'neutral' }),
];

export const DEAL_STATUS: EnumValue[] = [
  v('open', 'Open', { tone: 'info' }),
  v('won', 'Won', { tone: 'success' }),
  v('lost', 'Lost', { tone: 'destructive' }),
  v('on_hold', 'On hold', { tone: 'warning' }),
  v('abandoned', 'Abandoned', { tone: 'destructive' }),
];

export const TASK_STATUS: EnumValue[] = [
  v('todo', 'To do', { tone: 'neutral' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('blocked', 'Blocked', { tone: 'warning' }),
  v('done', 'Done', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

/**
 * Legacy capitalised-literal task status used by the Rust-backed
 * `crm_tasks` collection (`CrmTaskStatus` = 'To-Do' | 'In Progress' |
 * 'Completed' | 'archived'). Kept as a distinct enum so we don't break
 * the wire contract; the catalogued `taskStatus` above is the modern
 * spelling used elsewhere.
 */
export const TASK_STATUS_LEGACY: EnumValue[] = [
  v('To-Do', 'To-Do', { tone: 'neutral' }),
  v('In Progress', 'In Progress', { tone: 'info' }),
  v('Completed', 'Completed', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/**
 * Worksuite-style project lifecycle status — preserves the original
 * lower-case-with-space wire literals consumed by `saveWsProject`.
 */
export const PROJECT_STATUS: EnumValue[] = [
  v('not started', 'Not started', { tone: 'neutral' }),
  v('in progress', 'In progress', { tone: 'info' }),
  v('on hold', 'On hold', { tone: 'warning' }),
  v('finished', 'Finished', { tone: 'success' }),
  v('canceled', 'Canceled', { tone: 'destructive' }),
];

/** Lightweight issue tracker status. */
export const ISSUE_STATUS: EnumValue[] = [
  v('open', 'Open', { tone: 'info' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('resolved', 'Resolved', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'neutral' }),
];

/** Milestone lifecycle status (Rust `CrmMilestoneStatus`). */
export const MILESTONE_STATUS: EnumValue[] = [
  v('planned', 'Planned', { tone: 'neutral' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('overdue', 'Overdue', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Subtask lifecycle status (Rust `CrmSubtaskStatus`). */
export const SUBTASK_STATUS: EnumValue[] = [
  v('todo', 'To do', { tone: 'neutral' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('done', 'Done', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Subtask parent-kind discriminator from `CrmSubtaskParentKind`. */
export const SUBTASK_PARENT_KIND_RUST: EnumValue[] = [
  v('task', 'CRM task'),
  v('project_task', 'Project task'),
];

/** Activity / task type — what kind of touchpoint is this. */
export const TASK_TYPE: EnumValue[] = [
  v('Call', 'Call'),
  v('Email', 'Email'),
  v('Meeting', 'Meeting'),
  v('Follow-up', 'Follow-up'),
  v('Demo', 'Demo'),
  v('Other', 'Other'),
];

/** Coarse-grained recurring frequency literal used by tasks. */
export const RECURRING_FREQUENCY_SIMPLE: EnumValue[] = [
  v('daily', 'Daily'),
  v('weekly', 'Weekly'),
  v('monthly', 'Monthly'),
  v('yearly', 'Yearly'),
];

/** Title-cased lead-status spelling kept by the legacy sales-crm form. */
export const LEAD_STATUS_LEGACY: EnumValue[] = [
  v('New', 'New', { tone: 'info' }),
  v('Contacted', 'Contacted', { tone: 'info' }),
  v('Qualified', 'Qualified', { tone: 'success' }),
  v('Unqualified', 'Unqualified', { tone: 'neutral' }),
  v('Converted', 'Converted', { tone: 'success' }),
];

/**
 * Filter-bar variant of lead status used on the All-Leads list page.
 * Includes `Won` + `archived` which the list filter exposes (but the
 * edit form doesn't). Sweep §1E.
 */
export const LEAD_STATUS_LIST_FILTER: EnumValue[] = [
  v('New', 'New', { tone: 'info' }),
  v('Contacted', 'Contacted', { tone: 'info' }),
  v('Qualified', 'Qualified', { tone: 'success' }),
  v('Won', 'Won', { tone: 'success' }),
  v('Converted', 'Converted', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Knowledge-base article visibility. */
export const KB_VISIBILITY: EnumValue[] = [
  v('public', 'Public', { tone: 'info' }),
  v('portal', 'Customer portal', { tone: 'info' }),
  v('internal', 'Internal only', { tone: 'neutral' }),
];

/** Knowledge-base article lifecycle. */
export const KB_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('published', 'Published', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Reply-template active/archived status. */
export const REPLY_TEMPLATE_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Reply-template category. */
export const REPLY_TEMPLATE_CATEGORY: EnumValue[] = [
  v('greeting', 'Greeting'),
  v('troubleshooting', 'Troubleshooting'),
  v('refund', 'Refund'),
  v('shipping', 'Shipping'),
  v('escalation', 'Escalation'),
  v('closing', 'Closing'),
  v('general', 'General'),
];

/** Short ISO-639 language picker used by templates/articles. */
export const LANGUAGE_SHORT: EnumValue[] = [
  v('en', 'English'),
  v('es', 'Spanish'),
  v('fr', 'French'),
  v('de', 'German'),
  v('pt', 'Portuguese'),
  v('hi', 'Hindi'),
];

/** Form-builder field types — text input, select, checkbox, etc. */
export const FORM_FIELD_TYPE: EnumValue[] = [
  v('text', 'Text'),
  v('textarea', 'Textarea'),
  v('email', 'Email'),
  v('phone', 'Phone'),
  v('url', 'URL'),
  v('number', 'Number'),
  v('date', 'Date'),
  v('select', 'Select'),
  v('radio', 'Radio'),
  v('checkbox', 'Checkbox'),
  v('file', 'File'),
];

/** Contact lifecycle/status (`new_lead/contacted/qualified/...`). */
export const CONTACT_STATUS: EnumValue[] = [
  v('new_lead', 'New lead', { tone: 'info' }),
  v('contacted', 'Contacted', { tone: 'info' }),
  v('qualified', 'Qualified', { tone: 'success' }),
  v('unqualified', 'Unqualified', { tone: 'neutral' }),
  v('customer', 'Customer', { tone: 'success' }),
  v('imported', 'Imported', { tone: 'neutral' }),
];

/** Marketing lifecycle stage. */
export const LIFECYCLE_STAGE: EnumValue[] = [
  v('subscriber', 'Subscriber'),
  v('lead', 'Lead'),
  v('mql', 'Marketing Qualified Lead'),
  v('sql', 'Sales Qualified Lead'),
  v('opportunity', 'Opportunity'),
  v('customer', 'Customer'),
  v('evangelist', 'Evangelist'),
];

/** Which entity kind a pipeline applies to. */
export const PIPELINE_ENTITY_KIND: EnumValue[] = [
  v('lead', 'Lead'),
  v('deal', 'Deal'),
  v('opportunity', 'Opportunity'),
];

/** Active / Draft / Archived lifecycle used by pipelines + similar models. */
export const ACTIVE_DRAFT_ARCHIVED: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('draft', 'Draft', { tone: 'neutral' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const TICKET_STATUS: EnumValue[] = [
  v('open', 'Open', { tone: 'info' }),
  v('pending', 'Pending', { tone: 'warning' }),
  v('on_hold', 'On hold', { tone: 'warning' }),
  v('resolved', 'Resolved', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'neutral' }),
  v('reopened', 'Re-opened', { tone: 'warning' }),
];

export const INVOICE_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('sent', 'Sent', { tone: 'info' }),
  v('partial', 'Partially paid', { tone: 'warning' }),
  v('paid', 'Paid', { tone: 'success' }),
  v('overdue', 'Overdue', { tone: 'destructive' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
  v('void', 'Void', { tone: 'destructive' }),
];

export const QUOTATION_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('sent', 'Sent', { tone: 'info' }),
  v('accepted', 'Accepted', { tone: 'success' }),
  v('declined', 'Declined', { tone: 'destructive' }),
  v('expired', 'Expired', { tone: 'destructive' }),
  v('converted', 'Converted', { tone: 'success' }),
];

export const SALES_ORDER_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('confirmed', 'Confirmed', { tone: 'info' }),
  v('packed', 'Packed', { tone: 'info' }),
  v('shipped', 'Shipped', { tone: 'info' }),
  v('delivered', 'Delivered', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
  v('returned', 'Returned', { tone: 'destructive' }),
];

/**
 * Rust-aligned Sales-Order fulfillment status — mirrors the
 * `CrmSalesOrderStatus` Rust union (`open | partial | fulfilled |
 * closed | cancelled`). Use this in surfaces that round-trip through
 * the Rust API. The richer `SALES_ORDER_STATUS` above stays as the
 * user-facing fulfillment ladder; `setSalesOrderStatus` translates.
 */
export const SALES_ORDER_FULFILLMENT_STATUS: EnumValue[] = [
  v('open', 'Open', { tone: 'info' }),
  v('partial', 'Partially fulfilled', { tone: 'warning' }),
  v('fulfilled', 'Fulfilled', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

/**
 * Sales-order delivery method — mirrors the Rust
 * `CrmSalesOrderDeliveryMethod` union. P1.1B Wave 2.
 */
export const SALES_ORDER_DELIVERY_METHOD: EnumValue[] = [
  v('courier', 'Courier'),
  v('transporter', 'Transporter'),
  v('in_house', 'In-house delivery'),
  v('pickup', 'Customer pickup'),
  v('digital', 'Digital delivery'),
];

export const PURCHASE_ORDER_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('sent', 'Sent', { tone: 'info' }),
  v('received', 'Goods received', { tone: 'info' }),
  v('billed', 'Billed', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

export const BILL_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('open', 'Open', { tone: 'info' }),
  v('partial', 'Partially paid', { tone: 'warning' }),
  v('paid', 'Paid', { tone: 'success' }),
  v('overdue', 'Overdue', { tone: 'destructive' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

export const RECEIPT_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('issued', 'Issued', { tone: 'info' }),
  v('applied', 'Applied', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

/**
 * Rust-aligned payment-receipt workflow status (P1.1B Wave 2). The
 * Rust DTO `CrmReceiptStatus` enumerates `received | cleared | bounced`
 * — those describe banking clearance lifecycle rather than the older
 * doc-state `RECEIPT_STATUS` enum. The receipt detail page's inline
 * status mutations (`Mark cleared` / `Mark bounced`) round-trip these
 * three values, so the picker must use this list.
 */
export const PAYMENT_RECEIPT_STATUS: EnumValue[] = [
  v('received', 'Received', { tone: 'info' }),
  v('cleared', 'Cleared', { tone: 'success' }),
  v('bounced', 'Bounced', { tone: 'destructive' }),
];

/**
 * Payment mode for a payment receipt — mirrors the `CrmPaymentMode`
 * Rust union. P1.1B Wave 2 — the receipt form's mode picker reads
 * this via `<EnumFormField enumName="paymentMode">`. Distinct from
 * `paymentMethod` (which is the looser, more user-facing payment
 * method list used on quotations / invoices / portals).
 */
export const PAYMENT_MODE: EnumValue[] = [
  v('cash', 'Cash'),
  v('cheque', 'Cheque'),
  v('upi', 'UPI'),
  v('neft', 'NEFT'),
  v('rtgs', 'RTGS'),
  v('imps', 'IMPS'),
  v('card', 'Card'),
  v('wallet', 'Wallet'),
];

export const CREDIT_NOTE_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('issued', 'Issued', { tone: 'info' }),
  v('applied', 'Applied', { tone: 'success' }),
  v('refunded', 'Refunded', { tone: 'success' }),
];

/**
 * Rust-aligned credit-note workflow status (P1.1B Wave 2). The Rust DTO
 * `CreditNoteStatus` enumerates `draft | issued | refunded | cancelled`
 * (no `applied` — that lives on the older legacy enum above). New code
 * should consume `creditNoteStatusV2` via `<EnumFormField>`; legacy
 * surfaces keep reading `creditNoteStatus`.
 */
export const CREDIT_NOTE_STATUS_V2: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('issued', 'Issued', { tone: 'info' }),
  v('refunded', 'Refunded', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

/**
 * Credit-note reason — mirrors the `CreditNoteReason` Rust union.
 * P1.1B Wave 2 — needed so `<EnumFormField enumName="creditNoteReason">`
 * resolves the picker entries.
 */
export const CREDIT_NOTE_REASON: EnumValue[] = [
  v('return', 'Return'),
  v('discount', 'Discount'),
  v('price_adjust', 'Price adjustment'),
  v('cancel', 'Cancellation'),
  v('other', 'Other'),
];

/**
 * Refund mode for a credit note — `cash` settles via bank/cash refund,
 * `credit` keeps the value on file against the customer (apply against
 * a future invoice), `replacement` ships a replacement instead. P1.1B
 * Wave 2 added so the form refund toggle uses `<EnumFormField>`.
 */
export const CREDIT_NOTE_REFUND_MODE: EnumValue[] = [
  v('cash', 'Cash / bank refund', { tone: 'info' }),
  v('credit', 'Apply as customer credit', { tone: 'success' }),
  v('replacement', 'Replacement', { tone: 'neutral' }),
];

export const DEBIT_NOTE_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('issued', 'Issued', { tone: 'info' }),
  v('applied', 'Applied', { tone: 'success' }),
];

/**
 * Rust-aligned debit-note workflow status (P1.1B W3 purchases rebuild).
 * Mirrors `DebitNoteStatus` = `draft | issued | refunded | cancelled`.
 * New list pages use this; legacy surfaces keep `debitNoteStatus`.
 */
export const DEBIT_NOTE_STATUS_V2: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('issued', 'Issued', { tone: 'info' }),
  v('refunded', 'Refunded', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

/**
 * Debit-note reason — buy-side mirror of `creditNoteReason`. P1.1B W3.
 */
export const DEBIT_NOTE_REASON: EnumValue[] = [
  v('return', 'Return'),
  v('discount', 'Discount'),
  v('price_adjust', 'Price adjustment'),
  v('cancel', 'Cancellation'),
  v('other', 'Other'),
];

/**
 * Debit-note refund mode — how the buyer recovers the credit.
 * Buy-side mirror of `creditNoteRefundMode`. P1.1B W3.
 */
export const DEBIT_NOTE_REFUND_MODE: EnumValue[] = [
  v('cash', 'Cash / bank', { tone: 'info' }),
  v('credit', 'Vendor credit', { tone: 'success' }),
  v('replacement', 'Replacement', { tone: 'neutral' }),
];

/**
 * Recurring-expense schedule lifecycle — P1.1B W3. Used by both the
 * worksuite-billing path and the Rust v2 action path.
 */
export const RECURRING_EXPENSE_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('paused', 'Paused', { tone: 'warning' }),
  v('stopped', 'Stopped', { tone: 'neutral' }),
  v('completed', 'Completed', { tone: 'neutral' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

/**
 * Hire / vendor-services procurement stage — P1.1B W3. Distinct from
 * `hireStatus` (approval lifecycle); this tracks the sourcing funnel
 * stage shown on the hire-list table.
 */
export const HIRE_STAGE: EnumValue[] = [
  v('sourcing', 'Sourcing', { tone: 'neutral' }),
  v('shortlisted', 'Shortlisted', { tone: 'info' }),
  v('negotiation', 'Negotiation', { tone: 'warning' }),
  v('awarded', 'Awarded', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'neutral' }),
  v('closed_lost', 'Closed (lost)', { tone: 'destructive' }),
  v('quotes_received', 'Quotes received', { tone: 'info' }),
];

/**
 * Vendor / client industry classification — shared across new-vendor and
 * new-client forms. P1.1B W3 sweep.
 */
export const VENDOR_INDUSTRY: EnumValue[] = [
  v('tech', 'Technology'),
  v('retail', 'Retail'),
  v('manufacturing', 'Manufacturing'),
  v('healthcare', 'Healthcare'),
  v('logistics', 'Logistics / Transport'),
  v('finance', 'Finance / Banking'),
  v('construction', 'Construction'),
  v('food', 'Food & Beverage'),
  v('education', 'Education'),
  v('hospitality', 'Hospitality'),
  v('agriculture', 'Agriculture'),
  v('energy', 'Energy / Utilities'),
  v('media', 'Media / Advertising'),
  v('government', 'Government / PSU'),
  v('other', 'Other'),
];

/**
 * GST / tax-treatment classification for vendor and client forms.
 * Simpler than `gstTreatment` — used on the vendor form's Tax Treatment
 * field. P1.1B W3 sweep.
 */
export const TAX_TREATMENT: EnumValue[] = [
  v('registered', 'Registered'),
  v('unregistered', 'Unregistered'),
  v('composition', 'Composition'),
  v('consumer', 'Consumer'),
  v('overseas', 'Overseas / Export'),
  v('sez', 'SEZ'),
];

/**
 * MSME category per MSMED Act 2006 — Micro / Small / Medium.
 * Used on the vendor form's MSME compliance section. P1.1B W3 sweep.
 */
export const MSME_CATEGORY: EnumValue[] = [
  v('Micro', 'Micro'),
  v('Small', 'Small'),
  v('Medium', 'Medium'),
];


/**
 * Payout (vendor payment) workflow status — P1.1B W3 (Purchases rebuild).
 * Mirrors the Rust `CrmPayoutStatus` lifecycle: a payout is `pending` when
 * created, `processing` once handed to the bank rail, `cleared` after the
 * bank confirms (success terminal), `failed` on bank rejection, or
 * `reversed` if the user voids it post-clearance. The detail page's inline
 * "Mark cleared" / "Reverse" actions round-trip these values.
 */
export const PAYOUT_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('processing', 'Processing', { tone: 'info' }),
  v('cleared', 'Cleared', { tone: 'success' }),
  v('failed', 'Failed', { tone: 'destructive' }),
  v('reversed', 'Reversed', { tone: 'destructive' }),
];

/**
 * Vendor bid workflow status — P1.1B W3 (Purchases rebuild). Bids start
 * `submitted`, can be `shortlisted`, then `accepted` (terminal-success →
 * convert-to-PO) or `rejected`. `countered` is the buyer's counter-offer
 * round trip; the buyer surfaces it from the detail page's "Counter-offer"
 * action.
 */
export const VENDOR_BID_STATUS: EnumValue[] = [
  v('submitted', 'Submitted', { tone: 'info' }),
  v('shortlisted', 'Shortlisted', { tone: 'info' }),
  v('countered', 'Counter-offered', { tone: 'warning' }),
  v('accepted', 'Accepted', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('withdrawn', 'Withdrawn', { tone: 'neutral' }),
];

/**
 * Hire (procurement-of-services) lifecycle — P1.1B W3 (Purchases rebuild).
 * Surfaces only when the `hire` module is enabled. `requested` → an
 * approver `approves` or `rejects`; once approved the contract is
 * `engaged` (active service), then either `completed` (service delivered)
 * or `cancelled`.
 */
export const HIRE_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('requested', 'Requested', { tone: 'info' }),
  v('approved', 'Approved', { tone: 'success' }),
  v('engaged', 'Engaged', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

export const SUBSCRIPTION_STATUS: EnumValue[] = [
  v('trial', 'Trial', { tone: 'info' }),
  v('active', 'Active', { tone: 'success' }),
  v('past_due', 'Past due', { tone: 'warning' }),
  v('paused', 'Paused', { tone: 'warning' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
  v('expired', 'Expired', { tone: 'destructive' }),
];

export const CONTRACT_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('pending_signature', 'Pending signature', { tone: 'warning' }),
  v('active', 'Active', { tone: 'success' }),
  v('expired', 'Expired', { tone: 'destructive' }),
  v('terminated', 'Terminated', { tone: 'destructive' }),
  v('renewed', 'Renewed', { tone: 'success' }),
];

export const RFQ_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('sent', 'Sent', { tone: 'info' }),
  v('bids_received', 'Bids received', { tone: 'info' }),
  v('awarded', 'Awarded', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'neutral' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

export const APPROVAL_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('approved', 'Approved', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('withdrawn', 'Withdrawn', { tone: 'neutral' }),
];

/* ------------------------------------------------------------------ */
/* HR enums                                                            */
/* ------------------------------------------------------------------ */

export const EMPLOYEE_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('on_leave', 'On leave', { tone: 'warning' }),
  v('on_notice', 'On notice', { tone: 'warning' }),
  v('terminated', 'Terminated', { tone: 'destructive' }),
  v('retired', 'Retired', { tone: 'neutral' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const EMPLOYMENT_TYPE: EnumValue[] = [
  v('full_time', 'Full-time'),
  v('part_time', 'Part-time'),
  v('contractor', 'Contractor'),
  v('intern', 'Intern'),
  v('temporary', 'Temporary'),
  v('consultant', 'Consultant'),
  v('freelancer', 'Freelancer'),
];

export const GENDER: EnumValue[] = [
  v('male', 'Male'),
  v('female', 'Female'),
  v('non_binary', 'Non-binary'),
  v('prefer_not_to_say', 'Prefer not to say'),
];

export const MARITAL_STATUS: EnumValue[] = [
  v('single', 'Single'),
  v('married', 'Married'),
  v('divorced', 'Divorced'),
  v('widowed', 'Widowed'),
  v('separated', 'Separated'),
];

export const BLOOD_GROUP: EnumValue[] = [
  v('A+', 'A+'),
  v('A-', 'A-'),
  v('B+', 'B+'),
  v('B-', 'B-'),
  v('AB+', 'AB+'),
  v('AB-', 'AB-'),
  v('O+', 'O+'),
  v('O-', 'O-'),
];

export const LEAVE_TYPE: EnumValue[] = [
  v('casual', 'Casual leave'),
  v('sick', 'Sick leave'),
  v('earned', 'Earned leave'),
  v('paid', 'Paid leave'),
  v('unpaid', 'Unpaid leave'),
  v('maternity', 'Maternity'),
  v('paternity', 'Paternity'),
  v('bereavement', 'Bereavement'),
  v('compensatory', 'Compensatory'),
  v('study', 'Study leave'),
];

export const LEAVE_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('approved', 'Approved', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('cancelled', 'Cancelled', { tone: 'neutral' }),
];

export const ATTENDANCE_STATUS: EnumValue[] = [
  v('present', 'Present', { tone: 'success' }),
  v('absent', 'Absent', { tone: 'destructive' }),
  v('half_day', 'Half day', { tone: 'warning' }),
  v('late', 'Late', { tone: 'warning' }),
  v('on_leave', 'On leave', { tone: 'info' }),
  v('holiday', 'Holiday', { tone: 'neutral' }),
  v('week_off', 'Week off', { tone: 'neutral' }),
];

export const INTERVIEW_STATUS: EnumValue[] = [
  v('scheduled', 'Scheduled', { tone: 'info' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
  v('no_show', 'No-show', { tone: 'destructive' }),
];

export const CANDIDATE_STATUS: EnumValue[] = [
  v('applied', 'Applied', { tone: 'info' }),
  v('screening', 'Screening', { tone: 'info' }),
  v('interviewing', 'Interviewing', { tone: 'info' }),
  v('offered', 'Offered', { tone: 'success' }),
  v('hired', 'Hired', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('withdrew', 'Withdrew', { tone: 'neutral' }),
];

/* ------------------------------------------------------------------ */
/* HR — recruiting + lifecycle pipeline stages (1E sweep)             */
/* ------------------------------------------------------------------ */

export const CANDIDATE_STAGE: EnumValue[] = [
  v('applied', 'Applied', { tone: 'info' }),
  v('screening', 'Screening', { tone: 'info' }),
  v('interview', 'Interview', { tone: 'info' }),
  v('offer', 'Offer', { tone: 'success' }),
  v('hired', 'Hired', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const CANDIDATE_SOURCE: EnumValue[] = [
  v('linkedin', 'LinkedIn'),
  v('referral', 'Referral'),
  v('website', 'Website'),
  v('agency', 'Agency'),
  v('job_board', 'Job board'),
  v('campus', 'Campus'),
  v('walk_in', 'Walk-in'),
  v('other', 'Other'),
];

export const OFFER_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('sent', 'Sent', { tone: 'info' }),
  v('accepted', 'Accepted', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('expired', 'Expired', { tone: 'destructive' }),
  v('withdrawn', 'Withdrawn', { tone: 'neutral' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const OFFER_SALARY_PERIOD: EnumValue[] = [
  v('annual', 'Annual'),
  v('monthly', 'Monthly'),
  v('hourly', 'Hourly'),
];

export const INTERVIEW_TYPE: EnumValue[] = [
  v('phone', 'Phone'),
  v('video', 'Video'),
  v('onsite', 'Onsite'),
  v('async_assessment', 'Async assessment'),
];

export const INTERVIEW_RECOMMENDATION: EnumValue[] = [
  v('strong_hire', 'Strong hire', { tone: 'success' }),
  v('hire', 'Hire', { tone: 'success' }),
  v('no_hire', 'No hire', { tone: 'destructive' }),
  v('strong_no_hire', 'Strong no hire', { tone: 'destructive' }),
];

export const INTERVIEW_LIFECYCLE: EnumValue[] = [
  v('scheduled', 'Scheduled', { tone: 'info' }),
  v('rescheduled', 'Rescheduled', { tone: 'warning' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('no_show', 'No-show', { tone: 'destructive' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const ONBOARDING_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const ONBOARDING_TASK_STATUS: EnumValue[] = [
  v('todo', 'To do', { tone: 'neutral' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('done', 'Done', { tone: 'success' }),
  v('blocked', 'Blocked', { tone: 'destructive' }),
];

export const EXIT_TYPE: EnumValue[] = [
  v('resignation', 'Resignation'),
  v('termination', 'Termination'),
  v('end_of_contract', 'End of contract'),
  v('retirement', 'Retirement'),
  v('other', 'Other'),
];

export const EXIT_STATUS: EnumValue[] = [
  v('open', 'Open', { tone: 'info' }),
  v('complete', 'Complete', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const EXIT_CLEARANCE_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('cleared', 'Cleared', { tone: 'success' }),
  v('waived', 'Waived', { tone: 'neutral' }),
];

export const NOC_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('issued', 'Issued', { tone: 'success' }),
  v('na', 'Not applicable', { tone: 'neutral' }),
];

export const ASSET_RETURN_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('partial', 'Partial', { tone: 'warning' }),
  v('complete', 'Complete', { tone: 'success' }),
];

export const PROBATION_STATUS: EnumValue[] = [
  v('in_progress', 'In progress', { tone: 'info' }),
  v('confirmed', 'Confirmed', { tone: 'success' }),
  v('extended', 'Extended', { tone: 'warning' }),
  v('terminated', 'Terminated', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const PROBATION_RECOMMENDATION: EnumValue[] = [
  v('confirm', 'Confirm', { tone: 'success' }),
  v('extend', 'Extend', { tone: 'warning' }),
  v('terminate', 'Terminate', { tone: 'destructive' }),
];

export const JOB_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('open', 'Open', { tone: 'success' }),
  v('on_hold', 'On hold', { tone: 'warning' }),
  v('closed', 'Closed', { tone: 'neutral' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const JOB_EMPLOYMENT_TYPE: EnumValue[] = [
  v('full_time', 'Full-time'),
  v('part_time', 'Part-time'),
  v('contract', 'Contract'),
  v('internship', 'Internship'),
  v('temporary', 'Temporary'),
];

export const JOB_EXPERIENCE_LEVEL: EnumValue[] = [
  v('intern', 'Intern'),
  v('entry', 'Entry'),
  v('mid', 'Mid'),
  v('senior', 'Senior'),
  v('lead', 'Lead'),
  v('staff', 'Staff'),
  v('principal', 'Principal'),
];

export const JOB_WORK_MODE: EnumValue[] = [
  v('on_site', 'On-site'),
  v('hybrid', 'Hybrid'),
  v('remote', 'Remote'),
];

/* ------------------------------------------------------------------ */
/* HR — operations / engagement (1E sweep)                            */
/* ------------------------------------------------------------------ */

export const TRAVEL_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('submitted', 'Submitted', { tone: 'info' }),
  v('approved', 'Approved', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('booked', 'Booked', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

export const TRAVEL_MODE: EnumValue[] = [
  v('flight', 'Flight'),
  v('train', 'Train'),
  v('bus', 'Bus'),
  v('car', 'Car'),
  v('other', 'Other'),
];

export const TRAINING_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('scheduled', 'Scheduled', { tone: 'info' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

export const TRAINING_DELIVERY_MODE: EnumValue[] = [
  v('in_person', 'In person'),
  v('online', 'Online'),
  v('hybrid', 'Hybrid'),
  v('self_paced', 'Self-paced'),
];

export const ASSET_ASSIGNMENT_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('returned', 'Returned', { tone: 'neutral' }),
  v('lost', 'Lost', { tone: 'destructive' }),
  v('damaged', 'Damaged', { tone: 'destructive' }),
  v('pending', 'Pending', { tone: 'warning' }),
];

export const DISCIPLINARY_TYPE: EnumValue[] = [
  v('verbal_warning', 'Verbal warning'),
  v('written_warning', 'Written warning'),
  v('final_warning', 'Final warning'),
  v('suspension', 'Suspension'),
  v('termination', 'Termination'),
  v('other', 'Other'),
];

export const DISCIPLINARY_STATUS: EnumValue[] = [
  v('open', 'Open', { tone: 'info' }),
  v('investigating', 'Investigating', { tone: 'warning' }),
  v('action_taken', 'Action taken', { tone: 'info' }),
  v('closed', 'Closed', { tone: 'success' }),
  v('appealed', 'Appealed', { tone: 'warning' }),
];

export const FEEDBACK_360_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

export const SURVEY_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('open', 'Open', { tone: 'info' }),
  v('closed', 'Closed', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const SURVEY_QUESTION_TYPE: EnumValue[] = [
  v('short_text', 'Short text'),
  v('long_text', 'Long text'),
  v('single_choice', 'Single choice'),
  v('multi_choice', 'Multi choice'),
  v('rating', 'Rating'),
  v('yes_no', 'Yes / No'),
  v('number', 'Number'),
  v('date', 'Date'),
];

export const ONE_ON_ONE_STATUS: EnumValue[] = [
  v('scheduled', 'Scheduled', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
  v('rescheduled', 'Rescheduled', { tone: 'warning' }),
];

export const OKR_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('active', 'Active', { tone: 'info' }),
  v('on_track', 'On track', { tone: 'success' }),
  v('at_risk', 'At risk', { tone: 'warning' }),
  v('off_track', 'Off track', { tone: 'destructive' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

export const OKR_PERIOD: EnumValue[] = [
  v('q1', 'Q1'),
  v('q2', 'Q2'),
  v('q3', 'Q3'),
  v('q4', 'Q4'),
  v('h1', 'H1'),
  v('h2', 'H2'),
  v('annual', 'Annual'),
];

export const GOAL_STATUS: EnumValue[] = [
  v('not_started', 'Not started', { tone: 'neutral' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('overdue', 'Overdue', { tone: 'destructive' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

export const APPRAISAL_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('in_review', 'In review', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('approved', 'Approved', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

// ── §1E HRM payroll Select migration ─────────────────────────────────────

/** Holiday type (national/regional/religious/optional/restricted). */
export const HOLIDAY_TYPE: EnumValue[] = [
  v('national', 'National', { tone: 'info' }),
  v('regional', 'Regional', { tone: 'info' }),
  v('religious', 'Religious', { tone: 'warning' }),
  v('optional', 'Optional', { tone: 'neutral' }),
  v('restricted', 'Restricted', { tone: 'neutral' }),
];

/** Days-off rule inside a shift definition (week-off vs consecutive). */
export const DAYS_OFF_TYPE: EnumValue[] = [
  v('week-off', 'Week Off', { tone: 'neutral' }),
  v('consecutive', 'Consecutive', { tone: 'neutral' }),
];

/** Payslip workflow status (Rust-backed payslips entity). */
export const PAYSLIP_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('issued', 'Issued', { tone: 'info' }),
  v('paid', 'Paid', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Payroll-run workflow status (legacy-Mongo payroll-runs entity). */
export const PAYROLL_RUN_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('processed', 'Processed', { tone: 'success' }),
  v('paid', 'Paid', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Payroll-run filter status (Rust crm-payroll-runs filter variant). */
export const PAYROLL_RUN_FILTER_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('processing', 'Processing', { tone: 'info' }),
  v('approved', 'Approved', { tone: 'success' }),
  v('disbursed', 'Disbursed', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'neutral' }),
];

/** Appraisal-review form status (Rust-backed crm-appraisals). */
export const APPRAISAL_FORM_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('submitted', 'Submitted', { tone: 'info' }),
  v('finalized', 'Finalized', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Goal form status (Rust-backed crm-goals — CrmGoalStatus). */
export const GOAL_FORM_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('active', 'Active', { tone: 'info' }),
  v('achieved', 'Achieved', { tone: 'success' }),
  v('missed', 'Missed', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Active / Archived two-state status (shifts, salary structures, rotations). */
export const ACTIVE_ARCHIVED: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** PF/ESI monthly record status. */
export const PF_ESI_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('deposited', 'Deposited', { tone: 'info' }),
  v('filed', 'Filed', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** KPI measurement frequency (CrmKpiFrequency). */
export const KPI_FREQUENCY: EnumValue[] = [
  v('monthly', 'Monthly', { tone: 'neutral' }),
  v('quarterly', 'Quarterly', { tone: 'neutral' }),
  v('annual', 'Annual', { tone: 'neutral' }),
];

/** KPI document status (CrmKpiStatus). */
export const KPI_FORM_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

// ── end §1E HRM payroll additions ─────────────────────────────────────────────

export const EXPENSE_CLAIM_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('submitted', 'Submitted', { tone: 'info' }),
  v('approved', 'Approved', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('reimbursed', 'Reimbursed', { tone: 'success' }),
];

export const ANNOUNCEMENT_AUDIENCE: EnumValue[] = [
  v('all', 'All employees'),
  v('department', 'Department'),
  v('team', 'Team'),
  v('location', 'Location'),
  v('role', 'Role'),
  v('custom', 'Custom'),
];

export const ANNOUNCEMENT_CATEGORY: EnumValue[] = [
  v('general', 'General'),
  v('hr', 'HR'),
  v('policy', 'Policy'),
  v('event', 'Event'),
  v('celebration', 'Celebration'),
  v('urgent', 'Urgent'),
];

export const ANNOUNCEMENT_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('scheduled', 'Scheduled', { tone: 'info' }),
  v('published', 'Published', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const ANNOUNCEMENT_SEVERITY: EnumValue[] = [
  v('info', 'Info', { tone: 'info' }),
  v('warning', 'Warning', { tone: 'warning' }),
  v('critical', 'Critical', { tone: 'destructive' }),
];

export const POLICY_CATEGORY: EnumValue[] = [
  v('hr', 'HR'),
  v('it', 'IT'),
  v('finance', 'Finance'),
  v('legal', 'Legal'),
  v('compliance', 'Compliance'),
  v('safety', 'Safety'),
  v('other', 'Other'),
];

export const POLICY_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('published', 'Published', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/**
 * Slug set used by the policy form (matches the `CrmPolicyCategory` Rust
 * type) — finer-grained than the catalogued `policyCategory` and kept
 * separate so legacy callers using IT/Legal/Compliance/Safety slugs are
 * not broken.
 */
export const POLICY_DOC_CATEGORY: EnumValue[] = [
  v('leave', 'Leave'),
  v('travel', 'Travel'),
  v('code_of_conduct', 'Code of conduct'),
  v('it_security', 'IT security'),
  v('hr', 'HR'),
  v('finance', 'Finance'),
  v('other', 'Other'),
];

/**
 * Lifecycle status used by the policy form — adds `under_review` and
 * `obsolete` on top of the catalogued `policyStatus`.
 */
export const POLICY_DOC_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('under_review', 'Under review', { tone: 'warning' }),
  v('published', 'Published', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
  v('obsolete', 'Obsolete', { tone: 'destructive' }),
];

/** Slug set used by the HR document-template form. */
export const DOCUMENT_TEMPLATE_CATEGORY: EnumValue[] = [
  v('offer_letter', 'Offer letter'),
  v('appointment_letter', 'Appointment letter'),
  v('contract', 'Contract'),
  v('nda', 'NDA'),
  v('relieving_letter', 'Relieving letter'),
  v('experience_letter', 'Experience letter'),
  v('warning_letter', 'Warning letter'),
  v('other', 'Other'),
];

/** Lifecycle status for an HR document template. */
export const DOCUMENT_TEMPLATE_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('active', 'Active', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Lifecycle status for an HR welcome kit (new-hire equipment parcel). */
export const WELCOME_KIT_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('shipped', 'Shipped', { tone: 'info' }),
  v('delivered', 'Delivered', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Lifecycle status for an HR weekly timesheet. */
export const TIMESHEET_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('submitted', 'Submitted', { tone: 'info' }),
  v('approved', 'Approved', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Indian fiscal quarter for TDS / payroll-tax records. */
export const TDS_QUARTER: EnumValue[] = [
  v('Q1', 'Q1 (Apr – Jun)'),
  v('Q2', 'Q2 (Jul – Sep)'),
  v('Q3', 'Q3 (Oct – Dec)'),
  v('Q4', 'Q4 (Jan – Mar)'),
];

/** Lifecycle status for a TDS record. */
export const TDS_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('deposited', 'Deposited', { tone: 'info' }),
  v('filed', 'Filed', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Lifecycle status for a Form 16 record. */
export const FORM_16_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('generated', 'Generated', { tone: 'info' }),
  v('issued', 'Issued', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const NOTICE_PRIORITY: EnumValue[] = [
  v('low', 'Low', { tone: 'neutral' }),
  v('normal', 'Normal', { tone: 'info' }),
  v('high', 'High', { tone: 'warning' }),
  v('urgent', 'Urgent', { tone: 'destructive' }),
];

export const RECOGNITION_TYPE: EnumValue[] = [
  v('kudos', 'Kudos'),
  v('award', 'Award'),
  v('peer_recognition', 'Peer recognition'),
  v('spot_bonus', 'Spot bonus'),
  v('milestone', 'Milestone'),
];

export const SHIFT_TYPE: EnumValue[] = [
  v('morning', 'Morning'),
  v('day', 'Day'),
  v('evening', 'Evening'),
  v('night', 'Night'),
  v('flexible', 'Flexible'),
  v('split', 'Split'),
];

export const LEAVE_DURATION: EnumValue[] = [
  v('full-day', 'Full day'),
  v('half-day', 'Half day'),
  v('multiple', 'Multiple days'),
  v('hours', 'Hours'),
];

export const HALF_DAY_TYPE: EnumValue[] = [
  v('first-half', 'First half'),
  v('second-half', 'Second half'),
];

export const SUCCESSION_READINESS: EnumValue[] = [
  v('ready_now', 'Ready now', { tone: 'success' }),
  v('ready_1_2y', 'Ready in 1-2 years', { tone: 'info' }),
  v('ready_3_5y', 'Ready in 3-5 years', { tone: 'warning' }),
  v('not_identified', 'Not identified', { tone: 'neutral' }),
];

export const CERTIFICATION_STATUS: EnumValue[] = [
  v('valid', 'Valid', { tone: 'success' }),
  v('expiring_soon', 'Expiring soon', { tone: 'warning' }),
  v('expired', 'Expired', { tone: 'destructive' }),
  v('revoked', 'Revoked', { tone: 'destructive' }),
];

export const DOCUMENT_VISIBILITY: EnumValue[] = [
  v('private', 'Private'),
  v('team', 'Team'),
  v('department', 'Department'),
  v('organization', 'Organization'),
  v('public', 'Public'),
];

/**
 * Category for HR document records (matches the `CrmDocumentCategory`
 * Rust enum used by `crm_documents`). Distinct from the more generic
 * `documentVisibility`.
 */
export const DOCUMENT_CATEGORY: EnumValue[] = [
  v('id_proof', 'ID proof'),
  v('address_proof', 'Address proof'),
  v('qualification', 'Qualification'),
  v('experience', 'Experience'),
  v('contract', 'Contract'),
  v('appointment', 'Appointment'),
  v('resignation', 'Resignation'),
  v('other', 'Other'),
];

/**
 * Linked-entity discriminator for an HR document — i.e. what kind of
 * record the document is attached to.
 */
export const DOCUMENT_ENTITY_KIND: EnumValue[] = [
  v('employee', 'Employee'),
  v('candidate', 'Candidate'),
  v('contact', 'Contact'),
  v('account', 'Account'),
  v('vendor', 'Vendor'),
];

/** Lifecycle for an HR document (verification + retention). */
export const DOCUMENT_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('verified', 'Verified', { tone: 'success' }),
  v('expired', 'Expired', { tone: 'destructive' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/**
 * Asset category for the HR asset register. Distinct from
 * `assetCondition` (physical state) and `assetStatus` (lifecycle).
 */
export const ASSET_CATEGORY: EnumValue[] = [
  v('laptop', 'Laptop'),
  v('phone', 'Phone'),
  v('monitor', 'Monitor'),
  v('badge', 'Badge'),
  v('keys', 'Keys'),
  v('vehicle', 'Vehicle'),
  v('other', 'Other'),
];

/** Audience picker for notices (worksuite). */
export const NOTICE_AUDIENCE: EnumValue[] = [
  v('all', 'Everyone'),
  v('department', 'Department'),
  v('employee', 'Specific employees'),
];

/** Knowledge-base article media kind. */
export const KB_ARTICLE_TYPE: EnumValue[] = [
  v('article', 'Article'),
  v('video', 'Video'),
  v('audio', 'Audio'),
  v('image', 'Image'),
  v('document', 'Document'),
];

/**
 * Top-level case kind for HR disciplinary records. Distinct from
 * `disciplinaryType` (which catalogs the action — warning, suspension,
 * termination, etc.). Matches the form's caseType slug set.
 */
export const DISCIPLINARY_CASE_TYPE: EnumValue[] = [
  v('misconduct', 'Misconduct'),
  v('performance', 'Performance'),
  v('attendance', 'Attendance'),
  v('other', 'Other'),
];

/** Severity grading for an HR disciplinary case. */
export const DISCIPLINARY_SEVERITY: EnumValue[] = [
  v('minor', 'Minor', { tone: 'info' }),
  v('major', 'Major', { tone: 'warning' }),
  v('severe', 'Severe', { tone: 'destructive' }),
];

/**
 * Lifecycle status for the disciplinary *case* (form-level), as opposed
 * to `disciplinaryStatus` which tracks the action workflow.
 */
export const DISCIPLINARY_CASE_STATUS: EnumValue[] = [
  v('open', 'Open', { tone: 'info' }),
  v('investigating', 'Investigating', { tone: 'warning' }),
  v('resolved', 'Resolved', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'neutral' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/* ------------------------------------------------------------------ */
/* Priorities                                                          */
/* ------------------------------------------------------------------ */

export const PRIORITY: EnumValue[] = [
  v('low', 'Low', { tone: 'neutral' }),
  v('normal', 'Normal', { tone: 'info' }),
  v('high', 'High', { tone: 'warning' }),
  v('urgent', 'Urgent', { tone: 'destructive' }),
];

/**
 * "Medium" variant of priority — used by projects / tasks / issues / KB
 * where the wire value is `medium` rather than `normal`. Same UX, just a
 * different stable id set.
 */
export const PRIORITY_MEDIUM: EnumValue[] = [
  v('low', 'Low', { tone: 'neutral' }),
  v('medium', 'Medium', { tone: 'info' }),
  v('high', 'High', { tone: 'warning' }),
  v('urgent', 'Urgent', { tone: 'destructive' }),
];

/** Capitalised priority — matches the Rust `CrmTask.priority` literal. */
export const PRIORITY_LEGACY: EnumValue[] = [
  v('Low', 'Low', { tone: 'neutral' }),
  v('Medium', 'Medium', { tone: 'info' }),
  v('High', 'High', { tone: 'warning' }),
];

export const SEVERITY: EnumValue[] = [
  v('minor', 'Minor', { tone: 'neutral' }),
  v('moderate', 'Moderate', { tone: 'info' }),
  v('major', 'Major', { tone: 'warning' }),
  v('critical', 'Critical', { tone: 'destructive' }),
];

/** Sev-numbered severity (Sev1…Sev4) used by the tickets pipeline. */
export const TICKET_SEVERITY: EnumValue[] = [
  v('sev1', 'Sev 1 — critical', { tone: 'destructive' }),
  v('sev2', 'Sev 2 — high', { tone: 'warning' }),
  v('sev3', 'Sev 3 — normal', { tone: 'info' }),
  v('sev4', 'Sev 4 — low', { tone: 'neutral' }),
];

/** Ticket-priority literal set (`low/medium/high/critical`). */
export const TICKET_PRIORITY: EnumValue[] = [
  v('low', 'Low', { tone: 'neutral' }),
  v('medium', 'Medium', { tone: 'info' }),
  v('high', 'High', { tone: 'warning' }),
  v('critical', 'Critical', { tone: 'destructive' }),
];

/** Ticket-priority with `all` sentinel used by SLA policies. */
export const TICKET_PRIORITY_WITH_ALL: EnumValue[] = [
  v('low', 'Low', { tone: 'neutral' }),
  v('medium', 'Medium', { tone: 'info' }),
  v('high', 'High', { tone: 'warning' }),
  v('critical', 'Critical', { tone: 'destructive' }),
  v('all', 'All priorities', { tone: 'neutral' }),
];

/* ------------------------------------------------------------------ */
/* Money / billing enums                                               */
/* ------------------------------------------------------------------ */

export const PAYMENT_METHOD: EnumValue[] = [
  v('cash', 'Cash'),
  v('cheque', 'Cheque'),
  v('bank_transfer', 'Bank transfer'),
  v('upi', 'UPI'),
  v('card', 'Card (debit/credit)'),
  v('netbanking', 'Net banking'),
  v('wallet', 'Wallet'),
  v('emi', 'EMI'),
  v('other', 'Other'),
];

export const PAYMENT_TERMS: EnumValue[] = [
  v('net_0', 'Due on receipt'),
  v('net_7', 'Net 7'),
  v('net_15', 'Net 15'),
  v('net_30', 'Net 30'),
  v('net_45', 'Net 45'),
  v('net_60', 'Net 60'),
  v('net_90', 'Net 90'),
  v('cod', 'Cash on delivery'),
  v('advance', '100% advance'),
];

export const DISCOUNT_TYPE: EnumValue[] = [
  v('percentage', 'Percentage (%)'),
  v('flat', 'Flat amount'),
];

export const TAX_TYPE: EnumValue[] = [
  v('inclusive', 'Inclusive'),
  v('exclusive', 'Exclusive'),
];

export const GST_TREATMENT: EnumValue[] = [
  v('registered_regular', 'Registered (Regular)'),
  v('registered_composition', 'Registered (Composition)'),
  v('unregistered', 'Unregistered'),
  v('consumer', 'Consumer'),
  v('overseas', 'Overseas'),
  v('sez_with_payment', 'SEZ (with payment)'),
  v('sez_without_payment', 'SEZ (without payment)'),
  v('deemed_export', 'Deemed export'),
];

export const RECURRING_FREQUENCY: EnumValue[] = [
  v('daily', 'Daily'),
  v('weekly', 'Weekly'),
  v('biweekly', 'Bi-weekly'),
  v('monthly', 'Monthly'),
  v('quarterly', 'Quarterly'),
  v('half_yearly', 'Half-yearly'),
  v('yearly', 'Yearly'),
];

export const CUSTOMER_TYPE: EnumValue[] = [
  v('b2b', 'Business (B2B)'),
  v('b2c', 'Consumer (B2C)'),
  v('government', 'Government'),
  v('non_profit', 'Non-profit'),
];

/* ------------------------------------------------------------------ */
/* Channels / sources                                                  */
/* ------------------------------------------------------------------ */

export const TICKET_CHANNEL: EnumValue[] = [
  v('email', 'Email'),
  v('phone', 'Phone'),
  v('chat', 'Chat'),
  v('whatsapp', 'WhatsApp'),
  v('web', 'Web'),
  v('web_form', 'Web form'),
  v('portal', 'Customer portal'),
  v('api', 'API / webhook'),
  v('walk_in', 'Walk-in'),
];

export const COMMUNICATION_CHANNEL: EnumValue[] = [
  v('email', 'Email'),
  v('phone_call', 'Phone call'),
  v('sms', 'SMS'),
  v('whatsapp', 'WhatsApp'),
  v('meeting', 'Meeting'),
  v('video_call', 'Video call'),
  v('chat', 'Chat'),
  v('postal', 'Postal mail'),
];

/* ------------------------------------------------------------------ */
/* Asset enums                                                         */
/* ------------------------------------------------------------------ */

export const ASSET_CONDITION: EnumValue[] = [
  v('new', 'New', { tone: 'success' }),
  v('good', 'Good', { tone: 'success' }),
  v('fair', 'Fair', { tone: 'info' }),
  v('poor', 'Poor', { tone: 'warning' }),
  v('damaged', 'Damaged', { tone: 'destructive' }),
  v('retired', 'Retired', { tone: 'neutral' }),
];

export const ASSET_STATUS: EnumValue[] = [
  v('available', 'Available', { tone: 'success' }),
  v('assigned', 'Assigned', { tone: 'info' }),
  v('in_repair', 'In repair', { tone: 'warning' }),
  v('lost', 'Lost', { tone: 'destructive' }),
  v('retired', 'Retired', { tone: 'neutral' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export const YES_NO: EnumValue[] = [
  v('yes', 'Yes', { tone: 'success' }),
  v('no', 'No', { tone: 'destructive' }),
];

export const WEEKDAY: EnumValue[] = [
  v('monday', 'Monday'),
  v('tuesday', 'Tuesday'),
  v('wednesday', 'Wednesday'),
  v('thursday', 'Thursday'),
  v('friday', 'Friday'),
  v('saturday', 'Saturday'),
  v('sunday', 'Sunday'),
];

export const MONTH: EnumValue[] = [
  v('jan', 'January'),
  v('feb', 'February'),
  v('mar', 'March'),
  v('apr', 'April'),
  v('may', 'May'),
  v('jun', 'June'),
  v('jul', 'July'),
  v('aug', 'August'),
  v('sep', 'September'),
  v('oct', 'October'),
  v('nov', 'November'),
  v('dec', 'December'),
];

export const COUNTRY_REGION: EnumValue[] = [
  v('north', 'North'),
  v('south', 'South'),
  v('east', 'East'),
  v('west', 'West'),
  v('central', 'Central'),
  v('north_east', 'North-East'),
];

export const CHANNEL_DIRECTION: EnumValue[] = [
  v('inbound', 'Inbound'),
  v('outbound', 'Outbound'),
];

export const RATING_5: EnumValue[] = [
  v('1', '⭐'),
  v('2', '⭐⭐'),
  v('3', '⭐⭐⭐'),
  v('4', '⭐⭐⭐⭐'),
  v('5', '⭐⭐⭐⭐⭐'),
];

/* ------------------------------------------------------------------ */
/* Polymorphic-kind discriminators                                     */
/*                                                                     */
/* These pickers select *which* lookup entity another field should     */
/* resolve against. Catalogued here so the inline-create picker UX is  */
/* available everywhere a "type" toggle was previously a raw select.   */
/* ------------------------------------------------------------------ */

/** Ticket requester is one of `client`, `lead`, or `employee`. */
export const REQUESTER_KIND: EnumValue[] = [
  v('client', 'Client'),
  v('lead', 'Lead'),
  v('employee', 'Employee'),
];

/** Deal counter-party kind — either a `client` (won account) or a `lead`. */
export const PARTY_KIND: EnumValue[] = [
  v('client', 'Client (account)'),
  v('lead', 'Lead'),
];

/** Generic linked-entity discriminator used by tasks / activities. */
export const LINKED_ENTITY_KIND: EnumValue[] = [
  v('none', 'No link'),
  v('lead', 'Lead'),
  v('deal', 'Deal'),
  v('contact', 'Contact'),
  v('client', 'Client'),
  v('ticket', 'Ticket'),
  v('invoice', 'Invoice'),
  v('project', 'Project'),
];

/** Subtask parent-kind discriminator (project / task / milestone / issue). */
export const SUBTASK_PARENT_KIND: EnumValue[] = [
  v('project', 'Project'),
  v('task', 'Task'),
  v('milestone', 'Milestone'),
  v('issue', 'Issue'),
];

/** Account-management category. */
export const ACCOUNT_CATEGORY: EnumValue[] = [
  v('new', 'New', { tone: 'info' }),
  v('strategic', 'Strategic', { tone: 'success' }),
  v('key', 'Key', { tone: 'success' }),
  v('regular', 'Regular', { tone: 'neutral' }),
];

/** Legacy "Net N"-style payment terms used by `crm_accounts`. */
export const PAYMENT_TERMS_LEGACY: EnumValue[] = [
  v('Immediate', 'Immediate'),
  v('Net 15', 'Net 15'),
  v('Net 30', 'Net 30'),
  v('Net 45', 'Net 45'),
  v('Net 60', 'Net 60'),
];

/* ------------------------------------------------------------------ */
/* Accounting / Banking enums (Phase §1E sweep)                        */
/* ------------------------------------------------------------------ */

export const VOUCHER_TYPE: EnumValue[] = [
  v('Sales', 'Sales'),
  v('Purchase', 'Purchase'),
  v('Payment', 'Payment'),
  v('Receipt', 'Receipt'),
  v('Contra', 'Contra'),
  v('Journal', 'Journal'),
  v('Reversing Journal', 'Reversing Journal'),
  v('Credit Note', 'Credit Note'),
  v('Debit Note', 'Debit Note'),
  v('Reimbursement', 'Reimbursement'),
];

export const VOUCHER_RESET_FREQUENCY: EnumValue[] = [
  v('none', 'Never reset'),
  v('yearly', 'Reset yearly (FY)'),
  v('monthly', 'Reset monthly'),
];

export const ACCOUNT_NATURE: EnumValue[] = [
  v('Asset', 'Asset', { tone: 'success' }),
  v('Liability', 'Liability', { tone: 'destructive' }),
  v('Income', 'Income', { tone: 'info' }),
  v('Expense', 'Expense', { tone: 'warning' }),
  v('Capital', 'Capital', { tone: 'neutral' }),
];

export const ACCOUNT_BALANCE_TYPE: EnumValue[] = [
  v('Dr', 'Debit'),
  v('Cr', 'Credit'),
];

export const ACCOUNT_TAX_BEHAVIOR: EnumValue[] = [
  v('none', 'None'),
  v('output', 'Output (sales)'),
  v('input', 'Input (purchase)'),
  v('reverse_charge', 'Reverse charge'),
];

export const ACCOUNT_ACTIVE_STATUS: EnumValue[] = [
  v('Active', 'Active', { tone: 'success' }),
  v('Inactive', 'Inactive', { tone: 'neutral' }),
];

export const PAYMENT_ACCOUNT_TYPE: EnumValue[] = [
  v('bank', 'Bank'),
  v('cash', 'Cash'),
  v('employee', 'Employee'),
  v('wallet', 'Wallet'),
  v('other', 'Other'),
];

export const BANK_ACCOUNT_SUBTYPE: EnumValue[] = [
  v('current', 'Current'),
  v('savings', 'Savings'),
];

export const PAYMENT_ACCOUNT_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('inactive', 'Inactive', { tone: 'neutral' }),
];

export const BANK_TRANSACTION_DIRECTION: EnumValue[] = [
  v('credit', 'Credit (money in)', { tone: 'success' }),
  v('debit', 'Debit (money out)', { tone: 'destructive' }),
];

export const BANK_TRANSACTION_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('cleared', 'Cleared', { tone: 'info' }),
  v('reconciled', 'Reconciled', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const RECONCILIATION_STATUS: EnumValue[] = [
  v('in_progress', 'In progress', { tone: 'info' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/* ------------------------------------------------------------------ */
/* Settings / Integrations / Preferences enums (Phase §1E sweep)       */
/* ------------------------------------------------------------------ */

export const FISCAL_YEAR_START: EnumValue[] = [
  v('jan', 'January'),
  v('feb', 'February'),
  v('mar', 'March'),
  v('apr', 'April'),
  v('may', 'May'),
  v('jun', 'June'),
  v('jul', 'July'),
  v('aug', 'August'),
  v('sep', 'September'),
  v('oct', 'October'),
  v('nov', 'November'),
  v('dec', 'December'),
];

export const RTL_FLAG: EnumValue[] = [
  v('no', 'Left-to-right (LTR)'),
  v('yes', 'Right-to-left (RTL)'),
];

export const DATEPICKER_FORMAT: EnumValue[] = [
  v('dd-mm-yyyy', 'DD-MM-YYYY'),
  v('mm-dd-yyyy', 'MM-DD-YYYY'),
  v('yyyy-mm-dd', 'YYYY-MM-DD'),
  v('dd/mm/yyyy', 'DD/MM/YYYY'),
  v('mm/dd/yyyy', 'MM/DD/YYYY'),
];

export const MOMENT_FORMAT: EnumValue[] = [
  v('DD-MM-YYYY', 'DD-MM-YYYY'),
  v('MM-DD-YYYY', 'MM-DD-YYYY'),
  v('YYYY-MM-DD', 'YYYY-MM-DD'),
  v('DD/MM/YYYY', 'DD/MM/YYYY'),
  v('MM/DD/YYYY', 'MM/DD/YYYY'),
];

export const TIME_FORMAT: EnumValue[] = [
  v('12', '12-hour'),
  v('24', '24-hour'),
];

export const WEEK_START: EnumValue[] = [
  v('sunday', 'Sunday'),
  v('monday', 'Monday'),
  v('saturday', 'Saturday'),
];

export const NUMBER_FORMAT: EnumValue[] = [
  v('1,234.56', '1,234.56 (US/UK)'),
  v('1.234,56', '1.234,56 (EU)'),
  v('1 234,56', '1 234,56 (FR)'),
  v('1,23,456.78', '1,23,456.78 (Indian)'),
];

export const APP_LOCALE: EnumValue[] = [
  v('en', 'English'),
  v('hi', 'Hindi'),
  v('es', 'Spanish'),
  v('fr', 'French'),
  v('de', 'German'),
  v('pt', 'Portuguese'),
  v('ar', 'Arabic'),
];

export const INTEGRATION_KIND: EnumValue[] = [
  v('email', 'Email / SMTP'),
  v('storage', 'Storage'),
  v('analytics', 'Analytics'),
  v('messaging', 'Messaging / Chat'),
  v('crm', 'CRM'),
  v('accounting', 'Accounting'),
  v('payments', 'Payments'),
  v('telephony', 'Telephony / SMS'),
  v('marketing', 'Marketing / Ads'),
  v('calendar', 'Calendar'),
  v('webhook', 'Webhook'),
  v('other', 'Other'),
];

export const STORAGE_PROVIDER: EnumValue[] = [
  v('local', 'Local disk'),
  v('s3', 'Amazon S3'),
  v('r2', 'Cloudflare R2'),
  v('gcs', 'Google Cloud Storage'),
  v('azure', 'Azure Blob Storage'),
  v('digitalocean', 'DigitalOcean Spaces'),
  v('backblaze', 'Backblaze B2'),
  v('wasabi', 'Wasabi'),
];

export const PAYMENT_GATEWAY_TYPE: EnumValue[] = [
  v('stripe', 'Stripe'),
  v('paypal', 'PayPal'),
  v('razorpay', 'Razorpay'),
  v('paystack', 'Paystack'),
  v('payfast', 'PayFast'),
  v('mollie', 'Mollie'),
  v('square', 'Square'),
  v('flutterwave', 'Flutterwave'),
  v('phonepe', 'PhonePe'),
  v('cashfree', 'Cashfree'),
  v('manual', 'Manual / offline'),
  v('other', 'Other'),
];

export const SMTP_ENCRYPTION: EnumValue[] = [
  v('none', 'None'),
  v('tls', 'TLS'),
  v('ssl', 'SSL'),
  v('starttls', 'STARTTLS'),
];

export const WEBHOOK_METHOD: EnumValue[] = [
  v('GET', 'GET'),
  v('POST', 'POST'),
  v('PUT', 'PUT'),
  v('PATCH', 'PATCH'),
  v('DELETE', 'DELETE'),
];

export const WEBHOOK_CONTENT_TYPE: EnumValue[] = [
  v('application/json', 'application/json'),
  v('application/x-www-form-urlencoded', 'application/x-www-form-urlencoded'),
  v('text/plain', 'text/plain'),
  v('multipart/form-data', 'multipart/form-data'),
];

export const HTTP_METHOD: EnumValue[] = [
  v('GET', 'GET'),
  v('POST', 'POST'),
  v('PUT', 'PUT'),
  v('PATCH', 'PATCH'),
  v('DELETE', 'DELETE'),
];

export const DEFAULT_TASK_VIEW: EnumValue[] = [
  v('board', 'Kanban board'),
  v('list', 'List'),
  v('calendar', 'Calendar'),
  v('gantt', 'Gantt'),
];

export const DEFAULT_LEAD_VIEW: EnumValue[] = [
  v('board', 'Kanban board'),
  v('list', 'List'),
  v('table', 'Table'),
];

export const TIMEZONE_PRESET: EnumValue[] = [
  v('Asia/Kolkata', 'Asia/Kolkata (IST)'),
  v('UTC', 'UTC'),
  v('America/New_York', 'America/New_York (ET)'),
  v('America/Los_Angeles', 'America/Los_Angeles (PT)'),
  v('Europe/London', 'Europe/London (GMT/BST)'),
  v('Europe/Berlin', 'Europe/Berlin (CET)'),
  v('Asia/Singapore', 'Asia/Singapore'),
  v('Asia/Dubai', 'Asia/Dubai'),
  v('Asia/Tokyo', 'Asia/Tokyo'),
  v('Australia/Sydney', 'Australia/Sydney'),
];

export const TOKEN_SCOPE: EnumValue[] = [
  v('read', 'Read-only'),
  v('write', 'Read + write'),
  v('admin', 'Admin'),
];

export const CUSTOM_FIELD_TYPE: EnumValue[] = [
  v('text', 'Text (single-line)'),
  v('textarea', 'Long text'),
  v('number', 'Number'),
  v('decimal', 'Decimal'),
  v('currency', 'Currency'),
  v('boolean', 'Yes / No'),
  v('date', 'Date'),
  v('datetime', 'Date + time'),
  v('select', 'Select (single)'),
  v('multiselect', 'Select (multiple)'),
  v('email', 'Email'),
  v('phone', 'Phone'),
  v('url', 'URL'),
  v('file', 'File / attachment'),
  v('entity_ref', 'Entity reference'),
];

export const EMAIL_TEMPLATE_KIND: EnumValue[] = [
  v('transactional', 'Transactional'),
  v('marketing', 'Marketing'),
  v('notification', 'Notification'),
  v('digest', 'Digest'),
  v('reminder', 'Reminder'),
];

export const EMAIL_TEMPLATE_CATEGORY: EnumValue[] = [
  v('general', 'General'),
  v('transactional', 'Transactional'),
  v('marketing', 'Marketing'),
  v('onboarding', 'Onboarding'),
  v('support', 'Support'),
  v('sales', 'Sales'),
  v('other', 'Other'),
];

export const EMAIL_TEMPLATE_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const PROJECT_DEFAULT_PRIVACY: EnumValue[] = [
  v('private', 'Private'),
  v('team', 'Team-only'),
  v('organization', 'Organization-wide'),
];

export const STORAGE_DEFAULT_VISIBILITY: EnumValue[] = [
  v('private', 'Private'),
  v('public', 'Public'),
  v('signed', 'Signed link (time-limited)'),
];

export const PUSH_PROVIDER: EnumValue[] = [
  v('webpush', 'Web Push (VAPID)'),
  v('onesignal', 'OneSignal'),
  v('firebase', 'Firebase Cloud Messaging'),
  v('apns', 'Apple Push (APNs)'),
];

export const SOCIAL_AUTH_PROVIDER: EnumValue[] = [
  v('google', 'Google'),
  v('github', 'GitHub'),
  v('facebook', 'Facebook'),
  v('linkedin', 'LinkedIn'),
  v('apple', 'Apple'),
  v('microsoft', 'Microsoft'),
  v('twitter', 'X / Twitter'),
];

export const EXPENSE_CATEGORY_KIND: EnumValue[] = [
  v('operational', 'Operational'),
  v('capital', 'Capital'),
  v('travel', 'Travel'),
  v('utilities', 'Utilities'),
  v('payroll', 'Payroll'),
  v('marketing', 'Marketing'),
  v('software', 'Software / SaaS'),
  v('other', 'Other'),
];

export const GDPR_REQUEST_KIND: EnumValue[] = [
  v('access', 'Data access / export'),
  v('correction', 'Correction'),
  v('removal', 'Removal / right to be forgotten'),
  v('restriction', 'Restriction of processing'),
  v('portability', 'Portability'),
];

export const ATTENDANCE_MODE: EnumValue[] = [
  v('manual', 'Manual entry'),
  v('biometric', 'Biometric'),
  v('rfid', 'RFID badge'),
  v('geofence', 'Geofence (GPS)'),
  v('ip', 'IP restriction'),
  v('mobile', 'Mobile app'),
];

export const TAX_CALCULATION_BASIS: EnumValue[] = [
  v('before-discount', 'Before discount'),
  v('after-discount', 'After discount'),
];

export const PROMOTION_DISCOUNT_KIND: EnumValue[] = [
  v('percentage', 'Percentage (%)'),
  v('flat', 'Flat amount'),
];

export const FACEBOOK_AD_ACCOUNT_KIND: EnumValue[] = [
  v('business', 'Business'),
  v('personal', 'Personal'),
];

export const QUICKBOOKS_ENVIRONMENT: EnumValue[] = [
  v('sandbox', 'Sandbox'),
  v('production', 'Production'),
];

export const GATEWAY_MODE: EnumValue[] = [
  v('test', 'Test'),
  v('live', 'Live'),
];

export const PROMOTION_AUDIENCE: EnumValue[] = [
  v('all', 'All customers'),
  v('new', 'New customers'),
  v('returning', 'Returning customers'),
  v('vip', 'VIP / loyalty members'),
  v('segment', 'Segment'),
];

export const EMAIL_FROM_BEHAVIOR: EnumValue[] = [
  v('system', 'System default'),
  v('user', 'Logged-in user'),
  v('mailbox', 'Specific mailbox'),
];

export const TOKEN_PERMISSION: EnumValue[] = [
  v('read', 'Read'),
  v('write', 'Read + write'),
  v('admin', 'Full admin'),
];

export const TOKEN_EXPIRY: EnumValue[] = [
  v('30', '30 days'),
  v('90', '90 days'),
  v('180', '180 days'),
  v('365', '1 year'),
  v('never', 'Never (not recommended)'),
];

export const STORAGE_DRIVER: EnumValue[] = [
  v('local', 'Local disk'),
  v('s3', 'Amazon S3'),
  v('digitalocean', 'DigitalOcean Spaces'),
  v('wasabi', 'Wasabi'),
  v('backblaze', 'Backblaze B2'),
  v('gcs', 'Google Cloud Storage'),
  v('azure', 'Azure Blob Storage'),
  v('r2', 'Cloudflare R2'),
];

export const DASHBOARD_WIDGET_SIZE: EnumValue[] = [
  v('small', 'Small'),
  v('medium', 'Medium'),
  v('large', 'Large'),
  v('full', 'Full width'),
];

export const REMOVAL_REQUEST_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('approved', 'Approved', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('completed', 'Completed', { tone: 'success' }),
];

export const CUSTOM_FIELD_ENTITY: EnumValue[] = [
  v('contact', 'Contacts'),
  v('deal', 'Deals'),
  v('lead', 'Leads'),
  v('account', 'Accounts'),
  v('ticket', 'Tickets'),
  v('employee', 'Employees'),
  v('vendor', 'Vendors'),
  v('item', 'Items'),
  v('project', 'Projects'),
];

export const ERASE_SUBJECT_KIND: EnumValue[] = [
  v('contact', 'Contact'),
  v('lead', 'Lead'),
  v('employee', 'Employee'),
];

export const ERASE_SCOPE: EnumValue[] = [
  v('soft_redact', 'Soft redact'),
  v('hard_delete', 'Hard delete'),
];

export const DASHBOARD_WIDGET_TYPE: EnumValue[] = [
  v('stats', 'Stats / KPI'),
  v('chart', 'Chart'),
  v('list', 'List'),
  v('calendar', 'Calendar'),
  v('custom', 'Custom HTML'),
];

/* Calendar / reminder periods used by events + recurrence forms. */
export const CALENDAR_PERIOD: EnumValue[] = [
  v('day', 'Day'),
  v('week', 'Week'),
  v('month', 'Month'),
  v('year', 'Year'),
];

export const REMINDER_UNIT: EnumValue[] = [
  v('hour', 'Hour'),
  v('day', 'Day'),
];

export const CURRENCY_POSITION: EnumValue[] = [
  v('front', 'Symbol before amount (e.g. $1,000)'),
  v('back', 'Symbol after amount (e.g. 1,000 $)'),
];

/* Payroll-settings finite enums (1E.sweep) — pay-cycle picker + statutory
 * regime + payslip template. Separate from RECURRING_FREQUENCY because
 * the payroll DTO only accepts these three cadences. */
export const PAY_FREQUENCY: EnumValue[] = [
  v('weekly', 'Weekly'),
  v('biweekly', 'Bi-weekly'),
  v('monthly', 'Monthly'),
];

/** ISO-4217 currency codes supported by payroll (1E.sweep). */
export const PAYROLL_CURRENCY: EnumValue[] = [
  v('INR', 'INR — Indian Rupee'),
  v('USD', 'USD — US Dollar'),
  v('EUR', 'EUR — Euro'),
  v('GBP', 'GBP — British Pound'),
];

/** Indian income-tax regime (1E.sweep). */
export const TAX_REGIME: EnumValue[] = [
  v('new', 'New Regime (Section 115BAC)'),
  v('old', 'Old Regime'),
];

/** Payslip layout template (1E.sweep). */
export const PAYSLIP_TEMPLATE: EnumValue[] = [
  v('standard', 'Standard'),
  v('detailed', 'Detailed'),
  v('compact', 'Compact'),
];

/* ------------------------------------------------------------------ */
/* Sales-CRM / time-tracking finite enums (§1E sweep)                 */
/* ------------------------------------------------------------------ */

/**
 * Automation trigger events — used by the new-automation form’s Trigger
 * Event picker. Covers all built-in CRM trigger types.
 */
export const AUTOMATION_TRIGGER: EnumValue[] = [
  v('lead_created', 'Lead Created'),
  v('deal_stage_changed', 'Deal Stage Changed'),
  v('contact_created', 'Contact Created'),
  v('task_overdue', 'Task Overdue'),
  v('invoice_overdue', 'Invoice Overdue'),
  v('form_submitted', 'Form Submitted'),
  v('manual', 'Manual Trigger'),
];

/**
 * Billable filter for time-log list. The 'all' sentinel is handled by
 * `<EnumFilterField>`. The `non-billable` slug matches the filter predicate
 * already in use in the time-logs page.
 */
export const TIME_BILLABLE_FILTER: EnumValue[] = [
  v('billable', 'Billable', { tone: 'success' }),
  v('non-billable', 'Non-billable', { tone: 'neutral' }),
];

/* ------------------------------------------------------------------ */
/* Inventory finite enums (P1.1B Wave 4)                              */
/* ------------------------------------------------------------------ */

/**
 * Reasons surfaced on the stock-adjustment new/edit form's Reason picker.
 * Stored verbatim on `CrmStockAdjustment.reason`; the legacy form already
 * defaulted to `correction`, so we keep that as the canonical ID.
 */
export const STOCK_ADJUSTMENT_REASON: EnumValue[] = [
  v('correction', 'Count correction', { tone: 'neutral' }),
  v('damage', 'Damage', { tone: 'destructive' }),
  v('expiry', 'Expiry', { tone: 'warning' }),
  v('theft', 'Theft', { tone: 'destructive' }),
  v('scrap', 'Scrap', { tone: 'warning' }),
  v('transfer', 'Transfer', { tone: 'info' }),
];

/**
 * Lifecycle of a production order — used by the detail header status pill
 * and the new/edit form's Status picker. Aligns with the union accepted
 * by `setProductionOrderStatus`.
 */
export const PRODUCTION_ORDER_STATUS: EnumValue[] = [
  v('planned', 'Planned', { tone: 'neutral' }),
  v('released', 'Released', { tone: 'info' }),
  v('in_progress', 'In progress', { tone: 'info' }),
  v('paused', 'Paused', { tone: 'warning' }),
  v('qa_check', 'QA check', { tone: 'warning' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

/**
 * GRN workflow status — mirrors the Rust DTO + the legacy Mongo column
 * (`draft | inspected | posted | rejected`). The §1D brief asked for a
 * superset that includes `received | partial | qc_failed | closed`; we
 * union both spellings so existing data + new workflows both render.
 */
export const GRN_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('received', 'Received', { tone: 'info' }),
  v('partial', 'Partial', { tone: 'warning' }),
  v('inspected', 'Inspected', { tone: 'info' }),
  v('qc_failed', 'QC failed', { tone: 'destructive' }),
  v('posted', 'Posted', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
];

/** BOM lifecycle status — drives the detail status pill + activate flow. */
export const BOM_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('active', 'Active', { tone: 'success' }),
  v('inactive', 'Inactive', { tone: 'neutral' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/**
 * Synthetic stock-status enum used on the items list KPI strip + table
 * tone pill (no equivalent column on `CrmProduct`; the derivation lives
 * in `items/_components/types.ts → isLowStock / isOutOfStock`).
 */
export const ITEM_STOCK_STATUS: EnumValue[] = [
  v('in_stock', 'In stock', { tone: 'success' }),
  v('low', 'Low stock', { tone: 'warning' }),
  v('out_of_stock', 'Out of stock', { tone: 'destructive' }),
];

/** Warehouse classification — Main / Branch / Franchise / 3PL / Virtual. */
export const WAREHOUSE_TYPE: EnumValue[] = [
  v('main', 'Main'),
  v('branch', 'Branch'),
  v('franchise', 'Franchise'),
  v('3pl', '3PL'),
  v('virtual', 'Virtual'),
];

/** Warehouse availability status. */
export const WAREHOUSE_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('inactive', 'Inactive', { tone: 'neutral' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/**
 * Stock-transfer lifecycle — IDs match the existing TS union
 * `CrmStockTransferStatus` ('Draft' | 'InTransit' | 'Received' |
 * 'Cancelled' | 'archived'), so the picker round-trips without a writer
 * change.
 */
export const STOCK_TRANSFER_STATUS: EnumValue[] = [
  v('Draft', 'Draft', { tone: 'neutral' }),
  v('InTransit', 'In transit', { tone: 'info' }),
  v('Received', 'Received', { tone: 'success' }),
  v('Cancelled', 'Cancelled', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Item-batch (batch/expiry) status. */
export const ITEM_BATCH_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('expired', 'Expired', { tone: 'destructive' }),
  v('recalled', 'Recalled', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Per-item tax preference (taxable / non-taxable / out-of-scope). */
export const ITEM_TAX_PREFERENCE: EnumValue[] = [
  v('taxable', 'Taxable'),
  v('non_taxable', 'Non-taxable'),
  v('out_of_scope', 'Out of scope'),
];

/* ------------------------------------------------------------------ */
/* §1E Sales-module enums (gift-card, coupon, promotion, loyalty,     */
/* estimate, proposal, contract-template, delivery-challan,           */
/* recurring-invoice, subscription frequency/renewal)                 */
/* ------------------------------------------------------------------ */

/** Gift-card lifecycle status. */
export const GIFT_CARD_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('paused', 'Paused', { tone: 'warning' }),
  v('redeemed', 'Redeemed', { tone: 'neutral' }),
  v('expired', 'Expired', { tone: 'destructive' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
];

/** Coupon type discriminator. */
export const COUPON_TYPE: EnumValue[] = [
  v('percent', 'Percentage discount'),
  v('flat', 'Flat amount off'),
  v('bogo', 'Buy one get one (BOGO)'),
  v('free_shipping', 'Free shipping'),
];

/** Promotion type discriminator. */
export const PROMOTION_TYPE: EnumValue[] = [
  v('flat', 'Flat amount off'),
  v('percent', 'Percentage discount'),
  v('buy_x_get_y', 'Buy X · Get Y'),
  v('free_shipping', 'Free shipping'),
];

/** Promotion lifecycle status. */
export const PROMOTION_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('scheduled', 'Scheduled', { tone: 'info' }),
  v('active', 'Active', { tone: 'success' }),
  v('paused', 'Paused', { tone: 'warning' }),
  v('expired', 'Expired', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Loyalty program lifecycle status. */
export const LOYALTY_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('paused', 'Paused', { tone: 'warning' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Estimate-template status. */
export const ESTIMATE_TEMPLATE_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('published', 'Published', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Estimate-template category. */
export const ESTIMATE_TEMPLATE_CATEGORY: EnumValue[] = [
  v('general', 'General'),
  v('services', 'Services'),
  v('products', 'Products'),
  v('consulting', 'Consulting'),
  v('maintenance', 'Maintenance'),
  v('other', 'Other'),
];

/** Estimate-request source channel. */
export const ESTIMATE_REQUEST_SOURCE: EnumValue[] = [
  v('web', 'Website'),
  v('email', 'Email'),
  v('phone', 'Phone'),
  v('referral', 'Referral'),
  v('other', 'Other'),
];

/** Estimate-request lifecycle status. */
export const ESTIMATE_REQUEST_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('in_review', 'In review', { tone: 'info' }),
  v('quoted', 'Quoted', { tone: 'success' }),
  v('declined', 'Declined', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Proposal lifecycle status. */
export const PROPOSAL_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('sent', 'Sent', { tone: 'info' }),
  v('accepted', 'Accepted', { tone: 'success' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
  v('expired', 'Expired', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Contract-template type discriminator. */
export const CONTRACT_TEMPLATE_TYPE: EnumValue[] = [
  v('service', 'Service'),
  v('sales', 'Sales'),
  v('nda', 'NDA'),
  v('msa', 'MSA'),
  v('sow', 'SOW'),
  v('employment', 'Employment'),
  v('other', 'Other'),
];

/** Contract-template lifecycle status. */
export const CONTRACT_TEMPLATE_STATUS: EnumValue[] = [
  v('draft', 'Draft', { tone: 'neutral' }),
  v('active', 'Active', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/** Contract-type (settings) lifecycle status. */
export const CONTRACT_TYPE_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

/**
 * Extended contract type (used in the new-contract + edit-contract forms).
 * Includes the short-code values stored in the Mongo `type` field.
 */
export const CONTRACT_TYPE_EXTENDED: EnumValue[] = [
  v('nda', 'NDA'),
  v('msa', 'MSA'),
  v('sow', 'SOW'),
  v('amc', 'AMC'),
  v('employment', 'Employment'),
  v('vendor', 'Vendor'),
  v('service', 'Service'),
  v('lease', 'Lease'),
  v('other', 'Other'),
];

/** E-sign provider picker (extended — includes None). */
export const ESIGN_PROVIDER_EXTENDED: EnumValue[] = [
  v('none', 'None'),
  v('internal', 'Internal'),
  v('digio', 'Digio'),
  v('docusign', 'DocuSign'),
  v('aadhaar', 'Aadhaar e-Sign'),
];

/** Delivery-challan lifecycle status (Title-cased — stored as-is in Mongo). */
export const DELIVERY_CHALLAN_STATUS: EnumValue[] = [
  v('Draft', 'Draft', { tone: 'neutral' }),
  v('In Transit', 'In transit', { tone: 'info' }),
  v('Delivered', 'Delivered', { tone: 'success' }),
  v('Returned', 'Returned', { tone: 'destructive' }),
];

/**
 * Recurring-invoice frequency — full billing-cadence picker
 * (days / weeks / months / years).
 */
export const RECURRING_INVOICE_FREQUENCY: EnumValue[] = [
  v('days', 'Days'),
  v('weeks', 'Weeks'),
  v('months', 'Months'),
  v('years', 'Years'),
];

/** Recurring-invoice lifecycle status. */
export const RECURRING_INVOICE_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('paused', 'Paused', { tone: 'warning' }),
  v('stopped', 'Stopped', { tone: 'destructive' }),
];

/** Subscription billing cycle (mirrors `CrmSubBillingFrequency`). */
export const SUB_BILLING_FREQUENCY: EnumValue[] = [
  v('daily', 'Daily'),
  v('weekly', 'Weekly'),
  v('monthly', 'Monthly'),
  v('quarterly', 'Quarterly'),
  v('yearly', 'Yearly'),
  v('custom', 'Custom'),
];

/** Subscription renewal mode (mirrors `CrmSubRenewalMode`). */
export const SUB_RENEWAL_MODE: EnumValue[] = [
  v('auto', 'Auto-renew'),
  v('manual', 'Manual renewal'),
];


/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ─── §1E sweep — banking + inventory + loans + bookings + portal ──── */

export const LOAN_DIRECTION: EnumValue[] = [
  v('taken', 'Taken (received)'),
  v('given', 'Given (issued)'),
];

export const LOAN_STATUS: EnumValue[] = [
  v('active', 'Active', { tone: 'success' }),
  v('closed', 'Closed', { tone: 'neutral' }),
  v('defaulted', 'Defaulted', { tone: 'destructive' }),
  v('archived', 'Archived', { tone: 'neutral' }),
];

export const LOAN_TYPE: EnumValue[] = [
  v('employee_advance', 'Employee Advance'),
  v('customer_loan', 'Customer Loan'),
  v('vendor_advance', 'Vendor Advance'),
];

export const BORROWER_TYPE: EnumValue[] = [
  v('employee', 'Employee'),
  v('customer', 'Customer'),
  v('vendor', 'Vendor'),
];

export const BANK_FILE_FORMAT: EnumValue[] = [
  v('neft', 'NEFT'),
  v('imps', 'IMPS'),
  v('rtgs', 'RTGS'),
  v('upi_bulk', 'UPI Bulk'),
];

export const BANK_TRANSACTION_TYPE_EXT: EnumValue[] = [
  v('deposit', 'Deposit'),
  v('withdrawal', 'Withdrawal'),
  v('transfer', 'Transfer'),
  v('adjustment', 'Adjustment'),
];

export const ITEM_TYPE: EnumValue[] = [
  v('goods', 'Goods'),
  v('service', 'Service'),
  v('bundle', 'Bundle'),
  v('digital', 'Digital'),
];

export const INVENTORY_TRANSACTION_TYPE: EnumValue[] = [
  v('sale', 'Sale'),
  v('sale_return', 'Sales Return'),
  v('purchase', 'Purchase'),
  v('purchase_return', 'Purchase Return'),
  v('stock_adjustment', 'Stock Adjustment'),
  v('transfer', 'Transfer'),
];

export const INVENTORY_TRACKING_FILTER: EnumValue[] = [
  v('tracked', 'Tracked'),
  v('untracked', 'Untracked'),
];

export const GRN_QC_STATUS: EnumValue[] = [
  v('pending', 'Pending QC', { tone: 'warning' }),
  v('accepted', 'Accepted', { tone: 'success' }),
  v('partial', 'Partially Accepted', { tone: 'warning' }),
  v('rejected', 'Rejected', { tone: 'destructive' }),
];

export const ATTENDANCE_FORM_STATUS: EnumValue[] = [
  v('present', 'Present', { tone: 'success' }),
  v('absent', 'Absent', { tone: 'destructive' }),
  v('half_day', 'Half Day', { tone: 'warning' }),
  v('leave', 'On Leave', { tone: 'info' }),
  v('holiday', 'Holiday', { tone: 'neutral' }),
  v('wfh', 'Work From Home', { tone: 'info' }),
  v('week_off', 'Week Off', { tone: 'neutral' }),
];

export const ATTENDANCE_SOURCE: EnumValue[] = [
  v('manual', 'Manual'),
  v('biometric', 'Biometric'),
  v('web', 'Web Clock-in'),
  v('mobile', 'Mobile App'),
];

export const PARTY_TYPE_REPORT: EnumValue[] = [
  v('customer', 'Customer'),
  v('vendor', 'Vendor'),
];

export const BOOKING_STATUS: EnumValue[] = [
  v('pending', 'Pending', { tone: 'warning' }),
  v('confirmed', 'Confirmed', { tone: 'success' }),
  v('cancelled', 'Cancelled', { tone: 'destructive' }),
  v('completed', 'Completed', { tone: 'success' }),
  v('no_show', 'No Show', { tone: 'destructive' }),
  v('rescheduled', 'Rescheduled', { tone: 'info' }),
];

export const BOOKING_PAYMENT_STATUS: EnumValue[] = [
  v('unpaid', 'Unpaid', { tone: 'destructive' }),
  v('partial', 'Partial', { tone: 'warning' }),
  v('paid', 'Paid', { tone: 'success' }),
  v('refunded', 'Refunded', { tone: 'info' }),
];

export const PORTAL_TYPE: EnumValue[] = [
  v('customer', 'Customer Portal'),
  v('vendor', 'Vendor Portal'),
  v('employee', 'Employee Portal'),
];

export const AWARD_FREQUENCY: EnumValue[] = [
  v('one-time', 'One-time'),
  v('monthly', 'Monthly'),
  v('quarterly', 'Quarterly'),
  v('annual', 'Annual'),
];

/* ------------------------------------------------------------------ */

/**
 * Single source of truth — `<EnumFormField enumName="..." />` and the
 * `enum` lookup adapter both resolve against this map. Add a new enum
 * by appending an entry here; nothing else needs to change for the
 * picker to start surfacing the new values.
 */
export const CRM_ENUMS = {
  // Status enums
  leadStatus: LEAD_STATUS,
  dealStatus: DEAL_STATUS,
  taskStatus: TASK_STATUS,
  taskStatusLegacy: TASK_STATUS_LEGACY,
  projectStatus: PROJECT_STATUS,
  issueStatus: ISSUE_STATUS,
  milestoneStatus: MILESTONE_STATUS,
  subtaskStatus: SUBTASK_STATUS,
  subtaskParentKindRust: SUBTASK_PARENT_KIND_RUST,
  taskType: TASK_TYPE,
  recurringFrequencySimple: RECURRING_FREQUENCY_SIMPLE,
  leadStatusLegacy: LEAD_STATUS_LEGACY,
  leadStatusListFilter: LEAD_STATUS_LIST_FILTER,
  kbVisibility: KB_VISIBILITY,
  kbStatus: KB_STATUS,
  replyTemplateStatus: REPLY_TEMPLATE_STATUS,
  replyTemplateCategory: REPLY_TEMPLATE_CATEGORY,
  languageShort: LANGUAGE_SHORT,
  formFieldType: FORM_FIELD_TYPE,
  contactStatus: CONTACT_STATUS,
  lifecycleStage: LIFECYCLE_STAGE,
  pipelineEntityKind: PIPELINE_ENTITY_KIND,
  activeDraftArchived: ACTIVE_DRAFT_ARCHIVED,
  ticketStatus: TICKET_STATUS,
  invoiceStatus: INVOICE_STATUS,
  quotationStatus: QUOTATION_STATUS,
  salesOrderStatus: SALES_ORDER_STATUS,
  /** Rust-aligned SO fulfillment lifecycle. P1.1B Wave 2. */
  salesOrderFulfillmentStatus: SALES_ORDER_FULFILLMENT_STATUS,
  /** SO delivery method picker. P1.1B Wave 2. */
  salesOrderDeliveryMethod: SALES_ORDER_DELIVERY_METHOD,
  purchaseOrderStatus: PURCHASE_ORDER_STATUS,
  billStatus: BILL_STATUS,
  receiptStatus: RECEIPT_STATUS,
  /** Rust-aligned receipt clearance lifecycle. P1.1B Wave 2. */
  paymentReceiptStatus: PAYMENT_RECEIPT_STATUS,
  /** Rust-aligned payment mode. P1.1B Wave 2. */
  paymentMode: PAYMENT_MODE,
  creditNoteStatus: CREDIT_NOTE_STATUS,
  /** Rust-aligned credit-note workflow status. P1.1B Wave 2. */
  creditNoteStatusV2: CREDIT_NOTE_STATUS_V2,
  /** Credit-note reason picker. P1.1B Wave 2. */
  creditNoteReason: CREDIT_NOTE_REASON,
  /** Credit-note refund mode picker. P1.1B Wave 2. */
  creditNoteRefundMode: CREDIT_NOTE_REFUND_MODE,
  debitNoteStatus: DEBIT_NOTE_STATUS,
  /** Rust-aligned debit-note workflow status. P1.1B W3. */
  debitNoteStatusV2: DEBIT_NOTE_STATUS_V2,
  /** Debit-note reason picker. P1.1B W3. */
  debitNoteReason: DEBIT_NOTE_REASON,
  /** Debit-note refund mode picker. P1.1B W3. */
  debitNoteRefundMode: DEBIT_NOTE_REFUND_MODE,
  /** Payout (vendor payment) workflow status. P1.1B W3. */
  payoutStatus: PAYOUT_STATUS,
  /** Vendor bid workflow status. P1.1B W3. */
  vendorBidStatus: VENDOR_BID_STATUS,
  /** Hire / procurement-of-services lifecycle. P1.1B W3. */
  hireStatus: HIRE_STATUS,
  /** Hire sourcing-funnel stage (vendor-hire list filter). P1.1B W3. */
  hireStage: HIRE_STAGE,
  /** Recurring-expense schedule lifecycle. P1.1B W3. */
  recurringExpenseStatus: RECURRING_EXPENSE_STATUS,
  subscriptionStatus: SUBSCRIPTION_STATUS,
  contractStatus: CONTRACT_STATUS,
  rfqStatus: RFQ_STATUS,
  approvalStatus: APPROVAL_STATUS,
  leaveStatus: LEAVE_STATUS,
  attendanceStatus: ATTENDANCE_STATUS,
  interviewStatus: INTERVIEW_STATUS,
  candidateStatus: CANDIDATE_STATUS,
  employeeStatus: EMPLOYEE_STATUS,
  assetStatus: ASSET_STATUS,

  // HR — recruiting + lifecycle (1E sweep)
  candidateStage: CANDIDATE_STAGE,
  candidateSource: CANDIDATE_SOURCE,
  offerStatus: OFFER_STATUS,
  offerSalaryPeriod: OFFER_SALARY_PERIOD,
  interviewType: INTERVIEW_TYPE,
  interviewRecommendation: INTERVIEW_RECOMMENDATION,
  interviewLifecycle: INTERVIEW_LIFECYCLE,
  onboardingStatus: ONBOARDING_STATUS,
  onboardingTaskStatus: ONBOARDING_TASK_STATUS,
  exitType: EXIT_TYPE,
  exitStatus: EXIT_STATUS,
  exitClearanceStatus: EXIT_CLEARANCE_STATUS,
  nocStatus: NOC_STATUS,
  assetReturnStatus: ASSET_RETURN_STATUS,
  probationStatus: PROBATION_STATUS,
  probationRecommendation: PROBATION_RECOMMENDATION,
  jobStatus: JOB_STATUS,
  jobEmploymentType: JOB_EMPLOYMENT_TYPE,
  jobExperienceLevel: JOB_EXPERIENCE_LEVEL,
  jobWorkMode: JOB_WORK_MODE,

  // HR — operations / engagement (1E sweep)
  travelStatus: TRAVEL_STATUS,
  travelMode: TRAVEL_MODE,
  trainingStatus: TRAINING_STATUS,
  trainingDeliveryMode: TRAINING_DELIVERY_MODE,
  assetAssignmentStatus: ASSET_ASSIGNMENT_STATUS,
  disciplinaryType: DISCIPLINARY_TYPE,
  disciplinaryStatus: DISCIPLINARY_STATUS,
  feedback360Status: FEEDBACK_360_STATUS,
  surveyStatus: SURVEY_STATUS,
  surveyQuestionType: SURVEY_QUESTION_TYPE,
  oneOnOneStatus: ONE_ON_ONE_STATUS,
  okrStatus: OKR_STATUS,
  okrPeriod: OKR_PERIOD,
  goalStatus: GOAL_STATUS,
  appraisalStatus: APPRAISAL_STATUS,
  expenseClaimStatus: EXPENSE_CLAIM_STATUS,
  announcementAudience: ANNOUNCEMENT_AUDIENCE,
  announcementCategory: ANNOUNCEMENT_CATEGORY,
  announcementStatus: ANNOUNCEMENT_STATUS,
  announcementSeverity: ANNOUNCEMENT_SEVERITY,
  policyCategory: POLICY_CATEGORY,
  policyStatus: POLICY_STATUS,
  noticePriority: NOTICE_PRIORITY,
  recognitionType: RECOGNITION_TYPE,
  shiftType: SHIFT_TYPE,
  leaveDuration: LEAVE_DURATION,
  halfDayType: HALF_DAY_TYPE,
  successionReadiness: SUCCESSION_READINESS,
  certificationStatus: CERTIFICATION_STATUS,
  documentVisibility: DOCUMENT_VISIBILITY,
  documentCategory: DOCUMENT_CATEGORY,
  documentEntityKind: DOCUMENT_ENTITY_KIND,
  documentStatus: DOCUMENT_STATUS,
  assetCategory: ASSET_CATEGORY,
  noticeAudience: NOTICE_AUDIENCE,
  kbArticleType: KB_ARTICLE_TYPE,
  disciplinaryCaseType: DISCIPLINARY_CASE_TYPE,
  disciplinarySeverity: DISCIPLINARY_SEVERITY,
  disciplinaryCaseStatus: DISCIPLINARY_CASE_STATUS,
  policyDocCategory: POLICY_DOC_CATEGORY,
  policyDocStatus: POLICY_DOC_STATUS,
  documentTemplateCategory: DOCUMENT_TEMPLATE_CATEGORY,
  documentTemplateStatus: DOCUMENT_TEMPLATE_STATUS,
  welcomeKitStatus: WELCOME_KIT_STATUS,
  timesheetStatus: TIMESHEET_STATUS,
  tdsQuarter: TDS_QUARTER,
  tdsStatus: TDS_STATUS,
  form16Status: FORM_16_STATUS,

  // Type / classification enums
  employmentType: EMPLOYMENT_TYPE,
  gender: GENDER,
  maritalStatus: MARITAL_STATUS,
  bloodGroup: BLOOD_GROUP,
  leaveType: LEAVE_TYPE,
  customerType: CUSTOMER_TYPE,
  paymentMethod: PAYMENT_METHOD,
  paymentTerms: PAYMENT_TERMS,
  paymentTermsLegacy: PAYMENT_TERMS_LEGACY,
  discountType: DISCOUNT_TYPE,
  taxType: TAX_TYPE,
  gstTreatment: GST_TREATMENT,
  recurringFrequency: RECURRING_FREQUENCY,
  ticketChannel: TICKET_CHANNEL,
  communicationChannel: COMMUNICATION_CHANNEL,
  assetCondition: ASSET_CONDITION,
  accountCategory: ACCOUNT_CATEGORY,

  // Polymorphic kind discriminators
  requesterKind: REQUESTER_KIND,
  partyKind: PARTY_KIND,
  linkedEntityKind: LINKED_ENTITY_KIND,
  subtaskParentKind: SUBTASK_PARENT_KIND,

  // Priorities
  priority: PRIORITY,
  priorityMedium: PRIORITY_MEDIUM,
  priorityLegacy: PRIORITY_LEGACY,
  severity: SEVERITY,
  ticketSeverity: TICKET_SEVERITY,
  ticketPriority: TICKET_PRIORITY,
  ticketPriorityWithAll: TICKET_PRIORITY_WITH_ALL,

  // Misc
  yesNo: YES_NO,
  weekday: WEEKDAY,
  month: MONTH,
  countryRegion: COUNTRY_REGION,
  channelDirection: CHANNEL_DIRECTION,
  rating5: RATING_5,

  // Accounting / Banking (Phase §1E sweep)
  voucherType: VOUCHER_TYPE,
  voucherResetFrequency: VOUCHER_RESET_FREQUENCY,
  accountNature: ACCOUNT_NATURE,
  accountBalanceType: ACCOUNT_BALANCE_TYPE,
  accountTaxBehavior: ACCOUNT_TAX_BEHAVIOR,
  accountActiveStatus: ACCOUNT_ACTIVE_STATUS,
  paymentAccountType: PAYMENT_ACCOUNT_TYPE,
  bankAccountSubtype: BANK_ACCOUNT_SUBTYPE,
  paymentAccountStatus: PAYMENT_ACCOUNT_STATUS,
  bankTransactionDirection: BANK_TRANSACTION_DIRECTION,
  bankTransactionStatus: BANK_TRANSACTION_STATUS,
  reconciliationStatus: RECONCILIATION_STATUS,

  // Settings / Integrations / Preferences (Phase §1E sweep)
  fiscalYearStart: FISCAL_YEAR_START,
  rtlFlag: RTL_FLAG,
  datepickerFormat: DATEPICKER_FORMAT,
  momentFormat: MOMENT_FORMAT,
  timeFormat: TIME_FORMAT,
  weekStart: WEEK_START,
  numberFormat: NUMBER_FORMAT,
  appLocale: APP_LOCALE,
  integrationKind: INTEGRATION_KIND,
  storageProvider: STORAGE_PROVIDER,
  paymentGatewayType: PAYMENT_GATEWAY_TYPE,
  smtpEncryption: SMTP_ENCRYPTION,
  webhookMethod: WEBHOOK_METHOD,
  webhookContentType: WEBHOOK_CONTENT_TYPE,
  httpMethod: HTTP_METHOD,
  defaultTaskView: DEFAULT_TASK_VIEW,
  defaultLeadView: DEFAULT_LEAD_VIEW,
  timezonePreset: TIMEZONE_PRESET,
  tokenScope: TOKEN_SCOPE,
  customFieldType: CUSTOM_FIELD_TYPE,
  emailTemplateKind: EMAIL_TEMPLATE_KIND,
  emailTemplateCategory: EMAIL_TEMPLATE_CATEGORY,
  emailTemplateStatus: EMAIL_TEMPLATE_STATUS,
  projectDefaultPrivacy: PROJECT_DEFAULT_PRIVACY,
  storageDefaultVisibility: STORAGE_DEFAULT_VISIBILITY,
  pushProvider: PUSH_PROVIDER,
  socialAuthProvider: SOCIAL_AUTH_PROVIDER,
  expenseCategoryKind: EXPENSE_CATEGORY_KIND,
  gdprRequestKind: GDPR_REQUEST_KIND,
  attendanceMode: ATTENDANCE_MODE,
  taxCalculationBasis: TAX_CALCULATION_BASIS,
  promotionDiscountKind: PROMOTION_DISCOUNT_KIND,
  facebookAdAccountKind: FACEBOOK_AD_ACCOUNT_KIND,
  quickbooksEnvironment: QUICKBOOKS_ENVIRONMENT,
  gatewayMode: GATEWAY_MODE,
  promotionAudience: PROMOTION_AUDIENCE,
  emailFromBehavior: EMAIL_FROM_BEHAVIOR,
  tokenPermission: TOKEN_PERMISSION,
  tokenExpiry: TOKEN_EXPIRY,
  storageDriver: STORAGE_DRIVER,
  dashboardWidgetSize: DASHBOARD_WIDGET_SIZE,
  removalRequestStatus: REMOVAL_REQUEST_STATUS,
  customFieldEntity: CUSTOM_FIELD_ENTITY,
  eraseSubjectKind: ERASE_SUBJECT_KIND,
  eraseScope: ERASE_SCOPE,
  dashboardWidgetType: DASHBOARD_WIDGET_TYPE,
  currencyPosition: CURRENCY_POSITION,
  calendarPeriod: CALENDAR_PERIOD,
  reminderUnit: REMINDER_UNIT,
  leaveDuration: LEAVE_DURATION,
  halfDayType: HALF_DAY_TYPE,

  // Payroll settings (1E.sweep)
  payFrequency: PAY_FREQUENCY,
  payrollCurrency: PAYROLL_CURRENCY,
  taxRegime: TAX_REGIME,
  payslipTemplate: PAYSLIP_TEMPLATE,

  // Purchases — vendor classification (P1.1B W3 sweep)
  vendorIndustry: VENDOR_INDUSTRY,
  taxTreatment: TAX_TREATMENT,
  msmeCategory: MSME_CATEGORY,

  // Inventory (P1.1B Wave 4)
  stockAdjustmentReason: STOCK_ADJUSTMENT_REASON,
  productionOrderStatus: PRODUCTION_ORDER_STATUS,
  grnStatus: GRN_STATUS,
  bomStatus: BOM_STATUS,
  itemStockStatus: ITEM_STOCK_STATUS,
  warehouseType: WAREHOUSE_TYPE,
  warehouseStatus: WAREHOUSE_STATUS,
  stockTransferStatus: STOCK_TRANSFER_STATUS,
  itemBatchStatus: ITEM_BATCH_STATUS,
  itemTaxPreference: ITEM_TAX_PREFERENCE,

  // Sales-CRM / time-tracking (§1E sweep)
  automationTrigger: AUTOMATION_TRIGGER,
  timeBillableFilter: TIME_BILLABLE_FILTER,

  // §1E Sales-module enums
  giftCardStatus: GIFT_CARD_STATUS,
  couponType: COUPON_TYPE,
  promotionType: PROMOTION_TYPE,
  promotionStatus: PROMOTION_STATUS,
  loyaltyStatus: LOYALTY_STATUS,
  estimateTemplateStatus: ESTIMATE_TEMPLATE_STATUS,
  estimateTemplateCategory: ESTIMATE_TEMPLATE_CATEGORY,
  estimateRequestSource: ESTIMATE_REQUEST_SOURCE,
  estimateRequestStatus: ESTIMATE_REQUEST_STATUS,
  proposalStatus: PROPOSAL_STATUS,
  contractTemplateType: CONTRACT_TEMPLATE_TYPE,
  contractTemplateStatus: CONTRACT_TEMPLATE_STATUS,
  contractTypeStatus: CONTRACT_TYPE_STATUS,
  contractTypeExtended: CONTRACT_TYPE_EXTENDED,
  esignProviderExtended: ESIGN_PROVIDER_EXTENDED,
  deliveryChallanStatus: DELIVERY_CHALLAN_STATUS,
  recurringInvoiceFrequency: RECURRING_INVOICE_FREQUENCY,
  recurringInvoiceStatus: RECURRING_INVOICE_STATUS,
  subBillingFrequency: SUB_BILLING_FREQUENCY,
  subRenewalMode: SUB_RENEWAL_MODE,

  // Loans module (§1E sweep)
  loanDirection: LOAN_DIRECTION,
  loanStatus: LOAN_STATUS,
  loanType: LOAN_TYPE,
  borrowerType: BORROWER_TYPE,

  // Banking extended (§1E sweep)
  bankFileFormat: BANK_FILE_FORMAT,
  bankTransactionTypeExt: BANK_TRANSACTION_TYPE_EXT,

  // Inventory types (§1E sweep)
  itemType: ITEM_TYPE,
  inventoryTransactionType: INVENTORY_TRANSACTION_TYPE,
  inventoryTrackingFilter: INVENTORY_TRACKING_FILTER,
  grnQcStatus: GRN_QC_STATUS,

  // Attendance extended (§1E sweep)
  attendanceFormStatus: ATTENDANCE_FORM_STATUS,
  attendanceSource: ATTENDANCE_SOURCE,

  // Reports (§1E sweep)
  partyTypeReport: PARTY_TYPE_REPORT,

  // Bookings (§1E sweep)
  bookingStatus: BOOKING_STATUS,
  bookingPaymentStatus: BOOKING_PAYMENT_STATUS,

  // Portal (§1E sweep)
  portalType: PORTAL_TYPE,

  // Workspace awards (§1E sweep)
  awardFrequency: AWARD_FREQUENCY,

  // §1E HRM payroll Select migration
  holidayType: HOLIDAY_TYPE,
  daysOffType: DAYS_OFF_TYPE,
  payslipStatus: PAYSLIP_STATUS,
  payrollRunStatus: PAYROLL_RUN_STATUS,
  payrollRunFilterStatus: PAYROLL_RUN_FILTER_STATUS,
  appraisalFormStatus: APPRAISAL_FORM_STATUS,
  goalFormStatus: GOAL_FORM_STATUS,
  activeArchived: ACTIVE_ARCHIVED,
  pfEsiStatus: PF_ESI_STATUS,
  kpiFrequency: KPI_FREQUENCY,
  kpiFormStatus: KPI_FORM_STATUS,
} as const satisfies Record<string, EnumValue[]>;

export type CrmEnumName = keyof typeof CRM_ENUMS;

/**
 * Resolve an enum by name — returns `null` for unknown names so the
 * picker can fall back to the user-typed inline value (id = label).
 * Looser typing than `CRM_ENUMS[name]` so call-sites don't need to
 * narrow before reading.
 */
export function resolveCrmEnum(name: string): EnumValue[] | null {
  return (CRM_ENUMS as Record<string, EnumValue[]>)[name] ?? null;
}

export function findCrmEnumValue(name: string, id: string): EnumValue | null {
  const list = resolveCrmEnum(name);
  if (!list) return null;
  return list.find((it) => it.id === id) ?? null;
}
