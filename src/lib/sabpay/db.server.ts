import 'server-only';

/**
 * SabPay — persistence layer (server-only).
 *
 * Collections (all tenant-scoped by the SabNode user id):
 *   - `sabpay_merchants`  one settings doc per user (branding, mode)
 *   - `sabpay_payments`   every payment session created through the API
 *   - `sabpay_api_keys`   hashed secret keys (sk_test_… / sk_live_…)
 *
 * Follows the SabCRM server-module conventions: native Mongo driver,
 * idempotent per-process index bootstrap, ISO-string timestamps on the
 * client-facing shapes, secrets never round-trip to the browser after
 * the create call.
 */

import {
  ObjectId,
  type Collection,
  type Db,
  type Filter,
  type IndexDescription,
} from 'mongodb';
import { createHash, randomBytes } from 'node:crypto';

import { connectToDatabase } from '@/lib/mongodb';
import { generatePayuTxnId } from '@/lib/payu';
import type {
  SabpayApiKey,
  SabpayMerchant,
  SabpayMode,
  SabpayPayment,
  SabpayPaymentStatus,
  SabpayStats,
} from './types';

/* ── App URL (checkout links, PayU callbacks) ────────────────────────────── */

export function sabpayAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3002'
  );
}

/* ── Persisted document shapes ───────────────────────────────────────────── */

export interface SabpayMerchantDoc {
  _id: ObjectId;
  userId: ObjectId;
  businessName: string;
  logoUrl?: string;
  brandColor?: string;
  mode: SabpayMode;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
}

export interface SabpayPaymentDoc {
  _id: ObjectId;
  /** Public id, also the checkout URL slug: "pay_<24 hex>". */
  paymentId: string;
  userId: ObjectId;
  mode: SabpayMode;
  status: SabpayPaymentStatus;
  amount: number; // paise
  currency: string;
  description: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
  provider: 'payu';
  providerTxnId: string;          // PayU txnid (≤25 chars, unique)
  providerPaymentId?: string;     // mihpayid
  providerPaymentMode?: string;
  providerBankRefNum?: string;
  providerErrorMessage?: string;
  failureReason?: string;
  createdAt: string;
  paidAt?: string;
  updatedAt: string;
}

export interface SabpayApiKeyDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  mode: SabpayMode;
  /** SHA-256 hex of the full secret — the secret itself is never stored. */
  hash: string;
  /** "sk_test_" / "sk_live_" plus last 4 chars, for display. */
  display: string;
  revoked: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

/* ── Collection accessors + index bootstrap ──────────────────────────────── */

async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

export async function sabpayMerchants(): Promise<Collection<SabpayMerchantDoc>> {
  return (await getDb()).collection<SabpayMerchantDoc>('sabpay_merchants');
}

export async function sabpayPayments(): Promise<Collection<SabpayPaymentDoc>> {
  return (await getDb()).collection<SabpayPaymentDoc>('sabpay_payments');
}

export async function sabpayApiKeys(): Promise<Collection<SabpayApiKeyDoc>> {
  return (await getDb()).collection<SabpayApiKeyDoc>('sabpay_api_keys');
}

let indexesEnsured = false;

export async function ensureSabpayIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const [merchants, payments, keys] = await Promise.all([
    sabpayMerchants(),
    sabpayPayments(),
    sabpayApiKeys(),
  ]);
  await Promise.all([
    merchants.createIndexes([
      { key: { userId: 1 }, unique: true },
    ] as IndexDescription[]),
    payments.createIndexes([
      { key: { paymentId: 1 }, unique: true },
      { key: { providerTxnId: 1 }, unique: true },
      { key: { userId: 1, createdAt: -1 } },
      { key: { userId: 1, mode: 1, status: 1, createdAt: -1 } },
    ] as IndexDescription[]),
    keys.createIndexes([
      { key: { hash: 1 }, unique: true },
      { key: { userId: 1, createdAt: -1 } },
    ] as IndexDescription[]),
  ]);
  indexesEnsured = true;
}

/* ── Serialisation ───────────────────────────────────────────────────────── */

