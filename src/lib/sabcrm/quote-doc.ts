/**
 * SabCRM CPQ — quote document rendering + e-signature token helpers (PURE).
 *
 * The structural twin of `./scoring.ts` and `./quote-doc.server.ts`: a
 * `'server-only'`- and I/O-free module so the unit tests (`tsx --test`) AND
 * the `'use client'` share page can import the types + the deterministic
 * rendering / HMAC helpers directly. All Mongo / SabPay / Rust side effects
 * live in `./quote-doc.server.ts`, which re-exports the types here.
 *
 * ## What lives here
 *
 *  - {@link renderQuoteHtml} — a print-ready (`@media print` friendly) HTML
 *    document string for a quote + brand. No I/O; the caller supplies the
 *    already-fetched quote + brand.
 *  - {@link signaturePayload} / {@link verifySignatureToken} — an HMAC-SHA256
 *    signing scheme (Node `crypto`, no deps) used to mint and verify the
 *    opaque public share token. The token binds `{ projectId, quoteId,
 *    shareId }` so a leaked token cannot be replayed against another quote,
 *    and the server can resolve a token to a share row WITHOUT a DB lookup
 *    on the happy path (it still re-validates against the stored row).
 *
 * The HMAC secret is resolved by the SERVER module (env), never here — the
 * pure helpers take the secret as an argument so they stay testable and
 * never touch `process.env`.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/* -------------------------------------------------------------------------- */
/* Shared shapes                                                              */
/* -------------------------------------------------------------------------- */

/** One rendered line on the quote document (already money-resolved). */
export interface QuoteDocLine {
  description: string;
  hsnSac?: string;
  qty: number;
  unit?: string;
  rate: number;
  discountPct?: number;
  taxRatePct?: number;
  /** `qty × rate − discount + tax` — the wire line total. */
  total: number;
}

/** Document-level totals shown in the footer. */
export interface QuoteDocTotals {
  subTotal: number;
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  /** The final payable amount. */
  total: number;
}

/** The minimal, render-ready view of a quotation (decoupled from the wire). */
export interface QuoteDocView {
  quoteId: string;
  quotationNo: string;
  /** ISO date string. */
  date: string;
  /** ISO date string. */
  validUntil: string;
  currency: string;
  subject?: string;
  clientName?: string;
  clientEmail?: string;
  billingAddress?: string;
  lines: QuoteDocLine[];
  totals: QuoteDocTotals;
  termsAndConditions?: string;
  customerNotes?: string;
  /** Set once accepted (ISO) — drives the "accepted" stamp on the doc. */
  acceptedAt?: string;
  acceptedBy?: string;
  /** A base64 PNG data URL of the captured signature, once signed. */
  signatureDataUrl?: string;
}

/** Brand chrome for the document header/footer. */
export interface QuoteDocBrand {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  /** Hex accent, e.g. `#4f46e5`. Defaults to a neutral indigo. */
  accentColor?: string | null;
  email?: string | null;
  phone?: string | null;
}

/** The token-bound claims (what the HMAC protects). */
export interface SignatureClaims {
  projectId: string;
  quoteId: string;
  /** The `sabcrm_quote_shares` row id this token addresses. */
  shareId: string;
}

