/**
 * Sample inputs for visual / smoke-test verification of the PDF
 * templates.
 *
 * **Not exposed via any route.** To verify a template locally, import
 * the relevant render function plus a sample from this file and call
 * `htmlToPdf(renderInvoiceHtml(sampleInvoice, sampleCompany, sampleItems, sampleClient, samplePayments))`
 * from a one-off script or test, e.g.:
 *
 *   import { writeFileSync } from 'fs';
 *   import { htmlToPdf } from '@/lib/pdf-service';
 *   import { renderInvoiceHtml } from '@/lib/pdf-templates/invoice-template';
 *   import { sampleInvoice, sampleCompany, sampleClient, sampleItems, samplePayments } from '@/lib/pdf-templates/sample';
 *
 *   const html = renderInvoiceHtml(sampleInvoice, sampleCompany, sampleItems, sampleClient, samplePayments);
 *   const pdf = await htmlToPdf(html);
 *   writeFileSync('/tmp/sample-invoice.pdf', pdf);
 *
 * Do **not** create an `/api/pdf/test` route — that would let any
 * unauthenticated visitor render arbitrary PDFs and would leak the
 * sample-data formatting publicly.
 */

import type { ContractTemplateInput } from './contract-template';
import type { CreditNoteTemplateInput, OriginalInvoiceRef } from './credit-note-template';
import type { EstimateTemplateInput } from './estimate-template';
import type { InvoiceTemplateInput } from './invoice-template';
import type { ProposalTemplateInput } from './proposal-template';
import type { PdfClient, PdfCompany, PdfLineItem, PdfPayment } from './_shared';

export const sampleCompany: PdfCompany = {
  name: 'Acme Industries Pvt. Ltd.',
  address: '12 Innovation Way\nBangalore, KA 560001\nIndia',
  email: 'billing@acme.test',
  phone: '+91 80 1234 5678',
  website: 'https://acme.test',
  taxId: '29ABCDE1234F1Z5',
  logoUrl: null,
};

export const sampleClient: PdfClient = {
  name: 'Globex Corporation',
  address: '742 Evergreen Terrace\nSpringfield, OR 97477\nUnited States',
  email: 'ap@globex.test',
  phone: '+1 555 0199',
  taxId: 'US-EIN-22-3344556',
};

export const sampleItems: PdfLineItem[] = [
  {
    name: 'Implementation Services',
    description: 'On-site discovery + integration setup',
    hsnCode: '998313',
    quantity: 40,
    rate: 95,
    total: 3800,
  },
  {
    name: 'Annual Support Plan',
    description: 'Tier 2 SLA, 24x5 coverage',
    hsnCode: '998314',
    quantity: 1,
    rate: 1200,
    total: 1200,
  },
  {
    name: 'Onboarding Workshop',
    description: 'Two-day on-site session for 8 attendees',
    hsnCode: '999293',
    quantity: 2,
    rate: 400,
    total: 800,
  },
];

export const samplePayments: PdfPayment[] = [
  {
    date: new Date('2026-04-10'),
    amount: 2000,
    mode: 'Bank Transfer',
    reference: 'WIRE-2026-0410-AC',
  },
  {
    date: new Date('2026-04-22'),
    amount: 1000,
    mode: 'Credit Card',
    reference: 'STR-ch_3OqWf...',
  },
];

export const sampleInvoice: InvoiceTemplateInput = {
  invoiceNumber: 'INV-2026-0042',
  invoiceDate: new Date('2026-04-01'),
  dueDate: new Date('2026-04-30'),
  poNumber: 'PO-99-2026',
  currency: 'USD',
  status: 'Partial',
  subtotal: 5800,
  discount: 200,
  tax: 504,
  taxBreakdown: [
    { label: 'CGST (9%)', amount: 252 },
    { label: 'SGST (9%)', amount: 252 },
  ],
  total: 6104,
  amountPaid: 3000,
  balanceDue: 3104,
  notes: 'Net 30 from issue date. Please reference the invoice number on payment.',
  termsAndConditions: [
    'Late payments accrue 1.5% interest per month.',
    'All disputes must be raised within 7 days of receipt.',
  ],
  paymentInstructions: 'Wire to Acme Industries — Account 0011 2233 4455 — IFSC ACME0001',
};

export const sampleEstimate: EstimateTemplateInput = {
  estimateNumber: 'EST-2026-0007',
  estimateDate: new Date('2026-05-01'),
  validTill: new Date('2026-05-31'),
  currency: 'USD',
  status: 'waiting',
  subtotal: 5800,
  discount: 0,
  tax: 504,
  total: 6304,
  notes: 'Estimate covers FY26 Q2 deliverables. Subject to scope confirmation.',
};

export const sampleProposal: ProposalTemplateInput = {
  proposalNumber: 'PRO-2026-0019',
  title: 'Q3 Platform Modernisation',
  proposalDate: new Date('2026-05-15'),
  validTill: new Date('2026-06-15'),
  currency: 'USD',
  status: 'waiting',
  description:
    '<p>This proposal outlines the engagement to migrate Globex from legacy systems to a modern cloud-native architecture.</p><ul><li>Discovery &amp; architecture review</li><li>Pilot service migration</li><li>Knowledge transfer</li></ul>',
  note: 'Pricing assumes engagement starts on or before 2026-06-01.',
  subtotal: 5800,
  total: 6304,
  tax: 504,
};

export const sampleContract: ContractTemplateInput = {
  contractName: 'Master Services Agreement',
  contractNumber: 'CON-2026-0003',
  contractDate: new Date('2026-04-15'),
  startDate: new Date('2026-05-01'),
  endDate: new Date('2027-04-30'),
  amount: 120_000,
  currency: 'USD',
  partyFirst: 'Acme Industries Pvt. Ltd.',
  partySecond: 'Globex Corporation',
  contractDetail:
    '<h3>1. Scope</h3><p>The Supplier shall provide services as described in each Statement of Work.</p><h3>2. Payment</h3><p>Net 30 days from invoice receipt.</p><h3>3. Term</h3><p>This Agreement commences on the Start Date and continues for twelve (12) months.</p>',
  signed: false,
};

export const sampleCreditNote: CreditNoteTemplateInput = {
  creditNoteNumber: 'CN-00021',
  creditNoteDate: new Date('2026-05-05'),
  currency: 'USD',
  subtotal: 800,
  tax: 72,
  total: 872,
  reason: 'Onboarding workshop cancelled — partial refund issued.',
  notes: 'Credit can be applied against any open or future invoice within 12 months.',
};

export const sampleOriginalInvoiceRef: OriginalInvoiceRef = {
  invoiceNumber: 'INV-2026-0042',
  invoiceDate: new Date('2026-04-01'),
  total: 6104,
};
