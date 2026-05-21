/**
 * Contract HTML template.
 *
 * Layout: centered title, contract metadata card, sanitised body, then
 * a two-column signature area (company on the left, client on the right).
 */

import {
  companyHeader,
  escapeHtml,
  footerLine,
  formatCurrency,
  formatDate,
  htmlHead,
  num,
  sanitiseRichHtml,
  signatureRow,
  statusBadge,
  type PdfClient,
  type PdfCompany,
} from './_shared';

export type ContractTemplateInput = {
  contractName: string;
  contractNumber?: string | null;
  contractDate?: Date | string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  amount?: number | null;
  currency?: string | null;
  partyFirst?: string | null;
  partySecond?: string | null;
  contractDetail?: string | null;
  signed?: boolean;
};

export type ContractSignature = {
  fullName?: string | null;
  signedAt?: Date | string | null;
  signatureDataUrl?: string | null;
  place?: string | null;
} | null;

export function renderContractHtml(
  contract: ContractTemplateInput,
  company: PdfCompany,
  client: PdfClient,
  signature?: { company?: ContractSignature; client?: ContractSignature },
): string {
  const currency = contract.currency || 'USD';

  return `${htmlHead(contract.contractName || 'Contract')}
<body>
  <div class="pdf-root">
    ${companyHeader(company, 'Contract', statusBadge(contract.signed ? 'Signed' : 'Pending'))}

    <div class="section" style="text-align:center; margin-top:8px; margin-bottom:20px;">
      <h1 style="font-size:22px; text-transform:none; letter-spacing:0;">
        ${escapeHtml(contract.contractName || 'Contract')}
      </h1>
      ${contract.contractNumber ? `<div class="muted small" style="margin-top:4px;">Contract #${escapeHtml(contract.contractNumber)}</div>` : ''}
    </div>

    <div class="party-card" style="background:#fafafa;">
      <div class="row">
        <div class="col">
          <div class="small muted">Date</div>
          <div style="font-weight:600;">${formatDate(contract.contractDate)}</div>
        </div>
        <div class="col">
          <div class="small muted">Effective period</div>
          <div style="font-weight:600;">
            ${formatDate(contract.startDate)} — ${formatDate(contract.endDate)}
          </div>
        </div>
        ${
          contract.amount != null
            ? `<div class="col">
                <div class="small muted">Contract value</div>
                <div style="font-weight:600;">${formatCurrency(num(contract.amount), currency)}</div>
              </div>`
            : ''
        }
      </div>
      <div class="row" style="margin-top:10px;">
        <div class="col">
          <div class="small muted">First party</div>
          <div style="font-weight:600;">${escapeHtml(contract.partyFirst || company.name || '—')}</div>
        </div>
        <div class="col">
          <div class="small muted">Second party</div>
          <div style="font-weight:600;">${escapeHtml(contract.partySecond || client.name || '—')}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="rich-body">${sanitiseRichHtml(contract.contractDetail) || '<p class="muted">No contract body provided.</p>'}</div>
    </div>

    ${signatureRow(
      {
        label: `First party — ${contract.partyFirst || company.name || ''}`.trim(),
        name: signature?.company?.fullName || company.name,
        signatureDataUrl: signature?.company?.signatureDataUrl,
        signedAt: signature?.company?.signedAt,
      },
      {
        label: `Second party — ${contract.partySecond || client.name || ''}`.trim(),
        name: signature?.client?.fullName || client.name,
        signatureDataUrl: signature?.client?.signatureDataUrl,
        signedAt: signature?.client?.signedAt,
      },
    )}

    ${footerLine('This contract is binding upon signature by both parties.')}
  </div>
</body>
</html>`;
}
