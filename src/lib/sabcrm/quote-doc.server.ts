import 'server-only';

/**
 * SabCRM CPQ — quote document + in-house e-signature — SERVER side.
 *
 * The I/O half of `./quote-doc.ts` (re-exported here): Mongo persistence for
 * the public share rows, the e-signature capture, the SabPay payment-link
 * creation on acceptance, and the render-ready view assembly. The HMAC token
 * + HTML render helpers are PURE and live in `./quote-doc.ts`.
 *
 * ## Data model
 *
 *   `sabcrm_quote_shares` — one row per shareable link. Tenant-scoped by the
 *   active SabCRM `projectId`. The opaque public token (HMAC, minted by the
 *   pure helper) binds `{ projectId, quoteId, shareId }`, so a leaked token
 *   cannot be repointed and the server resolves it WITHOUT a scan (it still
 *   re-validates against the stored row + the live quote).
 *
 * ## Reused SabNode engines (IN-HOUSE ONLY)
 *
 *   - The quotation document itself: `sabcrmFinanceQuotationsApi` (the
 *     project-scoped Rust path — `/v1/sabcrm/finance/quotations`). Two-store
 *     gotcha: the quote is a Rust document, NOT a `sabcrm_records` row, so
 *     reads/writes go through the Rust client, never native Mongo.
 *   - Money: `rustClient.sabpay.createPaymentLinkAs(ownerUserId, …)` — the
 *     EXISTING SabPay payment-links API, acting as the project owner. NEVER
 *     a third-party gateway.
 *   - Timeline: `createActivity` (the activities engine).
 *
 * Everything money-side is best-effort: a failed SabPay link never blocks the
 * acceptance (the quote is still marked accepted + signed).
 */

import { ObjectId, type Collection } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { rustClient } from '@/lib/rust-client';
import {
  sabcrmFinanceQuotationsApi,
  type SabcrmQuotationDoc,
} from '@/lib/rust-client/sabcrm-finance';
import { createActivity } from '@/lib/sabcrm/activities.server';
import { computeDocGrandTotals } from '@/lib/sabcrm/finance-doc-math';
import {
  renderQuoteHtml,
  signaturePayload,
  verifySignatureToken,
  type QuoteDocBrand,
  type QuoteDocLine,
  type QuoteDocTotals,
  type QuoteDocView,
} from '@/lib/sabcrm/quote-doc';

export * from '@/lib/sabcrm/quote-doc';

/* -------------------------------------------------------------------------- */
/* Secret resolution                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The HMAC secret for signing/verifying share tokens. Primary env is the
 * dedicated `SABCRM_SIGN_SECRET`; falls back to the shared CRM tracking
 * secret (`SABCRM_TRACK_SECRET`) and then the platform `AUTH_SECRET` /
 * `NEXTAUTH_SECRET` so links still work (signed, just not with a dedicated
 * key) when the dedicated one is unset. Empty string → signing disabled.
 */
export function signSecret(): string {
  return (
    process.env.SABCRM_SIGN_SECRET ||
    process.env.SABCRM_TRACK_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ''
  );
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3002'
  );
}

/* -------------------------------------------------------------------------- */
/* Collection + doc shape                                                     */
/* -------------------------------------------------------------------------- */

const SHARES_COLL = 'sabcrm_quote_shares';

/** A captured signature on an accepted share. */
export interface QuoteShareSignature {
  signerName: string;
  /** base64 PNG data URL. */
  signatureDataUrl: string;
  ip?: string | null;
  userAgent?: string | null;
  signedAt: string;
}

/** Persisted share row (the doc shape minus the Mongo `_id`). */
export interface QuoteShareDoc {
  _id: ObjectId;
  projectId: string;
  quoteId: string;
  quotationNo: string;
  /** Snapshotted at share time so the public view is stable + decoupled. */
  currency: string;
  /** Final payable amount in major units (e.g. rupees). */
  amount: number;
  status: 'open' | 'accepted' | 'revoked';
  /** Set once accepted. */
  signature?: QuoteShareSignature;
  /** SabPay payment-link id + customer pay URL, once created. */
  payLinkId?: string;
  payUrl?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
}

let indexesEnsured = false;

async function sharesCol(): Promise<Collection<QuoteShareDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<QuoteShareDoc>(SHARES_COLL);
  if (!indexesEnsured) {
    await col
      .createIndexes([
        { key: { projectId: 1, quoteId: 1 } },
        { key: { projectId: 1, createdAt: -1 } },
      ])
      .catch(() => undefined);
    indexesEnsured = true;
  }
  return col;
}

/* -------------------------------------------------------------------------- */
/* Quote → render-ready view                                                  */
/* -------------------------------------------------------------------------- */

