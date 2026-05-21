/**
 * Shared helpers for PDF HTML templates.
 *
 * Every template returns a self-contained HTML string with inline CSS —
 * Puppeteer's network is disabled, so external stylesheets / fonts will
 * never load. We rely on system font stacks (`Inter` if installed,
 * otherwise -apple-system / Segoe UI / Helvetica).
 */

import { format as dfFormat, isValid as dfIsValid } from 'date-fns';

// ---------------------------------------------------------------------
// Domain shapes — kept loose so each template can pass its own object
// shape without dragging the full Mongo type chain into the PDF layer.
// ---------------------------------------------------------------------

export type PdfMoney = number | string | null | undefined;

export type PdfLineItem = {
  description?: string | null;
  name?: string | null;
  hsnCode?: string | null;
  hsn?: string | null;
  quantity?: number | null;
  qty?: number | null;
  rate?: number | null;
  unitPrice?: number | null;
  total?: number | null;
  amount?: number | null;
};

export type PdfCompany = {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  logoUrl?: string | null;
};

export type PdfClient = {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
};

export type PdfPayment = {
  date?: Date | string | null;
  amount?: number | null;
  mode?: string | null;
  reference?: string | null;
  notes?: string | null;
};

// ---------------------------------------------------------------------
// Escaping & formatting
// ---------------------------------------------------------------------

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitises rich-text HTML for embedding inside a PDF body.
 *
 * Drops script/style/iframe/object/embed/link blocks plus any `on*` /
 * `javascript:` attributes. Allow-listed tags pass through with their
 * inner text preserved; everything else degrades to plain text.
 *
 * This is intentionally conservative — Puppeteer runs the HTML in a
 * real browser so anything dangerous would otherwise execute.
 */
export function sanitiseRichHtml(raw: string | null | undefined): string {
  if (!raw) return '';
  const stripped = String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/on[a-zA-Z]+\s*=\s*"[^"]*"/g, '')
    .replace(/on[a-zA-Z]+\s*=\s*'[^']*'/g, '')
    .replace(/javascript:/gi, '');
  return stripped;
}

export function formatCurrency(
  amount: PdfMoney,
  code: string = 'USD',
  locale: string = 'en-US',
): string {
  const n = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
  if (!Number.isFinite(n)) return `${code} 0.00`;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(n);
  } catch {
    return `${code} ${(n as number).toFixed(2)}`;
  }
}

export function formatDate(
  date: Date | string | null | undefined,
  pattern: string = 'MMM d, yyyy',
): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (!dfIsValid(d)) return '—';
  try {
    return dfFormat(d, pattern);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Returns a safe `<img>` tag or empty string when the URL is invalid.
 * Accepts http(s) URLs and `data:image/*` URIs. Anything else collapses
 * to the fallback (or empty string).
 */
export function safeImg(
  url: string | null | undefined,
  altText: string = '',
  className: string = '',
): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  const ok =
    /^https?:\/\//i.test(trimmed) || /^data:image\/(png|jpe?g|gif|svg\+xml|webp);/i.test(trimmed);
  if (!ok) return '';
  return `<img src="${escapeHtml(trimmed)}" alt="${escapeHtml(altText)}"${
    className ? ` class="${escapeHtml(className)}"` : ''
  } />`;
}

// ---------------------------------------------------------------------
// Head + base CSS
// ---------------------------------------------------------------------

/**
 * Shared print-friendly CSS for every document template.
 *
 * `@page` size matches the puppeteer `format` (A4). Print colors are
 * forced on via `-webkit-print-color-adjust` so badges and table
 * stripes render the same in the PDF as on screen.
 */