/* -------------------------------------------------------------------------- */
/* HTML escaping + money                                                      */
/* -------------------------------------------------------------------------- */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a string for safe interpolation into HTML text / attribute. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/** Format a number as money for the given ISO currency code. */
export function formatMoney(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const code = (currency || 'INR').toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? '';
  const fixed = n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${fixed}` : `${fixed} ${code}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return escapeHtml(iso);
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* -------------------------------------------------------------------------- */
/* renderQuoteHtml                                                            */
/* -------------------------------------------------------------------------- */

function renderLineRow(line: QuoteDocLine, currency: string): string {
  const parts = [
    `<td class="qd-desc">${escapeHtml(line.description || '—')}${
      line.hsnSac ? `<span class="qd-hsn">HSN/SAC: ${escapeHtml(line.hsnSac)}</span>` : ''
    }</td>`,
    `<td class="qd-num">${escapeHtml(line.qty)}${line.unit ? ` ${escapeHtml(line.unit)}` : ''}</td>`,
    `<td class="qd-num">${formatMoney(line.rate, currency)}</td>`,
    `<td class="qd-num">${line.discountPct ? `${escapeHtml(line.discountPct)}%` : '—'}</td>`,
    `<td class="qd-num">${line.taxRatePct ? `${escapeHtml(line.taxRatePct)}%` : '—'}</td>`,
    `<td class="qd-num qd-total">${formatMoney(line.total, currency)}</td>`,
  ];
  return `<tr>${parts.join('')}</tr>`;
}

function renderTotalsRows(totals: QuoteDocTotals, currency: string): string {
  const rows: Array<[string, number]> = [['Subtotal', totals.subTotal]];
  if (totals.discountOverall) rows.push(['Discount', -totals.discountOverall]);
  if (totals.shippingCharge) rows.push(['Shipping', totals.shippingCharge]);
  if (totals.adjustment) rows.push(['Adjustment', totals.adjustment]);
  if (totals.roundOff) rows.push(['Round off', totals.roundOff]);
  const minor = rows
    .map(
      ([label, val]) =>
        `<tr><td>${escapeHtml(label)}</td><td class="qd-num">${formatMoney(val, currency)}</td></tr>`,
    )
    .join('');
  return `${minor}<tr class="qd-grand"><td>Total</td><td class="qd-num">${formatMoney(
    totals.total,
    currency,
  )}</td></tr>`;
}

/**
 * Render a print-ready HTML document for a quote. Pure: no I/O, no
 * `process.env`, deterministic for a given `(quote, brand)`. The output is a
 * complete `<!doctype html>` document with inline `<style>` (so it prints
 * stand-alone and embeds in the share page via a sandboxed container).
 */
export function renderQuoteHtml(quote: QuoteDocView, brand: QuoteDocBrand): string {
  const accent = (brand.accentColor && /^#[0-9a-fA-F]{6}$/.test(brand.accentColor))
    ? brand.accentColor
    : '#4f46e5';
  const currency = quote.currency || 'INR';

  const acceptedStamp = quote.acceptedAt
    ? `<div class="qd-stamp">ACCEPTED · ${formatDate(quote.acceptedAt)}${
        quote.acceptedBy ? ` · ${escapeHtml(quote.acceptedBy)}` : ''
      }</div>`
    : '';

  const signatureBlock = quote.signatureDataUrl
    ? `<div class="qd-sign">
         <div class="qd-sign-label">Authorized signature</div>
         <img class="qd-sign-img" src="${escapeHtml(quote.signatureDataUrl)}" alt="Signature of ${escapeHtml(
           quote.acceptedBy || quote.clientName || 'signer',
         )}" />
         <div class="qd-sign-meta">${escapeHtml(quote.acceptedBy || quote.clientName || '')}${
        quote.acceptedAt ? ` · ${formatDate(quote.acceptedAt)}` : ''
      }</div>
       </div>`
    : '';

  const logo = brand.logoUrl
    ? `<img class="qd-logo" src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)} logo" />`
    : `<div class="qd-logo qd-logo-fallback">${escapeHtml((brand.name || 'S').slice(0, 1).toUpperCase())}</div>`;

  const linesHtml = quote.lines.length
    ? quote.lines.map((l) => renderLineRow(l, currency)).join('')
    : `<tr><td colspan="6" class="qd-empty">No line items.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Quote ${escapeHtml(quote.quotationNo)}</title>
<style>
  :root { --qd-accent: ${accent}; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1f2430;
    background: #f4f5f7;
    -webkit-font-smoothing: antialiased;
  }
  .qd-doc {
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
    padding: 40px 44px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .qd-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .qd-brand { display: flex; gap: 14px; align-items: center; }
  .qd-logo { width: 48px; height: 48px; border-radius: 8px; object-fit: contain; }
  .qd-logo-fallback {
    display: grid; place-items: center; background: var(--qd-accent);
    color: #fff; font-weight: 700; font-size: 20px;
  }
  .qd-brand-name { font-size: 18px; font-weight: 700; }
  .qd-brand-meta { font-size: 12px; color: #6b7280; line-height: 1.5; }
  .qd-titlebox { text-align: right; }
  .qd-title { font-size: 26px; font-weight: 700; color: var(--qd-accent); letter-spacing: 0.5px; }
  .qd-no { font-size: 13px; color: #6b7280; margin-top: 2px; }
  .qd-meta-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    margin: 28px 0; padding: 18px 0; border-top: 1px solid #eceef2; border-bottom: 1px solid #eceef2;
  }
  .qd-meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #9aa1ad; margin-bottom: 4px; }
  .qd-meta-value { font-size: 13px; line-height: 1.5; }
  .qd-subject { font-size: 15px; font-weight: 600; margin: 8px 0 20px; }
  table.qd-items { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.qd-items thead th {
    text-align: left; padding: 10px 8px; background: #f7f8fa; color: #5b6373;
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e6e8ec;
  }
  table.qd-items td { padding: 11px 8px; border-bottom: 1px solid #f0f1f4; vertical-align: top; }
  .qd-num { text-align: right; white-space: nowrap; }
  .qd-total { font-weight: 600; }
  .qd-desc { font-weight: 500; }
  .qd-hsn { display: block; font-size: 11px; color: #9aa1ad; font-weight: 400; margin-top: 2px; }
  .qd-empty { text-align: center; color: #9aa1ad; padding: 24px; }
  .qd-totals { width: 280px; margin-left: auto; margin-top: 18px; font-size: 13px; }
  .qd-totals table { width: 100%; border-collapse: collapse; }
  .qd-totals td { padding: 6px 4px; }
  .qd-totals .qd-grand td {
    border-top: 2px solid var(--qd-accent); font-weight: 700; font-size: 15px; padding-top: 10px;
  }
  .qd-section { margin-top: 28px; }
  .qd-section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; color: #9aa1ad; margin: 0 0 6px; }
  .qd-section p { font-size: 12px; color: #4b5563; line-height: 1.6; white-space: pre-wrap; margin: 0; }
  .qd-stamp {
    display: inline-block; margin-top: 8px; padding: 4px 12px; border: 2px solid #16a34a;
    color: #16a34a; border-radius: 6px; font-size: 12px; font-weight: 700; letter-spacing: 1px; transform: rotate(-3deg);
  }
  .qd-sign { margin-top: 32px; padding-top: 18px; border-top: 1px solid #eceef2; }
  .qd-sign-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #9aa1ad; margin-bottom: 6px; }
  .qd-sign-img { height: 72px; max-width: 280px; object-fit: contain; }
  .qd-sign-meta { font-size: 12px; color: #4b5563; margin-top: 4px; }
  .qd-foot { margin-top: 36px; padding-top: 16px; border-top: 1px solid #eceef2; font-size: 11px; color: #9aa1ad; text-align: center; }
  @media print {
    body { background: #fff; }
    .qd-doc { box-shadow: none; border-radius: 0; max-width: none; padding: 0; }
    @page { margin: 18mm; }
  }
</style>
</head>
<body>
  <div class="qd-doc">
    <div class="qd-head">
      <div class="qd-brand">
        ${logo}
        <div>
          <div class="qd-brand-name">${escapeHtml(brand.name)}</div>
          <div class="qd-brand-meta">${[brand.address, brand.email, brand.phone]
            .filter(Boolean)
            .map((v) => escapeHtml(v))
            .join('<br/>')}</div>
        </div>
      </div>
      <div class="qd-titlebox">
        <div class="qd-title">QUOTE</div>
        <div class="qd-no">${escapeHtml(quote.quotationNo)}</div>
        ${acceptedStamp}
      </div>
    </div>

    <div class="qd-meta-grid">
      <div>
        <div class="qd-meta-label">Billed to</div>
        <div class="qd-meta-value">${escapeHtml(quote.clientName || '—')}${
          quote.clientEmail ? `<br/>${escapeHtml(quote.clientEmail)}` : ''
        }${quote.billingAddress ? `<br/>${escapeHtml(quote.billingAddress)}` : ''}</div>
      </div>
      <div>
        <div class="qd-meta-label">Quote date</div>
        <div class="qd-meta-value">${formatDate(quote.date)}</div>
        <div class="qd-meta-label" style="margin-top:10px">Valid until</div>
        <div class="qd-meta-value">${formatDate(quote.validUntil)}</div>
      </div>
    </div>

    ${quote.subject ? `<div class="qd-subject">${escapeHtml(quote.subject)}</div>` : ''}

    <table class="qd-items">
      <thead>
        <tr>
          <th>Description</th><th class="qd-num">Qty</th><th class="qd-num">Rate</th>
          <th class="qd-num">Disc</th><th class="qd-num">Tax</th><th class="qd-num">Amount</th>
        </tr>
      </thead>
      <tbody>${linesHtml}</tbody>
    </table>

    <div class="qd-totals"><table>${renderTotalsRows(quote.totals, currency)}</table></div>

    ${
      quote.termsAndConditions
        ? `<div class="qd-section"><h3>Terms &amp; conditions</h3><p>${escapeHtml(quote.termsAndConditions)}</p></div>`
        : ''
    }
    ${
      quote.customerNotes
        ? `<div class="qd-section"><h3>Notes</h3><p>${escapeHtml(quote.customerNotes)}</p></div>`
        : ''
    }

    ${signatureBlock}

    <div class="qd-foot">Generated by ${escapeHtml(brand.name)} · Powered by SabNode</div>
  </div>
</body>
</html>`;
}

/* -------------------------------------------------------------------------- */
/* Signature / share token (HMAC-SHA256)                                      */
/* -------------------------------------------------------------------------- */

/** Base64url-encode a buffer/string (RFC 4648 §5, no padding). */
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function hmac(secret: string, data: string): string {
  return b64url(createHmac('sha256', secret).update(data).digest());
}

/**
 * Mint an opaque public token binding the given claims. Format:
 * `<base64url(json)>.<base64url(hmac)>`. The token carries the share id so
 * the server can resolve it directly (and STILL re-validate against the row),
 * and is HMAC-signed so it cannot be forged or repointed.
 *
 * @throws when the secret is empty (signing must never be silently disabled).
 */
export function signaturePayload(claims: SignatureClaims, secret: string): string {
  if (!secret) throw new Error('A signing secret is required to mint a share token.');
  if (!claims.projectId || !claims.quoteId || !claims.shareId) {
    throw new Error('projectId, quoteId and shareId are all required.');
  }
  const body = b64url(JSON.stringify(claims));
  return `${body}.${hmac(secret, body)}`;
}

/**
 * Verify a token's HMAC (constant-time) and return its claims, or `null` when
 * the token is malformed, the signature is invalid, or the secret is empty.
 * Never throws — callers treat `null` as "reject".
 */
export function verifySignatureToken(
  token: string,
  secret: string,
): SignatureClaims | null {
  if (!token || !secret) return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = hmac(secret, body);
  // Constant-time compare; bail if lengths differ (timingSafeEqual throws).
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(b64urlDecode(body).toString('utf8')) as SignatureClaims;
    if (
      parsed &&
      typeof parsed.projectId === 'string' &&
      typeof parsed.quoteId === 'string' &&
      typeof parsed.shareId === 'string' &&
      parsed.projectId &&
      parsed.quoteId &&
      parsed.shareId
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