function toLines(doc: SabcrmQuotationDoc): QuoteDocLine[] {
  return (doc.items ?? []).map((it) => ({
    description: it.description || '',
    hsnSac: it.hsnSac,
    qty: Number(it.qty) || 0,
    unit: it.unit,
    rate: Number(it.rate) || 0,
    discountPct: it.discountPct,
    taxRatePct: it.taxRatePct,
    total: Number(it.total) || 0,
  }));
}

/**
 * Resolve the document totals. Prefer the persisted `totals`; when absent,
 * recompute deterministically from the line items via the shared finance math
 * (the SINGLE source of truth — never trust a missing/zero total silently).
 */
function resolveTotals(doc: SabcrmQuotationDoc): QuoteDocTotals {
  const t = doc.totals;
  if (t && Number.isFinite(t.total) && t.total > 0) {
    return {
      subTotal: t.subTotal ?? 0,
      discountOverall: t.discountOverall,
      shippingCharge: t.shippingCharge,
      adjustment: t.adjustment,
      roundOff: t.roundOff,
      total: t.total,
    };
  }
  const computed = computeDocGrandTotals(
    (doc.items ?? []).map((it) => ({
      itemId: it.itemId,
      description: it.description,
      hsnSac: it.hsnSac,
      qty: Number(it.qty) || 0,
      rate: Number(it.rate) || 0,
      discountPct: it.discountPct,
      taxRatePct: it.taxRatePct,
    })),
  );
  return {
    subTotal: computed.subTotal,
    total: computed.grandTotal,
  };
}

function addressText(a?: SabcrmQuotationDoc['billingAddress']): string | undefined {
  if (!a) return undefined;
  return [a.line1, a.line2, a.city, a.state, a.pincode, a.country]
    .filter((v) => v && String(v).trim())
    .join(', ') || undefined;
}

function toQuoteView(doc: SabcrmQuotationDoc, share: QuoteShareDoc): QuoteDocView {
  return {
    quoteId: doc._id,
    quotationNo: doc.quotationNo,
    date: doc.date,
    validUntil: doc.validUntil,
    currency: doc.currency || share.currency || 'INR',
    subject: doc.subject,
    clientName: undefined, // client display name is resolved server-side below
    billingAddress: addressText(doc.billingAddress),
    lines: toLines(doc),
    totals: resolveTotals(doc),
    termsAndConditions: doc.termsAndConditions,
    customerNotes: doc.customerNotes,
    acceptedAt: share.signature?.signedAt,
    acceptedBy: share.signature?.signerName,
    signatureDataUrl: share.signature?.signatureDataUrl,
  };
}

/* -------------------------------------------------------------------------- */
/* Brand resolution (re-uses the same `companies` source as the share layout) */
/* -------------------------------------------------------------------------- */

async function resolveBrand(projectId: string): Promise<QuoteDocBrand> {
  try {
    const { db } = await connectToDatabase();
    // Tie the brand to the project owner's company when available, else the
    // first company on the tenant (mirrors the public share layout fallback).
    let ownerId: ObjectId | null = null;
    if (ObjectId.isValid(projectId)) {
      const project = await db
        .collection('projects')
        .findOne(
          { _id: new ObjectId(projectId) },
          { projection: { userId: 1, name: 1 } },
        );
      ownerId = (project?.userId as ObjectId | undefined) ?? null;
    }
    const company =
      (ownerId
        ? await db.collection('companies').findOne({ userId: ownerId })
        : null) ||
      (await db.collection('companies').findOne({}, { sort: { createdAt: 1 } }));
    if (!company) return { name: 'SabNode' };
    return {
      name:
        (company.companyName as string) ||
        (company.name as string) ||
        'SabNode',
      logoUrl:
        (company.companyLogo as string) || (company.logo as string) || null,
      address:
        (company.companyAddress as string) ||
        (company.address as string) ||
        null,
      email: (company.companyEmail as string) || (company.email as string) || null,
      phone: (company.companyPhone as string) || (company.phone as string) || null,
      accentColor: (company.brandColor as string) || null,
    };
  } catch {
    return { name: 'SabNode' };
  }
}

/** Best-effort owner userId for SabPay (the project owner is the merchant). */
async function resolveOwnerUserId(projectId: string): Promise<string | null> {
  try {
    if (!ObjectId.isValid(projectId)) return null;
    const { db } = await connectToDatabase();
    const project = await db
      .collection('projects')
      .findOne({ _id: new ObjectId(projectId) }, { projection: { userId: 1 } });
    const uid = project?.userId as ObjectId | string | undefined;
    return uid ? String(uid) : null;
  } catch {
    return null;
  }
}

