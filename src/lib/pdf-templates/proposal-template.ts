/**
 * Proposal HTML template.
 *
 * Similar to the estimate, but features a rich-text description block,
 * a separate note section, and signature lines for both client and
 * preparer.
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
  sanitiseRichHtml,
  signatureRow,
  statusBadge,
  totalsBlock,
  type PdfClient,
  type PdfCompany,
  type PdfLineItem,
} from './_shared';

export type ProposalTemplateInput = {
  proposalNumber?: string | null;
  title?: string | null;
  proposalDate?: Date | string | null;
  validTill?: Date | string | null;
  currency?: string | null;
  status?: string | null;
  description?: string | null;
  note?: string | null;
  subtotal?: number | null;
  discount?: number | null;
  tax?: number | null;
  total: number;
  signed?: boolean;
  signature?: {
    signedByName?: string | null;
    signedAt?: Date | string | null;
    signatureDataUrl?: string | null;
  } | null;
};

export type ProposalDealHint = {
  name?: string | null;
  company?: string | null;
};

export function renderProposalHtml(
  proposal: ProposalTemplateInput,
  company: PdfCompany,
  items: PdfLineItem[],
  deal: (PdfClient & ProposalDealHint) | null,
): string {
  const currency = proposal.currency || 'USD';
  const heading = proposal.title || `Proposal ${proposal.proposalNumber || ''}`.trim();

  const recipient: PdfClient = deal
    ? {
        name: deal.name || deal.company || '',
        email: deal.email,
        address: deal.address,
        phone: deal.phone,
      }
    : {};

  const showSignature = proposal.signed || proposal.signature?.signatureDataUrl;

  return `${htmlHead(heading)}
<body>
  <div class="pdf-root">
    ${companyHeader(company, 'Proposal', statusBadge(proposal.status || 'Waiting'))}

    <div class="meta-grid">
      ${proposal.proposalNumber ? `<div class="label">Proposal #</div><div class="value">${escapeHtml(proposal.proposalNumber)}</div>` : ''}
      ${proposal.title ? `<div class="label">Title</div><div class="value">${escapeHtml(proposal.title)}</div>` : ''}
      <div class="label">Issue date</div><div class="value">${formatDate(proposal.proposalDate)}</div>
      <div class="label">Valid until</div><div class="value">${formatDate(proposal.validTill)}</div>
    </div>

    <div class="parties" style="margin-top:24px;">
      ${partyCard('From', company)}
      ${partyCard('Prepared For', recipient)}
    </div>

    ${
      proposal.description
        ? `<div class="section"><h3>Description</h3><div class="rich-body">${sanitiseRichHtml(proposal.description)}</div></div>`
        : ''
    }

    ${items.length > 0 ? lineItemsTable(items, currency) : ''}

    ${
      items.length > 0
        ? totalsBlock(
            {
              subtotal: proposal.subtotal,
              discount: proposal.discount,
              tax: proposal.tax,
              total: num(proposal.total),
            },
            currency,
          )
        : ''
    }

    ${notesBlock(proposal.note, 'Note')}

    ${
      showSignature
        ? signatureRow(null, {
            label: 'Accepted by',
            name: proposal.signature?.signedByName,
            signatureDataUrl: proposal.signature?.signatureDataUrl,
            signedAt: proposal.signature?.signedAt,
          })
        : signatureRow(null, { label: 'Client signature' })
    }

    ${footerLine('We appreciate the opportunity to submit this proposal.')}
  </div>
</body>
</html>`;
}
