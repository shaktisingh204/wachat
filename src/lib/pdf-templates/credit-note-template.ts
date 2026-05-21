/**
 * Credit Note HTML template.
 *
 * Mirrors the invoice layout but with red/amber accents, an "ADJUSTMENT
 * AMOUNT" total, and a reference to the original invoice when one is
 * provided.
 */

import {
  companyHeader,
  escapeHtml,
  footerLine,
  formatCurrency,
  formatDate,
  htmlHead,
  lineItemsTable,
  notesBlock,
  num,
  partyCard,
  totalsBlock,
  type PdfClient,
  type PdfCompany,
  type PdfLineItem,
} from './_shared';

export type CreditNoteTemplateInput = {
  creditNoteNumber: string;
  creditNoteDate?: Date | string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  total: number;
  reason?: string | null;
  notes?: string | null;
};

export type OriginalInvoiceRef = {
  invoiceNumber?: string | null;
  invoiceDate?: Date | string | null;
  total?: number | null;
} | null;

const RED_BADGE = '<span class="badge badge-danger">Credit Note</span>';

export function renderCreditNoteHtml(
  creditNote: CreditNoteTemplateInput,
  company: PdfCompany,
  items: PdfLineItem[],
  client: PdfClient,
  originalInvoice: OriginalInvoiceRef = null,
): string {
  const currency = creditNote.currency || 'USD';

  return `${htmlHead(`Credit Note ${creditNote.creditNoteNumber}`, `
    .doc-title { color: #b91c1c; }
    .doc-header { border-bottom-color: #b91c1c; }
    .totals .row-line.grand { color: #b91c1c; border-top-color: #b91c1c; }
  `)}
<body>
  <div class="pdf-root">
    ${companyHeader(company, 'Credit Note', RED_BADGE)}

    <div class="meta-grid">
      <div class="label">Credit note #</div><div class="value">${escapeHtml(creditNote.creditNoteNumber)}</div>
      <div class="label">Date</div><div class="value">${formatDate(creditNote.creditNoteDate)}</div>
      ${
        originalInvoice?.invoiceNumber
          ? `<div class="label">Against invoice</div><div class="value">${escapeHtml(originalInvoice.invoiceNumber)}${
              originalInvoice.invoiceDate ? ` (${formatDate(originalInvoice.invoiceDate)})` : ''
            }</div>`
          : ''
      }
      ${
        originalInvoice?.total != null
          ? `<div class="label">Original invoice total</div><div class="value">${formatCurrency(num(originalInvoice.total), currency)}</div>`
          : ''
      }
      ${creditNote.reason ? `<div class="label">Reason</div><div class="value">${escapeHtml(creditNote.reason)}</div>` : ''}
    </div>

    <div class="parties" style="margin-top:24px;">
      ${partyCard('Issued By', company)}
      ${partyCard('Issued To', client)}
    </div>

    ${lineItemsTable(items, currency)}

    ${totalsBlock(
      {
        subtotal: creditNote.subtotal,
        discount: creditNote.discount,
        tax: creditNote.tax,
        total: num(creditNote.total),
        grandLabel: 'Adjustment Amount',
      },
      currency,
    )}

    ${notesBlock(creditNote.notes, 'Notes')}

    ${footerLine('This credit can be applied against future invoices.')}
  </div>
</body>
</html>`;
}
