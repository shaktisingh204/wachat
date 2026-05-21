/**
 * Invoice HTML template — renders to a Puppeteer-ready HTML string.
 *
 * Inputs are intentionally loose so both the Mongo doc shape and the
 * `PublicInvoiceView` shape from `public-invoice.actions.ts` can drive
 * it. Anything missing renders as an em-dash.
 */

import {
  companyHeader,
  formatDate,
  htmlHead,
  lineItemsTable,
  notesBlock,
  num,
  partyCard,
  paymentsTable,
  statusBadge,
  totalsBlock,
  escapeHtml,
  footerLine,
  type PdfClient,
  type PdfCompany,
  type PdfLineItem,
  type PdfPayment,
} from './_shared';

export type InvoiceTemplateInput = {
  invoiceNumber: string;
  invoiceDate?: Date | string | null;
  dueDate?: Date | string | null;
  poNumber?: string | null;
  currency?: string | null;
  status?: string | null;
  subtotal?: number | null;
  discount?: number | null;
  tax?: number | null;
  taxBreakdown?: Array<{ label: string; amount: number }>;
  shipping?: number | null;
  adjustment?: number | null;
  total: number;
  amountPaid?: number | null;
  balanceDue?: number | null;
  notes?: string | null;
  termsAndConditions?: string[] | string | null;
  paymentInstructions?: string | null;
};

export function renderInvoiceHtml(
  invoice: InvoiceTemplateInput,
  company: PdfCompany,
  items: PdfLineItem[],
  client: PdfClient,
  payments: PdfPayment[] = [],
): string {
  const currency = invoice.currency || 'USD';
  const total = num(invoice.total);
  const amountPaid =
    invoice.amountPaid != null
      ? num(invoice.amountPaid)
      : payments.reduce((s, p) => s + num(p.amount), 0);
  const balanceDue = invoice.balanceDue != null ? num(invoice.balanceDue) : Math.max(total - amountPaid, 0);

  const terms = Array.isArray(invoice.termsAndConditions)
    ? invoice.termsAndConditions.filter(Boolean).join('\n')
    : invoice.termsAndConditions || '';

  return `${htmlHead(`Invoice ${invoice.invoiceNumber}`)}
<body>
  <div class="pdf-root">
    ${companyHeader(company, 'Invoice', statusBadge(invoice.status || 'Draft'))}

    <div class="meta-grid">
      <div class="label">Invoice #</div><div class="value">${escapeHtml(invoice.invoiceNumber)}</div>
      <div class="label">Issue date</div><div class="value">${formatDate(invoice.invoiceDate)}</div>
      <div class="label">Due date</div><div class="value">${formatDate(invoice.dueDate)}</div>
      ${invoice.poNumber ? `<div class="label">PO #</div><div class="value">${escapeHtml(invoice.poNumber)}</div>` : ''}
    </div>

    <div class="parties" style="margin-top:24px;">
      ${partyCard('Bill From', company)}
      ${partyCard('Bill To', client)}
    </div>

    ${lineItemsTable(items, currency)}

    ${totalsBlock(
      {
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        taxBreakdown: invoice.taxBreakdown,
        shipping: invoice.shipping,
        adjustment: invoice.adjustment,
        total,
        amountPaid,
        balanceDue,
      },
      currency,
    )}

    ${notesBlock(invoice.notes, 'Notes')}
    ${notesBlock(terms, 'Terms & Conditions')}
    ${paymentsTable(payments, currency)}

    ${
      invoice.paymentInstructions
        ? `<div class="section"><h3>Payment Instructions</h3><div class="notes">${escapeHtml(invoice.paymentInstructions)}</div></div>`
        : ''
    }

    ${footerLine('Thank you for your business.')}
  </div>
</body>
</html>`;
}