export function paymentDocToPayment(doc: SabpayPaymentDoc): SabpayPayment {
  return {
    id: doc.paymentId,
    mode: doc.mode,
    status: doc.status,
    amount: doc.amount,
    currency: doc.currency,
    description: doc.description,
    customer: {
      name: doc.customerName,
      email: doc.customerEmail,
      phone: doc.customerPhone,
    },
    metadata: doc.metadata,
    successUrl: doc.successUrl,
    cancelUrl: doc.cancelUrl,
    checkoutUrl: `${sabpayAppUrl()}/pay/${doc.paymentId}`,
    provider: doc.provider,
    providerTxnId: doc.providerTxnId,
    providerPaymentId: doc.providerPaymentId,
    providerMeta: {
      paymentMode: doc.providerPaymentMode,
      bankRefNum: doc.providerBankRefNum,
      errorMessage: doc.providerErrorMessage,
    },
    failureReason: doc.failureReason,
    createdAt: doc.createdAt,
    paidAt: doc.paidAt,
  };
}

function merchantDocToMerchant(doc: SabpayMerchantDoc): SabpayMerchant {
  return {
    businessName: doc.businessName,
    logoUrl: doc.logoUrl,
    brandColor: doc.brandColor,
    mode: doc.mode,
    defaultCurrency: doc.defaultCurrency,
    createdAt: doc.createdAt,
  };
}

function keyDocToApiKey(doc: SabpayApiKeyDoc, secret?: string): SabpayApiKey {
  return {
    _id: doc._id.toHexString(),
    name: doc.name,
    mode: doc.mode,
    display: doc.display,
    revoked: doc.revoked,
    lastUsedAt: doc.lastUsedAt,
    createdAt: doc.createdAt,
    secret,
  };
}

/* ── Merchant settings ───────────────────────────────────────────────────── */

