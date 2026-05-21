/**
 * Estimate HTML template.
 *
 * Mirrors the invoice layout but with an "ESTIMATE" header, a
 * "Valid Until" date, and a signature box at the bottom (filled in
 * when `signature` is supplied).
 */

import {
  companyHeader,
  escapeHtml,
  footerLine,
  formatDate,
  htmlHead,
  lineItemsTable,
  notesBlock,
  num,
  partyCard,
  signatureRow,
  statusBadge,
  totalsBlock,
  type PdfClient,
  type PdfCompany,
  type PdfLineItem,
} from './_shared';

export type EstimateTemplateInput = {
  estimateNumber: string;
  estimateDate?: Date | string | null;
  validTill?: Date | string | null;
  currency?: string | null;
  status?: string | null;
  subtotal?: number | null;
  discount?: number | null;
  tax?: number | null;
  taxBreakdown?: Array<{ label: string; amount: number }>;
  total: number;
  notes?: string | null;
  termsAndConditions?: string[] | string | null;
  signed?: boolean;
  signature?: {
    signedByName?: string | null;
    signedAt?: Date | string | null;
    signatureDataUrl?: string | null;
  } | null;
};

export function renderEstimateHtml(
  estimate: EstimateTemplateInput,
  company: PdfCompany,
  items: PdfLineItem[],
  client: PdfClient,
): string {
  const currency = estimate.currency || 'USD';

  const terms = Array.isArray(estimate.termsAndConditions)
    ? estimate.termsAndConditions.filter(Boolean).join('\n')
    : estimate.termsAndConditions || '';

  const showSignature = estimate.signed || estimate.signature?.signatureDataUrl;

  return `${htmlHead(`Estimate ${estimate.estimateNumber}`)}
<body>
  <div class="pdf-root">
    ${companyHeader(company, 'Estimate', statusBadge(estimate.status || 'Waiting'))}

    <div class="meta-grid">
      <div class="label">Estimate #</div><div class="value">${escapeHtml(estimate.estimateNumber)}</div>
      <div class="label">Issue date</div><div class="value">${formatDate(estimate.estimateDate)}</div>
      <div class="label">Valid until</div><div class="value">${formatDate(estimate.validTill)}</div>
    </div>

    <div class="parties" style="margin-top:24px;">
      ${partyCard('From', company)}
      ${partyCard('Prepared For', client)}
    </div>

    ${lineItemsTable(items, currency)}

    ${totalsBlock(
      {
        subtotal: estimate.subtotal,
        discount: estimate.discount,
        tax: estimate.tax,
        taxBreakdown: estimate.taxBreakdown,
        total: num(estimate.total),
      },
      currency,
    )}

    ${notesBlock(estimate.notes, 'Notes')}
    ${notesBlock(terms, 'Terms & Conditions')}

    ${
      showSignature
        ? signatureRow(null, {
            label: 'Accepted by',
            name: estimate.signature?.signedByName,
            signatureDataUrl: estimate.signature?.signatureDataUrl,
            signedAt: estimate.signature?.signedAt,
          })
        : signatureRow(null, { label: 'Client signature' })
    }

    ${footerLine('This estimate is valid until the date shown above.')}
  </div>
</body>
</html>`;
}