export function baseCss(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #18181b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-root { padding: 0; }
    h1, h2, h3, h4 { margin: 0; font-weight: 600; color: #09090b; }
    h1 { font-size: 26px; letter-spacing: -0.01em; }
    h2 { font-size: 18px; }
    h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; }
    p { margin: 0 0 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; text-align: left; vertical-align: top; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .muted { color: #71717a; }
    .small { font-size: 11px; }
    .row { display: flex; gap: 24px; align-items: flex-start; }
    .col { flex: 1 1 0; min-width: 0; }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 2px solid #18181b;
      margin-bottom: 24px;
    }
    .doc-header .logo img { max-height: 56px; max-width: 220px; object-fit: contain; }
    .doc-title {
      font-size: 30px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #18181b;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: max-content max-content;
      gap: 4px 14px;
      font-size: 11px;
      margin-top: 8px;
      color: #52525b;
    }
    .meta-grid .label { color: #71717a; }
    .meta-grid .value { color: #18181b; font-weight: 500; }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    .party-card {
      background: #fafafa;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      padding: 12px 14px;
    }
    .party-card h3 { margin-bottom: 6px; }
    .party-card .name { font-weight: 600; color: #18181b; font-size: 13px; }
    .items-table {
      width: 100%;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .items-table thead th {
      background: #f4f4f5;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #52525b;
      border-bottom: 1px solid #e4e4e7;
    }
    .items-table tbody tr { border-bottom: 1px solid #f4f4f5; }
    .items-table tbody tr:last-child { border-bottom: 0; }
    .items-table tbody td { font-size: 12px; }
    .totals {
      width: 280px;
      margin-left: auto;
      font-size: 12px;
    }
    .totals .row-line {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      color: #52525b;
    }
    .totals .row-line.grand {
      border-top: 2px solid #18181b;
      margin-top: 6px;
      padding-top: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #09090b;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border: 1px solid transparent;
    }
    .badge-success { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
    .badge-danger { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
    .badge-warn { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .badge-muted { background: #f4f4f5; color: #52525b; border-color: #e4e4e7; }
    .badge-info { background: #dbeafe; color: #1e40af; border-color: #bfdbfe; }
    .notes {
      background: #fafafa;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      padding: 12px 14px;
      margin-top: 16px;
      white-space: pre-line;
      font-size: 11px;
      color: #52525b;
    }
    .section { margin-top: 24px; }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 40px;
    }
    .signature-box {
      border-top: 1px solid #18181b;
      padding-top: 6px;
      min-height: 80px;
      position: relative;
    }
    .signature-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; }
    .signature-box img { max-height: 60px; max-width: 220px; margin-bottom: 6px; }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e4e4e7;
      font-size: 10px;
      color: #71717a;
      text-align: center;
    }
    .rich-body { font-size: 12px; color: #27272a; }
    .rich-body p { margin: 0 0 8px; }
    .rich-body ul, .rich-body ol { padding-left: 18px; margin: 0 0 8px; }
    .rich-body h1, .rich-body h2, .rich-body h3 { margin: 12px 0 6px; }
  `;
}

export function htmlHead(title: string, extraCss: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${baseCss()}${extraCss}</style>
</head>`;
}

export function statusBadge(status: string): string {
  const s = (status || '').toLowerCase();
  let cls = 'badge-muted';
  if (['paid', 'accepted', 'signed', 'completed'].includes(s)) cls = 'badge-success';
  else if (['unpaid', 'overdue', 'declined', 'cancelled'].includes(s)) cls = 'badge-danger';
  else if (['partial', 'partially paid', 'pending', 'pending-confirmation', 'waiting'].includes(s))
    cls = 'badge-warn';
  else if (['sent', 'draft'].includes(s)) cls = 'badge-info';
  return `<span class="badge ${cls}">${escapeHtml(status || 'Unknown')}</span>`;
}

// ---------------------------------------------------------------------
// Re-usable layout fragments
// ---------------------------------------------------------------------

export function companyHeader(company: PdfCompany, title: string, badgeHtml?: string): string {
  const logo = safeImg(company.logoUrl, company.name || 'Logo');
  return `
    <header class="doc-header">
      <div class="logo">
        ${logo}
        <div style="margin-top: ${logo ? '8px' : '0'}; font-weight:600; font-size:14px;">${escapeHtml(company.name || '')}</div>
        ${company.address ? `<div class="small muted" style="white-space:pre-line;">${escapeHtml(company.address)}</div>` : ''}
        ${company.email ? `<div class="small muted">${escapeHtml(company.email)}</div>` : ''}
        ${company.phone ? `<div class="small muted">${escapeHtml(company.phone)}</div>` : ''}
        ${company.taxId ? `<div class="small muted">Tax ID: ${escapeHtml(company.taxId)}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div class="doc-title">${escapeHtml(title)}</div>
        ${badgeHtml ? `<div style="margin-top:10px;">${badgeHtml}</div>` : ''}
      </div>
    </header>
  `;
}

export function partyCard(heading: string, party: PdfClient | PdfCompany): string {
  return `
    <div class="party-card">
      <h3>${escapeHtml(heading)}</h3>
      ${party.name ? `<div class="name">${escapeHtml(party.name)}</div>` : ''}
      ${party.address ? `<div class="small muted" style="white-space:pre-line;">${escapeHtml(party.address)}</div>` : ''}
      ${party.email ? `<div class="small muted">${escapeHtml(party.email)}</div>` : ''}
      ${'phone' in party && party.phone ? `<div class="small muted">${escapeHtml(party.phone)}</div>` : ''}
      ${'taxId' in party && party.taxId ? `<div class="small muted">Tax ID: ${escapeHtml(party.taxId)}</div>` : ''}
    </div>
  `;
}

/** Coerces possibly-string numeric fields to a finite number (defaulting to 0). */
export function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function lineItemsTable(
  items: PdfLineItem[],
  currency: string,
  options?: { showHsn?: boolean; showRowNum?: boolean },
): string {
  const showHsn = options?.showHsn ?? true;
  const showRowNum = options?.showRowNum ?? true;
  const cols: string[] = [];
  if (showRowNum) cols.push('<th style="width:32px;">#</th>');
  cols.push('<th>Description</th>');
  if (showHsn) cols.push('<th style="width:80px;">HSN/SAC</th>');
  cols.push('<th class="text-right" style="width:60px;">Qty</th>');
  cols.push('<th class="text-right" style="width:90px;">Unit Price</th>');
  cols.push('<th class="text-right" style="width:100px;">Amount</th>');

  const rows = items.length
    ? items
        .map((li, idx) => {
          const qty = num(li.quantity ?? li.qty);
          const rate = num(li.rate ?? li.unitPrice);
          const total = li.total != null || li.amount != null ? num(li.total ?? li.amount) : qty * rate;
          const desc = (li.description ?? li.name ?? '') as string;
          const name = (li.name ?? '') as string;
          const cellName = name && name !== desc ? `<div style="font-weight:600;">${escapeHtml(name)}</div>` : '';
          const cellDesc = desc ? `<div class="small muted">${escapeHtml(desc)}</div>` : '';
          const cells: string[] = [];
          if (showRowNum) cells.push(`<td class="muted small">${idx + 1}</td>`);
          cells.push(`<td>${cellName}${cellDesc || (cellName ? '' : '<span class="muted">—</span>')}</td>`);
          if (showHsn) cells.push(`<td class="small muted">${escapeHtml(li.hsnCode || li.hsn || '')}</td>`);
          cells.push(`<td class="text-right">${escapeHtml(qty)}</td>`);
          cells.push(`<td class="text-right">${formatCurrency(rate, currency)}</td>`);
          cells.push(`<td class="text-right">${formatCurrency(total, currency)}</td>`);
          return `<tr>${cells.join('')}</tr>`;
        })
        .join('')
    : `<tr><td colspan="${cols.length}" class="text-center muted" style="padding:20px;">No line items.</td></tr>`;

  return `
    <table class="items-table">
      <thead><tr>${cols.join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export type Totals = {
  subtotal?: PdfMoney;
  discount?: PdfMoney;
  tax?: PdfMoney;
  taxBreakdown?: Array<{ label: string; amount: PdfMoney }>;
  shipping?: PdfMoney;
  adjustment?: PdfMoney;
  total: PdfMoney;
  amountPaid?: PdfMoney;
  balanceDue?: PdfMoney;
  grandLabel?: string;
};

export function totalsBlock(totals: Totals, currency: string): string {
  const lines: string[] = [];
  if (totals.subtotal != null) {
    lines.push(
      `<div class="row-line"><span>Subtotal</span><span>${formatCurrency(totals.subtotal, currency)}</span></div>`,
    );
  }
  if (totals.discount != null && num(totals.discount) > 0) {
    lines.push(
      `<div class="row-line"><span>Discount</span><span>-${formatCurrency(totals.discount, currency)}</span></div>`,
    );
  }
  if (totals.taxBreakdown && totals.taxBreakdown.length > 0) {
    for (const t of totals.taxBreakdown) {
      lines.push(
        `<div class="row-line"><span>${escapeHtml(t.label)}</span><span>${formatCurrency(t.amount, currency)}</span></div>`,
      );
    }
  } else if (totals.tax != null && num(totals.tax) > 0) {
    lines.push(
      `<div class="row-line"><span>Tax</span><span>${formatCurrency(totals.tax, currency)}</span></div>`,
    );
  }
  if (totals.shipping != null && num(totals.shipping) > 0) {
    lines.push(
      `<div class="row-line"><span>Shipping</span><span>${formatCurrency(totals.shipping, currency)}</span></div>`,
    );
  }
  if (totals.adjustment != null && num(totals.adjustment) !== 0) {
    lines.push(
      `<div class="row-line"><span>Adjustment</span><span>${formatCurrency(totals.adjustment, currency)}</span></div>`,
    );
  }
  lines.push(
    `<div class="row-line grand"><span>${escapeHtml(totals.grandLabel || 'Total')}</span><span>${formatCurrency(totals.total, currency)}</span></div>`,
  );
  if (totals.amountPaid != null && num(totals.amountPaid) > 0) {
    lines.push(
      `<div class="row-line"><span>Amount Paid</span><span>${formatCurrency(totals.amountPaid, currency)}</span></div>`,
    );
  }
  if (totals.balanceDue != null) {
    lines.push(
      `<div class="row-line" style="font-weight:600;color:#18181b;"><span>Balance Due</span><span>${formatCurrency(totals.balanceDue, currency)}</span></div>`,
    );
  }
  return `<div class="totals">${lines.join('')}</div>`;
}

export function notesBlock(notes: string | null | undefined, heading: string = 'Notes'): string {
  if (!notes) return '';
  return `
    <div class="section">
      <h3>${escapeHtml(heading)}</h3>
      <div class="notes">${escapeHtml(notes)}</div>
    </div>
  `;
}

export function paymentsTable(payments: PdfPayment[], currency: string): string {
  if (!payments || payments.length === 0) return '';
  const rows = payments
    .map((p) => {
      return `<tr>
        <td>${formatDate(p.date)}</td>
        <td>${escapeHtml(p.mode || '—')}</td>
        <td>${escapeHtml(p.reference || '—')}</td>
        <td class="text-right">${formatCurrency(p.amount, currency)}</td>
      </tr>`;
    })
    .join('');
  return `
    <div class="section">
      <h3>Payment History</h3>
      <table class="items-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Method</th>
            <th>Reference</th>
            <th class="text-right" style="width:120px;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function signatureRow(
  left: { label: string; name?: string | null; signatureDataUrl?: string | null; signedAt?: Date | string | null } | null,
  right: { label: string; name?: string | null; signatureDataUrl?: string | null; signedAt?: Date | string | null } | null,
): string {
  const cell = (
    side: { label: string; name?: string | null; signatureDataUrl?: string | null; signedAt?: Date | string | null } | null,
  ): string => {
    if (!side) return '<div></div>';
    const sigImg = safeImg(side.signatureDataUrl, 'Signature');
    return `
      <div class="signature-box">
        ${sigImg}
        <div class="label">${escapeHtml(side.label)}</div>
        ${side.name ? `<div style="font-weight:600;margin-top:2px;">${escapeHtml(side.name)}</div>` : ''}
        ${side.signedAt ? `<div class="small muted">Signed ${formatDate(side.signedAt)}</div>` : ''}
      </div>
    `;
  };
  return `<div class="signature-grid">${cell(left)}${cell(right)}</div>`;
}

export function footerLine(text: string = 'Thank you for your business.'): string {
  return `<div class="footer">${escapeHtml(text)}</div>`;
}