/** Resolve the client's display name from the CRM record (best-effort). */
async function resolveClientName(
  projectId: string,
  clientId?: string,
): Promise<string | undefined> {
  if (!clientId || !ObjectId.isValid(clientId)) return undefined;
  try {
    const { db } = await connectToDatabase();
    const rec = await db
      .collection('sabcrm_records')
      .findOne(
        { _id: new ObjectId(clientId) },
        { projection: { data: 1 } },
      );
    const data = (rec?.data as Record<string, unknown> | undefined) ?? {};
    for (const k of ['name', 'companyName', 'fullName', 'displayName', 'title']) {
      const v = data[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface ShareableQuoteResult {
  shareId: string;
  token: string;
  /** Full public URL the customer opens. */
  url: string;
  quotationNo: string;
}

/**
 * Create (or reuse the open one for) a shareable public link for a quote.
 * Caller MUST have already gated the request — this function trusts
 * `projectId`. Fetches the quote via the Rust path (two-store gotcha),
 * persists a share row, and mints the HMAC token. Idempotent per quote: an
 * existing un-accepted/un-revoked share is reused so re-sharing doesn't pile
 * up dead links.
 */
export async function createShareableQuote(
  projectId: string,
  quoteId: string,
): Promise<ShareableQuoteResult> {
  const secret = signSecret();
  if (!secret) {
    throw new Error(
      'Quote sharing is not configured (set SABCRM_SIGN_SECRET).',
    );
  }
  // Resolve the quote through the project-scoped Rust client. Throws
  // RustApiError (e.g. 404) when the quote does not belong to this project.
  const doc = await sabcrmFinanceQuotationsApi.getById(projectId, quoteId);
  const totals = resolveTotals(doc);
  const now = new Date().toISOString();
  const col = await sharesCol();

  // Reuse an open share for this quote when one exists.
  const existing = await col.findOne({
    projectId,
    quoteId: doc._id,
    status: 'open',
  });
  let shareId: string;
  if (existing) {
    shareId = existing._id.toHexString();
    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          quotationNo: doc.quotationNo,
          currency: doc.currency || 'INR',
          amount: totals.total,
          updatedAt: now,
        },
      },
    );
  } else {
    const insert = await col.insertOne({
      projectId,
      quoteId: doc._id,
      quotationNo: doc.quotationNo,
      currency: doc.currency || 'INR',
      amount: totals.total,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    } as QuoteShareDoc);
    shareId = insert.insertedId.toHexString();
  }

  const token = signaturePayload(
    { projectId, quoteId: doc._id, shareId },
    secret,
  );
  return {
    shareId,
    token,
    url: `${appBaseUrl()}/share/quote/${encodeURIComponent(token)}`,
    quotationNo: doc.quotationNo,
  };
}

/** The customer-facing payload for the public signing page. */
export interface PublicQuoteView {
  quotationNo: string;
  status: QuoteShareDoc['status'];
  currency: string;
  amount: number;
  clientName?: string;
  /** Pre-rendered, print-ready HTML document. */
  html: string;
  accepted: boolean;
  acceptedAt?: string;
  acceptedBy?: string;
  /** Set once accepted + a SabPay link was created. */
  payUrl?: string;
}

/**
 * Resolve a public token to the render-ready quote view. UNGATED (public),
 * but fully re-validated: the token's HMAC + bound claims are checked, then
 * the share row + live quote are loaded and the claims re-confirmed against
 * the stored row. Returns `null` for any mismatch / revoked / missing.
 */
export async function getPublicQuote(token: string): Promise<PublicQuoteView | null> {
  const claims = verifySignatureToken(token, signSecret());
  if (!claims) return null;
  if (!ObjectId.isValid(claims.shareId)) return null;

  const col = await sharesCol();
  const share = await col.findOne({ _id: new ObjectId(claims.shareId) });
  if (!share) return null;
  // Re-confirm the token claims against the persisted row (defence in depth).
  if (share.projectId !== claims.projectId || share.quoteId !== claims.quoteId) {
    return null;
  }
  if (share.status === 'revoked') return null;

  let doc: SabcrmQuotationDoc;
  try {
    doc = await sabcrmFinanceQuotationsApi.getById(share.projectId, share.quoteId);
  } catch {
    return null;
  }

  const clientName = await resolveClientName(share.projectId, doc.clientId);
  const [brand, view] = await Promise.all([
    resolveBrand(share.projectId),
    Promise.resolve(toQuoteView(doc, share)),
  ]);
  view.clientName = clientName;

  return {
    quotationNo: doc.quotationNo,
    status: share.status,
    currency: doc.currency || share.currency || 'INR',
    amount: share.amount,
    clientName,
    html: renderQuoteHtml(view, brand),
    accepted: share.status === 'accepted',
    acceptedAt: share.acceptedAt,
    acceptedBy: share.signature?.signerName,
    payUrl: share.payUrl,
  };
}

export interface RecordSignatureResult {
  quotationNo: string;
  /** Customer pay URL when a SabPay link could be created. */
  payUrl?: string;
}

/**
 * Capture an e-signature against a public token and accept the quote.
 * UNGATED (public) but validated: token HMAC + claims, signature payload
 * shape, and a single-accept guard (an already-accepted share is rejected).
 *
 * On success: marks the share `accepted` (storing the signature + signer
 * name + IP + timestamp into OUR `sabcrm_quote_shares` row — this IS the
 * in-house e-sign record), flips the quote's Rust status to `accepted`, and
 * (best-effort) creates a SabPay payment link for the accepted amount via the
 * existing SabPay API. Also logs a CRM timeline NOTE (best-effort).
 */
export async function recordSignature(
  token: string,
  signerName: string,
  signatureDataUrl: string,
  ip?: string | null,
  userAgent?: string | null,
): Promise<RecordSignatureResult> {
  const claims = verifySignatureToken(token, signSecret());
  if (!claims) throw new Error('This link is invalid or has expired.');
  if (!ObjectId.isValid(claims.shareId)) throw new Error('Invalid link.');

  const name = (signerName || '').trim();
  if (name.length < 2 || name.length > 200) {
    throw new Error('Please enter your full name.');
  }
  if (
    !signatureDataUrl ||
    !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(signatureDataUrl) ||
    signatureDataUrl.length > 2_000_000
  ) {
    throw new Error('A valid signature is required.');
  }

  const col = await sharesCol();
  const share = await col.findOne({ _id: new ObjectId(claims.shareId) });
  if (!share) throw new Error('This link is no longer available.');
  if (share.projectId !== claims.projectId || share.quoteId !== claims.quoteId) {
    throw new Error('Invalid link.');
  }
  if (share.status === 'revoked') throw new Error('This quote is no longer available.');
  if (share.status === 'accepted') {
    // Idempotent: surface the existing acceptance instead of double-charging.
    return { quotationNo: share.quotationNo, payUrl: share.payUrl };
  }

  const now = new Date().toISOString();
  const signature: QuoteShareSignature = {
    signerName: name,
    signatureDataUrl,
    ip: ip ?? null,
    userAgent: userAgent ? userAgent.slice(0, 400) : null,
    signedAt: now,
  };

  // Single-accept guard at the DB level: only transition from `open`.
  const claimed = await col.findOneAndUpdate(
    { _id: share._id, status: 'open' },
    { $set: { status: 'accepted', signature, acceptedAt: now, updatedAt: now } },
    { returnDocument: 'after' },
  );
  if (!claimed) {
    // Lost the race; re-read to return whatever it became.
    const after = await col.findOne({ _id: share._id });
    return { quotationNo: share.quotationNo, payUrl: after?.payUrl };
  }

  // Flip the quote's workflow status on the Rust side (best-effort).
  await sabcrmFinanceQuotationsApi
    .update(share.projectId, share.quoteId, { status: 'accepted' })
    .catch(() => undefined);

  // Create the SabPay payment link for the accepted amount (best-effort).
  let payUrl: string | undefined;
  try {
    const ownerUserId = await resolveOwnerUserId(share.projectId);
    const paise = Math.round((Number(share.amount) || 0) * 100);
    if (ownerUserId && paise >= 100) {
      const link = await rustClient.sabpay.createPaymentLinkAs(ownerUserId, {
        amount: paise,
        currency: (share.currency || 'INR').toUpperCase(),
        description: `Quote ${share.quotationNo}`,
        referenceId: share.quoteId,
        customerName: name,
        notes: {
          source: 'sabcrm-quote',
          quoteId: share.quoteId,
          shareId: share._id.toHexString(),
        },
      });
      payUrl = link.shortUrl;
      await col.updateOne(
        { _id: share._id },
        { $set: { payLinkId: link.id, payUrl: link.shortUrl, updatedAt: new Date().toISOString() } },
      );
    }
  } catch {
    // Money side is best-effort; the quote remains accepted + signed.
  }

  // Timeline activity (best-effort). Author is the public signer.
  await createActivity({
    projectId: share.projectId,
    type: 'NOTE',
    title: `Quote ${share.quotationNo} accepted`,
    body: `Signed by ${name}${ip ? ` (IP ${ip})` : ''} on ${new Date(now).toLocaleString()}.${
      payUrl ? ` Payment link: ${payUrl}` : ''
    }`,
    targetObject: 'quotations',
    targetRecordId: share.quoteId,
    authorId: 'system:quote-sign',
  }).catch(() => undefined);

  return { quotationNo: share.quotationNo, payUrl };
}