/** Fetches (auto-creating on first use) the merchant settings for a user. */
export async function getOrCreateMerchant(
  userId: ObjectId,
  fallbackName: string,
): Promise<SabpayMerchant> {
  await ensureSabpayIndexes();
  const col = await sabpayMerchants();
  const now = new Date().toISOString();
  const doc = await col.findOneAndUpdate(
    { userId } as Filter<SabpayMerchantDoc>,
    {
      $setOnInsert: {
        userId,
        businessName: fallbackName || 'My business',
        mode: 'test' as SabpayMode,
        defaultCurrency: 'INR',
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  // upsert + returnDocument:'after' always yields a doc.
  return merchantDocToMerchant(doc as SabpayMerchantDoc);
}

export async function getMerchantDocByUserId(
  userId: ObjectId,
): Promise<SabpayMerchantDoc | null> {
  const col = await sabpayMerchants();
  return col.findOne({ userId } as Filter<SabpayMerchantDoc>);
}

export interface UpdateMerchantPatch {
  businessName?: string;
  logoUrl?: string;
  brandColor?: string;
  mode?: SabpayMode;
}

export async function updateMerchant(
  userId: ObjectId,
  patch: UpdateMerchantPatch,
): Promise<SabpayMerchant | null> {
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.businessName !== undefined) {
    const name = patch.businessName.trim();
    if (!name) throw new Error('Business name is required.');
    set.businessName = name.slice(0, 120);
  }
  if (patch.logoUrl !== undefined) set.logoUrl = patch.logoUrl.trim() || undefined;
  if (patch.brandColor !== undefined) {
    const color = patch.brandColor.trim();
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new Error('Brand color must be a 6-digit hex value.');
    }
    set.brandColor = color || undefined;
  }
  if (patch.mode !== undefined) {
    if (patch.mode !== 'test' && patch.mode !== 'live') {
      throw new Error('Mode must be "test" or "live".');
    }
    set.mode = patch.mode;
  }
  const col = await sabpayMerchants();
  const updated = await col.findOneAndUpdate(
    { userId } as Filter<SabpayMerchantDoc>,
    { $set: set },
    { returnDocument: 'after' },
  );
  return updated ? merchantDocToMerchant(updated) : null;
}

/* ── Payments ────────────────────────────────────────────────────────────── */

export function generateSabpayPaymentId(): string {
  return `pay_${randomBytes(12).toString('hex')}`;
}

export interface CreatePaymentInput {
  amount: number;                 // paise, integer ≥ 100 (₹1)
  currency?: string;
  description?: string;
  customer?: { name?: string; email?: string; phone?: string };
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
}

function validateRedirectUrl(label: string, url: unknown): string | undefined {
  if (url === undefined || url === null || url === '') return undefined;
  if (typeof url !== 'string') throw new Error(`${label} must be a string URL.`);
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must use http or https.`);
  }
  return parsed.toString();
}

/** Creates a payment session. Throws with a human-readable message on bad input. */
export async function createPayment(
  userId: ObjectId,
  mode: SabpayMode,
  input: CreatePaymentInput,
): Promise<SabpayPayment> {
  if (!Number.isInteger(input.amount) || input.amount < 100) {
    throw new Error('amount must be an integer in paise, at least 100 (₹1).');
  }
  if (input.amount > 10_00_00_000) {
    throw new Error('amount exceeds the per-payment cap of ₹10,00,000.');
  }
  const currency = (input.currency || 'INR').toUpperCase();
  if (currency !== 'INR') {
    throw new Error('Only INR is supported on the PayU rail right now.');
  }
  if (input.metadata) {
    const entries = Object.entries(input.metadata);
    if (entries.length > 20) throw new Error('metadata supports at most 20 keys.');
    for (const [k, v] of entries) {
      if (typeof v !== 'string' || k.length > 40 || v.length > 500) {
        throw new Error('metadata values must be strings (key ≤ 40, value ≤ 500 chars).');
      }
    }
  }

  const now = new Date().toISOString();
  const doc: Omit<SabpayPaymentDoc, '_id'> = {
    paymentId: generateSabpayPaymentId(),
    userId,
    mode,
    status: 'created',
    amount: input.amount,
    currency,
    description: (input.description || 'Payment').trim().slice(0, 200),
    customerName: input.customer?.name?.trim().slice(0, 100) || undefined,
    customerEmail: input.customer?.email?.trim().slice(0, 200) || undefined,
    customerPhone: input.customer?.phone?.trim().slice(0, 20) || undefined,
    metadata: input.metadata,
    successUrl: validateRedirectUrl('success_url', input.successUrl),
    cancelUrl: validateRedirectUrl('cancel_url', input.cancelUrl),
    provider: 'payu',
    providerTxnId: generatePayuTxnId('sp'),
    createdAt: now,
    updatedAt: now,
  };

  await ensureSabpayIndexes();
  const col = await sabpayPayments();
  const result = await col.insertOne(doc as SabpayPaymentDoc);
  return paymentDocToPayment({ ...doc, _id: result.insertedId } as SabpayPaymentDoc);
}

export async function getPaymentDocById(
  paymentId: string,
): Promise<SabpayPaymentDoc | null> {
  if (!/^pay_[0-9a-f]{24}$/.test(paymentId)) return null;
  const col = await sabpayPayments();
  return col.findOne({ paymentId } as Filter<SabpayPaymentDoc>);
}

export async function getPaymentDocByTxnId(
  providerTxnId: string,
): Promise<SabpayPaymentDoc | null> {
  if (!providerTxnId) return null;
  const col = await sabpayPayments();
  return col.findOne({ providerTxnId } as Filter<SabpayPaymentDoc>);
}

export interface FinalizePaymentInput {
  succeeded: boolean;
  providerPaymentId?: string;
  providerPaymentMode?: string;
  providerBankRefNum?: string;
  providerErrorMessage?: string;
  failureReason?: string;
}

/**
 * Transitions a payment out of `created` exactly once (the filter guards
 * against PayU retrying the callback). Returns the updated doc, or null
 * when the payment was already finalized / unknown.
 */
export async function finalizePayment(
  paymentId: string,
  input: FinalizePaymentInput,
): Promise<SabpayPaymentDoc | null> {
  const now = new Date().toISOString();
  const col = await sabpayPayments();
  return col.findOneAndUpdate(
    { paymentId, status: 'created' } as Filter<SabpayPaymentDoc>,
    {
      $set: {
        status: input.succeeded ? 'succeeded' : 'failed',
        providerPaymentId: input.providerPaymentId,
        providerPaymentMode: input.providerPaymentMode,
        providerBankRefNum: input.providerBankRefNum,
        providerErrorMessage: input.providerErrorMessage,
        failureReason: input.succeeded ? undefined : input.failureReason,
        paidAt: input.succeeded ? now : undefined,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  );
}

export interface ListPaymentsQuery {
  mode?: SabpayMode;
  status?: SabpayPaymentStatus;
  limit?: number;
  /** Return payments created strictly before this ISO timestamp (cursor). */
  before?: string;
}

export async function listPayments(
  userId: ObjectId,
  query: ListPaymentsQuery = {},
): Promise<SabpayPayment[]> {
  await ensureSabpayIndexes();
  const filter: Record<string, unknown> = { userId };
  if (query.mode) filter.mode = query.mode;
  if (query.status) filter.status = query.status;
  if (query.before) filter.createdAt = { $lt: query.before };
  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
  const col = await sabpayPayments();
  const docs = await col
    .find(filter as Filter<SabpayPaymentDoc>)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(paymentDocToPayment);
}

/* ── API keys ────────────────────────────────────────────────────────────── */

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export async function listApiKeys(userId: ObjectId): Promise<SabpayApiKey[]> {
  await ensureSabpayIndexes();
  const col = await sabpayApiKeys();
  const docs = await col
    .find({ userId } as Filter<SabpayApiKeyDoc>)
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((d) => keyDocToApiKey(d));
}

/**
 * Creates a secret key. The clear-text secret is returned exactly once on
 * the result — only its SHA-256 hash is persisted.
 */
export async function createApiKey(
  userId: ObjectId,
  name: string,
  mode: SabpayMode,
): Promise<SabpayApiKey> {
  const trimmed = name.trim().slice(0, 80) || 'Secret key';
  const secret = `sk_${mode}_${randomBytes(24).toString('hex')}`;
  const now = new Date().toISOString();
  const doc: Omit<SabpayApiKeyDoc, '_id'> = {
    userId,
    name: trimmed,
    mode,
    hash: hashSecret(secret),
    display: `sk_${mode}_…${secret.slice(-4)}`,
    revoked: false,
    createdAt: now,
  };
  await ensureSabpayIndexes();
  const col = await sabpayApiKeys();
  const result = await col.insertOne(doc as SabpayApiKeyDoc);
  return keyDocToApiKey({ ...doc, _id: result.insertedId } as SabpayApiKeyDoc, secret);
}

export async function revokeApiKey(
  userId: ObjectId,
  keyId: string,
): Promise<boolean> {
  if (!ObjectId.isValid(keyId)) return false;
  const col = await sabpayApiKeys();
  const result = await col.updateOne(
    { _id: new ObjectId(keyId), userId } as Filter<SabpayApiKeyDoc>,
    { $set: { revoked: true } },
  );
  return result.modifiedCount === 1;
}

/** Resolves a Bearer secret to its owning key doc, bumping lastUsedAt. */
export async function findApiKeyBySecret(
  secret: string,
): Promise<SabpayApiKeyDoc | null> {
  if (!/^sk_(test|live)_[0-9a-f]{48}$/.test(secret)) return null;
  const col = await sabpayApiKeys();
  const doc = await col.findOne({
    hash: hashSecret(secret),
    revoked: { $ne: true },
  } as Filter<SabpayApiKeyDoc>);
  if (doc) {
    void col
      .updateOne(
        { _id: doc._id } as Filter<SabpayApiKeyDoc>,
        { $set: { lastUsedAt: new Date().toISOString() } },
      )
      .catch(() => undefined);
  }
  return doc;
}

/* ── Overview stats ──────────────────────────────────────────────────────── */

export async function getStats(
  userId: ObjectId,
  mode: SabpayMode,
): Promise<SabpayStats> {
  await ensureSabpayIndexes();
  const col = await sabpayPayments();

  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const [totals, daily] = await Promise.all([
    col
      .aggregate<{ _id: SabpayPaymentStatus; count: number; volume: number }>([
        { $match: { userId, mode } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            volume: { $sum: '$amount' },
          },
        },
      ])
      .toArray(),
    col
      .aggregate<{ _id: string; volume: number; count: number }>([
        { $match: { userId, mode, status: 'succeeded', createdAt: { $gte: sinceIso } } },
        {
          $group: {
            _id: { $substrBytes: ['$createdAt', 0, 10] },
            volume: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  const byStatus = new Map(totals.map((t) => [t._id, t]));
  const succeeded = byStatus.get('succeeded');
  const failed = byStatus.get('failed');
  const created = byStatus.get('created');
  const succeededCount = succeeded?.count ?? 0;
  const failedCount = failed?.count ?? 0;
  const finished = succeededCount + failedCount;

  const byDay = new Map(daily.map((d) => [d._id, d]));
  const series: SabpayStats['series'] = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(since);
    day.setDate(since.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    series.push({ date: key, volume: hit?.volume ?? 0, count: hit?.count ?? 0 });
  }

  return {
    totalVolume: succeeded?.volume ?? 0,
    totalCount: succeededCount + failedCount + (created?.count ?? 0),
    succeededCount,
    failedCount,
    createdCount: created?.count ?? 0,
    successRate: finished === 0 ? 0 : Math.round((succeededCount / finished) * 100),
    series,
  };
}
