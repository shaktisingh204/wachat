/**
 * Per-document seed templates. Loaded by `LiveDocumentEditor` when no
 * `initialData` is supplied (the "new document" case) so the user opens
 * a page that is already 80% drafted rather than a blank canvas.
 *
 * Add a new type by:
 *   1) extending the `DocumentType` union in `live-document-editor.tsx`,
 *   2) registering an entry in `SEED_TEMPLATES` below, and
 *   3) registering its sidebar entity in `SIDEBAR_ENTITY_BY_TYPE`.
 */

import type { DocumentType } from './live-document-editor';

export interface DocumentSeed {
  title: string;
  sections: Array<{ heading: string; body: string }>;
  lineItems?: Array<Record<string, unknown>>;
  designMetadata?: Partial<{
    themeColor: string;
    fontFamily: string;
    showLogo: boolean;
    showWatermark: boolean;
    marginSize: 'small' | 'normal' | 'large';
    layoutStyle: 'modern' | 'classic' | 'minimal';
    customCss: string;
  }>;
  currency?: string;
  status?: string;
}

const ASSUMPTIVE_INTRO =
  'This document is a working draft. Edit any section heading or body inline — the live preview on the left mirrors what your client / employee will see.';

export const SEED_TEMPLATES: Record<DocumentType, DocumentSeed> = {
  // ---------------------------------------------------------------------------
  // Sales (already shipped — kept here so every type has a seed)
  // ---------------------------------------------------------------------------
  proposal: {
    title: 'Proposal — {Client Name}',
    sections: [
      { heading: 'Executive summary', body: 'Outline the problem, our proposed approach, and why it lands faster than the alternatives.' },
      { heading: 'Scope of work', body: 'List the deliverables. Be specific enough that the client knows what they get and what they do not.' },
      { heading: 'Timeline & milestones', body: 'Phase 1 — Discovery (week 1)\nPhase 2 — Build (weeks 2–5)\nPhase 3 — Launch (week 6)' },
      { heading: 'Investment', body: 'Pricing summary, payment schedule, and what triggers each invoice.' },
      { heading: 'Terms & next steps', body: 'Acceptance criteria, validity window, and who to reply to.' },
    ],
  },
  estimate: {
    title: 'Estimate #EST-0001',
    sections: [
      { heading: 'Project overview', body: 'A short description of the work this estimate covers.' },
      { heading: 'Cost breakdown', body: 'See the line items section for itemized pricing.' },
      { heading: 'Assumptions', body: '• Scope is fixed at sign-off.\n• Change requests are billed separately.' },
    ],
  },
  quotation: {
    title: 'Quotation Q-0001',
    sections: [
      { heading: 'Items & pricing', body: 'Itemized in the line items below. Prices are firm for the validity window.' },
      { heading: 'Delivery & terms', body: 'Lead time, payment terms, and warranty.' },
    ],
  },
  invoice: {
    title: 'Invoice INV-0001',
    sections: [
      { heading: 'Bill to', body: '{Client legal name}\n{Address}\n{GSTIN / VAT ID}' },
      { heading: 'Charges', body: 'Itemized below. Taxes calculated at the configured rate.' },
      { heading: 'Payment instructions', body: 'Bank: {Bank name}\nA/C: {Account number}\nIFSC / SWIFT: {Code}' },
    ],
  },
  delivery: {
    title: 'Delivery Challan DC-0001',
    sections: [
      { heading: 'Ship to', body: '{Recipient name}\n{Delivery address}\n{Contact number}' },
      { heading: 'Items dispatched', body: 'Itemized in the line items below with quantities and HSN codes.' },
      { heading: 'Transport details', body: 'Vehicle: {No.}\nDriver: {Name / Phone}\nDispatched on: {Date}' },
    ],
  },
  order: {
    title: 'Sales Order SO-0001',
    sections: [
      { heading: 'Order summary', body: 'Confirms the items, prices, and quantities the customer has approved.' },
      { heading: 'Delivery schedule', body: 'Expected ship-by date and split shipments, if any.' },
      { heading: 'Payment & terms', body: 'Payment terms agreed and any holds before fulfillment.' },
    ],
  },
  proforma: {
    title: 'Proforma Invoice PRO-0001',
    sections: [
      { heading: 'Quoted to', body: '{Customer name}\n{Address}\n{Tax ID}' },
      { heading: 'Expected charges', body: 'Itemized below — this is a non-binding preview ahead of the final invoice.' },
      { heading: 'Conversion terms', body: 'Once paid, this proforma is converted to a tax invoice automatically.' },
    ],
  },
  credit_note: {
    title: 'Credit Note CN-0001',
    sections: [
      { heading: 'Issued to', body: '{Customer name}\nReference invoice: {INV number}' },
      { heading: 'Reason', body: 'Short explanation — return, price adjustment, billing correction.' },
      { heading: 'Credit summary', body: 'Itemized credit lines below.' },
    ],
  },

  // ---------------------------------------------------------------------------
  // CRM — contracts, service contracts, procurement
  // ---------------------------------------------------------------------------
  contract: {
    title: 'Master Services Agreement — {Counterparty}',
    sections: [
      { heading: '1. Parties', body: 'This Agreement is made on {date} between {Our Company} ("Provider") and {Counterparty} ("Client").' },
      { heading: '2. Services', body: 'Provider will deliver the services described in the attached Statement of Work, as updated from time to time.' },
      { heading: '3. Fees & payment', body: 'Fees are invoiced monthly in arrears and payable within 30 days. Late payments accrue interest at 1.5% per month.' },
      { heading: '4. Confidentiality', body: 'Each party will keep the other party\'s Confidential Information confidential for the duration of this Agreement and 3 years after termination.' },
      { heading: '5. IP ownership', body: 'Deliverables become the Client\'s exclusive property upon payment in full. Provider retains its background IP.' },
      { heading: '6. Term & termination', body: 'Initial term: 12 months. Either party may terminate with 60 days written notice. Material breach: 30 days cure period.' },
      { heading: '7. Limitation of liability', body: 'Each party\'s aggregate liability is capped at fees paid in the preceding 12 months. No indirect or consequential damages.' },
      { heading: '8. Governing law', body: 'This Agreement is governed by the laws of {Jurisdiction}. Disputes go to the courts of {City}.' },
      { heading: 'Signatures', body: 'For Provider: ____________________\nFor Client:   ____________________' },
    ],
  },
  service_contract: {
    title: 'Service Contract — {Client} — {Service}',
    sections: [
      { heading: 'Service scope', body: 'What is covered, what is excluded, and any usage thresholds.' },
      { heading: 'Service levels', body: 'Response time, resolution time, uptime targets, and the credits owed on a miss.' },
      { heading: 'Pricing & invoicing', body: 'Recurring fee, included usage, overage rates, and billing cadence.' },
      { heading: 'Term & renewal', body: 'Initial term, auto-renewal, and the notice period to opt out.' },
      { heading: 'Acceptance', body: 'Client agrees to the terms above by counter-signing or paying the first invoice.' },
    ],
  },
  purchase_order: {
    title: 'Purchase Order PO-0001',
    sections: [
      { heading: 'Vendor', body: '{Vendor name}\n{Vendor address}\n{GSTIN / Tax ID}' },
      { heading: 'Ship to', body: '{Delivery site}\n{Receiving contact + phone}' },
      { heading: 'Items ordered', body: 'Itemized below with quantities, unit prices, and required-by dates.' },
      { heading: 'Terms', body: 'Payment: {Net 30 / Net 45}\nDelivery: {FOB / DDP}\nInspection: 5 business days from receipt.' },
    ],
  },
  expense_report: {
    title: 'Expense Report — {Period}',
    sections: [
      { heading: 'Submitter', body: '{Name} — {Department}\nReporting to: {Manager}' },
      { heading: 'Summary', body: 'Total claimed, currency, and the business purpose.' },
      { heading: 'Line items', body: 'See the line items section — date, category, merchant, amount, and receipt attached.' },
      { heading: 'Approval', body: 'Approver signs below confirming the expenses are policy-compliant.' },
    ],
  },
  payout: {
    title: 'Payout Voucher PV-0001',
    sections: [
      { heading: 'Payee', body: '{Payee name}\n{Bank account / UPI handle}' },
      { heading: 'Reason', body: 'Reference invoice, contract, or claim that this payout settles.' },
      { heading: 'Amount & method', body: 'Amount, payment method (NEFT/RTGS/UPI), and value date.' },
    ],
  },
  debit_note: {
    title: 'Debit Note DN-0001',
    sections: [
      { heading: 'Issued to', body: '{Vendor name}\nReference bill: {Bill number}' },
      { heading: 'Reason', body: 'Short explanation — short delivery, quality issue, pricing correction.' },
      { heading: 'Debit summary', body: 'Itemized debit lines below.' },
    ],
  },

  // ---------------------------------------------------------------------------
  // HRM — letters, certificates, policies
  // ---------------------------------------------------------------------------
  offer_letter: {
    title: 'Offer Letter — {Candidate Name}',
    sections: [
      { heading: 'Welcome', body: 'Dear {Candidate}, we are delighted to offer you the position of {Designation} at {Company}.' },
      { heading: 'Role & start date', body: 'Designation: {Designation}\nReporting to: {Manager}\nStart date: {Date}\nLocation: {City / Remote}' },
      { heading: 'Compensation', body: 'Annual CTC: {Amount}\nFixed component: {Amount}\nVariable / bonus: {Amount}\nESOPs: {if any}' },
      { heading: 'Benefits', body: '• Health insurance for self + family\n• {N} days paid leave per year\n• Paid time off on public holidays\n• Learning & development budget' },
      { heading: 'Probation', body: 'Initial probation: 3 months. Confirmation is subject to performance review at the end of probation.' },
      { heading: 'Acceptance', body: 'Please countersign and return this letter by {Date} to confirm acceptance.' },
    ],
  },
  exit_letter: {
    title: 'Experience Letter / Relieving — {Employee Name}',
    sections: [
      { heading: 'To whom it may concern', body: 'This is to certify that {Employee} was employed with {Company} from {Joining Date} to {Last Working Date} as {Designation}.' },
      { heading: 'Conduct & contribution', body: 'During the tenure {Employee} was found to be sincere, hardworking, and a valued contributor to the team.' },
      { heading: 'Clearance & dues', body: 'All dues have been settled and the employee has completed the exit clearance process.' },
      { heading: 'Best wishes', body: 'We wish {Employee} the very best in all future endeavors.' },
    ],
  },
  award: {
    title: 'Award Letter — {Recipient}',
    sections: [
      { heading: 'Recognition', body: 'In recognition of outstanding contribution to {Project / Initiative}, the leadership team is delighted to award {Recipient} the {Award Name}.' },
      { heading: 'Impact', body: 'Briefly describe what the recipient did and the measurable outcome it produced.' },
      { heading: 'Reward', body: 'The award carries a {Cash / Voucher / Time off} component, effective immediately.' },
    ],
  },
  certification: {
    title: 'Certificate of Completion — {Course}',
    sections: [
      { heading: 'Certificate', body: 'This certificate is awarded to {Employee Name} on {Date} for successfully completing {Course / Programme}.' },
      { heading: 'Skills covered', body: 'Briefly list the competencies validated by this certificate.' },
      { heading: 'Issued by', body: '{Issuer}\nSignature: ____________________' },
    ],
  },
  expense_claim: {
    title: 'Expense Claim — {Period}',
    sections: [
      { heading: 'Claimant', body: '{Employee name}\n{Department}\n{Employee ID}' },
      { heading: 'Trip / purpose', body: 'Business purpose, project code, and approving manager.' },
      { heading: 'Itemized claims', body: 'See the line items below — date, vendor, category, amount, and receipt.' },
      { heading: 'Declaration', body: 'I certify that the above expenses were incurred on official business and have not been claimed elsewhere.' },
    ],
  },
  travel_request: {
    title: 'Travel Request — {Destination} — {Dates}',
    sections: [
      { heading: 'Traveller', body: '{Employee name}, {Designation}\n{Department}' },
      { heading: 'Trip details', body: 'Destination: {City, Country}\nDates: {Start} → {End}\nPurpose: {Meeting / Conference / Site visit}' },
      { heading: 'Itinerary', body: '• Outbound flight: {Route / preferred time}\n• Return flight: {Route / preferred time}\n• Hotel: {Stars / area}\n• Local transport: {Cab / rental}' },
      { heading: 'Cost estimate', body: 'See the line items below for itemized cost estimate. Final reconciliation via expense claim post-trip.' },
      { heading: 'Approval', body: 'Submitted by: {Employee}\nManager approval: ____________________' },
    ],
  },
  disciplinary_letter: {
    title: 'Disciplinary Notice — {Employee Name}',
    sections: [
      { heading: 'Incident', body: 'Date / location of the incident and a factual summary of what occurred.' },
      { heading: 'Policy reference', body: 'Cite the specific clause(s) of the employee handbook or code of conduct that apply.' },
      { heading: 'Action', body: 'Verbal warning / written warning / final warning / suspension — and the corrective action expected.' },
      { heading: 'Acknowledgement', body: 'The employee acknowledges receipt of this notice. Acknowledgement does not constitute agreement.' },
    ],
  },
  notice: {
    title: 'Internal Notice — {Subject}',
    sections: [
      { heading: 'Purpose', body: 'What this notice is about, in one short paragraph.' },
      { heading: 'Details', body: 'The full text of the notice, including any dates and recipients.' },
      { heading: 'Action required', body: 'What the recipient is expected to do, and by when.' },
    ],
  },
  announcement: {
    title: 'Announcement — {Headline}',
    sections: [
      { heading: 'The headline', body: 'A one-sentence summary the team will read first.' },
      { heading: 'Why it matters', body: 'The context. What changes for the team / customers, and why now.' },
      { heading: 'What\'s next', body: 'Concrete next steps, who is involved, and timelines.' },
      { heading: 'Questions', body: 'Where to direct questions — channel, owner, office hours.' },
    ],
  },
  feedback_360: {
    title: '360° Feedback — {Reviewee} — {Cycle}',
    sections: [
      { heading: 'Strengths', body: 'What the reviewee does exceptionally well. Be specific — cite recent examples.' },
      { heading: 'Areas to grow', body: 'Where the reviewee could focus next quarter to level up. Frame as opportunities, not criticisms.' },
      { heading: 'Collaboration', body: 'How the reviewee shows up for peers and stakeholders.' },
      { heading: 'Open comments', body: 'Anything else the reviewee or their manager should know.' },
    ],
  },
  probation_letter: {
    title: 'Probation Confirmation — {Employee Name}',
    sections: [
      { heading: 'Status', body: 'We are pleased to confirm {Employee} in the role of {Designation} effective {Date}, on successful completion of the probation period.' },
      { heading: 'Updated terms', body: 'Any updates to compensation, leave, or notice period that take effect on confirmation.' },
      { heading: 'Next steps', body: 'Goals for the next review cycle and the date of the first post-confirmation check-in.' },
    ],
  },
  recognition: {
    title: 'Recognition — {Recipient}',
    sections: [
      { heading: 'The shout-out', body: 'A short, specific recognition message. Name the behaviour and its impact.' },
      { heading: 'Nominated by', body: '{Nominator name} — {Relationship to recipient}' },
      { heading: 'Reward', body: '{Points / Voucher / Time off} — applied automatically.' },
    ],
  },
  policy: {
    title: '{Policy Name}',
    sections: [
      { heading: 'Purpose', body: 'Why this policy exists and what behaviour it is designed to enable or prevent.' },
      { heading: 'Scope', body: 'Who this applies to — full-time, part-time, contractors, interns, regions.' },
      { heading: 'Policy', body: 'The rules themselves, organised in numbered clauses.' },
      { heading: 'Exceptions & approvals', body: 'When exceptions are allowed and who can grant them.' },
      { heading: 'Effective date & owner', body: 'Effective from: {Date}\nPolicy owner: {Person / Team}\nReview cycle: {Annual / Bi-annual}' },
    ],
  },
  document_template: {
    title: 'Document Template — {Name}',
    sections: [
      { heading: 'Template purpose', body: 'When to use this template and what it should produce.' },
      { heading: 'Body', body: 'The reusable boilerplate the user starts from. Placeholder variables in {curly braces} are replaced on use.' },
      { heading: 'Notes for editors', body: 'Anything a future editor of this template should know — versioning, ownership, related templates.' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Sidebar entity binding
// ---------------------------------------------------------------------------
// Some document types are "about" a customer/account; others are "about" an
// employee/candidate. The sidebar uses this to render the right relationship
// picker (Account vs Employee) without each page passing it in manually.
// ---------------------------------------------------------------------------

export type SidebarEntity = 'account' | 'employee' | 'candidate' | 'vendor' | 'none';

export const SIDEBAR_ENTITY_BY_TYPE: Record<DocumentType, SidebarEntity> = {
  // sales — about a customer
  proposal: 'account',
  estimate: 'account',
  quotation: 'account',
  invoice: 'account',
  delivery: 'account',
  order: 'account',
  proforma: 'account',
  credit_note: 'account',

  // crm — contracts
  contract: 'account',
  service_contract: 'account',

  // crm — procurement (about a vendor)
  purchase_order: 'vendor',
  expense_report: 'employee',
  payout: 'vendor',
  debit_note: 'vendor',

  // hrm — about an employee
  offer_letter: 'candidate',
  exit_letter: 'employee',
  award: 'employee',
  certification: 'employee',
  expense_claim: 'employee',
  travel_request: 'employee',
  disciplinary_letter: 'employee',
  notice: 'none',
  announcement: 'none',
  feedback_360: 'employee',
  probation_letter: 'employee',
  recognition: 'employee',
  policy: 'none',
  document_template: 'none',
};

// ---------------------------------------------------------------------------
// FormData field aliases. Each document type's existing server action expects
// a different "primary key" / "primary date" field name. Aliases let the
// editor stay generic.
// ---------------------------------------------------------------------------

export interface FieldAliases {
  /** Field name the editor copies `title` into (in addition to `title`). */
  numberField?: string;
  /** Field name the editor copies `validUntil` into (in addition to `validUntil`). */
  dateField?: string;
}

export const FIELD_ALIASES_BY_TYPE: Record<DocumentType, FieldAliases> = {
  proposal: {},
  estimate: { numberField: 'estimateNumber', dateField: 'validTillDate' },
  quotation: { numberField: 'quotationNumber', dateField: 'validTillDate' },
  invoice: { numberField: 'invoiceNumber', dateField: 'dueDate' },
  delivery: { numberField: 'challanNumber', dateField: 'challanDate' },
  order: { numberField: 'orderNumber', dateField: 'orderDate' },
  proforma: { numberField: 'proformaNumber', dateField: 'proformaDate' },
  credit_note: { numberField: 'creditNoteNumber', dateField: 'creditNoteDate' },

  contract: { numberField: 'contractNumber', dateField: 'effectiveDate' },
  service_contract: { numberField: 'contractNumber', dateField: 'effectiveDate' },
  purchase_order: { numberField: 'poNumber', dateField: 'poDate' },
  expense_report: { numberField: 'reportNumber', dateField: 'submittedOn' },
  payout: { numberField: 'voucherNumber', dateField: 'paidOn' },
  debit_note: { numberField: 'debitNoteNumber', dateField: 'debitNoteDate' },

  offer_letter: { numberField: 'offerNumber', dateField: 'startDate' },
  exit_letter: { numberField: 'letterNumber', dateField: 'lastWorkingDate' },
  award: { numberField: 'awardCode', dateField: 'awardedOn' },
  certification: { numberField: 'certificateNumber', dateField: 'issuedOn' },
  expense_claim: { numberField: 'claimNumber', dateField: 'submittedOn' },
  travel_request: { numberField: 'requestNumber', dateField: 'startDate' },
  disciplinary_letter: { numberField: 'caseNumber', dateField: 'incidentDate' },
  notice: { numberField: 'noticeNumber', dateField: 'effectiveDate' },
  announcement: { numberField: 'announcementCode', dateField: 'publishedOn' },
  feedback_360: { numberField: 'cycleCode', dateField: 'reviewDate' },
  probation_letter: { numberField: 'letterNumber', dateField: 'confirmationDate' },
  recognition: { numberField: 'recognitionCode', dateField: 'awardedOn' },
  policy: { numberField: 'policyCode', dateField: 'effectiveDate' },
  document_template: { numberField: 'templateCode' },
};

// ---------------------------------------------------------------------------
// Human-readable label for each type (sidebar + header).
// ---------------------------------------------------------------------------

export const DOCUMENT_LABEL_BY_TYPE: Record<DocumentType, string> = {
  proposal: 'Proposal',
  estimate: 'Estimate',
  quotation: 'Quotation',
  invoice: 'Invoice',
  delivery: 'Delivery Challan',
  order: 'Sales Order',
  proforma: 'Proforma Invoice',
  credit_note: 'Credit Note',

  contract: 'Contract',
  service_contract: 'Service Contract',
  purchase_order: 'Purchase Order',
  expense_report: 'Expense Report',
  payout: 'Payout Voucher',
  debit_note: 'Debit Note',

  offer_letter: 'Offer Letter',
  exit_letter: 'Experience Letter',
  award: 'Award Letter',
  certification: 'Certificate',
  expense_claim: 'Expense Claim',
  travel_request: 'Travel Request',
  disciplinary_letter: 'Disciplinary Notice',
  notice: 'Notice',
  announcement: 'Announcement',
  feedback_360: '360° Feedback',
  probation_letter: 'Probation Letter',
  recognition: 'Recognition',
  policy: 'Policy Document',
  document_template: 'Document Template',
};

export function getSeedTemplate(type: DocumentType): DocumentSeed {
  return SEED_TEMPLATES[type];
}

export function getSidebarEntity(type: DocumentType): SidebarEntity {
  return SIDEBAR_ENTITY_BY_TYPE[type] ?? 'none';
}

export function getFieldAliases(type: DocumentType): FieldAliases {
  return FIELD_ALIASES_BY_TYPE[type] ?? {};
}

export function getDocumentLabel(type: DocumentType): string {
  return DOCUMENT_LABEL_BY_TYPE[type] ?? type;
}
