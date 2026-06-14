/**
 * SabSMS v3.1 — multi-channel Verify orchestrator.
 *
 * `verifyStart` generates a code, stores only its salted hash, and delivers
 * it over the first working channel in `channelOrder` via the omnichannel
 * dispatcher — so it inherits the one compliance gate, and falls back
 * SMS → WhatsApp → voice → email automatically when a channel isn't
 * configured for the workspace. `verifyCheck` validates the code in
 * constant time and is idempotent once verified.
 *
 * This is the Next-side Verify *product*. The Rust engine's `/v1/otp`
 * remains the low-level SMS-only primitive for direct API consumers; the
 * orchestrator owns cross-channel lifecycle because the fallback channels
 * (WhatsApp/email/voice) are themselves Next-side modules.
 *
 * All side-effecting collaborators (store, dispatch, clock, RNG) are
 * injectable, so the fallback + verification logic is unit-tested with no
 * Mongo, network, or sibling modules.
 */

import { randomUUID } from 'node:crypto';

import { dispatch as realDispatch } from '../channels/dispatcher';
import type {
  DispatchContext,
  DispatchPayload,
  DispatchRecipient,
  DispatchResult,
  SabsmsDispatchChannel,
} from '../channels/types';
import type { SabsmsMessageCategory, SabsmsVerification } from '../types';
import {
  generateNumericCode,
  generateSalt,
  hashCode,
  hashEquals,
  recipientHash,
} from './codes';

const DEFAULT_CHANNEL_ORDER: SabsmsDispatchChannel[] = [
  'sms',
  'whatsapp',
  'voice',
  'email',
];
const PHONE_CHANNELS: ReadonlySet<SabsmsDispatchChannel> = new Set([
  'sms',
  'mms',
  'rcs',
  'whatsapp',
  'voice',
]);

export interface VerifyStore {
  insert(doc: SabsmsVerification): Promise<void>;
  findById(
    workspaceId: string,
    verificationId: string,
  ): Promise<SabsmsVerification | null>;
  update(
    workspaceId: string,
    verificationId: string,
    patch: Partial<SabsmsVerification>,
  ): Promise<void>;
}

export interface OrchestratorDeps {
  store?: VerifyStore;
  dispatch?: (
    channel: SabsmsDispatchChannel,
    recipient: DispatchRecipient,
    payload: DispatchPayload,
    ctx: DispatchContext,
  ) => Promise<DispatchResult>;
  now?: () => Date;
  genCode?: (length: number) => string;
  genSalt?: () => string;
  genId?: () => string;
  /**
   * Cross-tenant SMS-pumping guard. Opt-in: when provided and it returns a
   * `high` verdict for the destination, the start is refused before any
   * code is sent. Omitted in unit tests so no Mongo is touched.
   */
  pumpingGuard?: (e164: string) => Promise<{ level: 'low' | 'medium' | 'high' }>;
}

export interface VerifyStartInput {
  workspaceId: string;
  recipient: DispatchRecipient;
  /** Override the channel order. Channels lacking a usable recipient field
   *  (phone for SMS/WhatsApp/voice, email for email) are skipped. */
  channelOrder?: SabsmsDispatchChannel[];
  category?: SabsmsMessageCategory;
  brand?: string;
  codeLength?: number;
  ttlSecs?: number;
  maxAttempts?: number;
  /** Sender header: email From / SMS sender id, channel-appropriate. */
  from?: string;
  /** Approved WhatsApp template id (required to deliver over WhatsApp). */
  whatsappTemplateId?: string;
}

export interface VerifyStartResult {
  verificationId: string;
  delivered: boolean;
  channelUsed?: SabsmsDispatchChannel;
  channelsTried: SabsmsDispatchChannel[];
  /** Set when the start was refused before sending (e.g. `pumping_risk`). */
  blockedReason?: string;
}

export type VerifyCheckStatus =
  | 'verified'
  | 'invalid'
  | 'expired'
  | 'max_attempts'
  | 'not_found'
  | 'already_verified';

export interface VerifyCheckResult {
  status: VerifyCheckStatus;
  /** Remaining attempts after this check, when still pending. */
  attemptsRemaining?: number;
}

// ─── defaults ────────────────────────────────────────────────────────────

function defaultStore(): VerifyStore {
  return {
    async insert(doc) {
      const { getSabsmsCollections } = await import('../db/collections');
      const { cols } = await getSabsmsCollections();
      await cols.verifications.insertOne(doc);
    },
    async findById(workspaceId, verificationId) {
      const { getSabsmsCollections } = await import('../db/collections');
      const { cols } = await getSabsmsCollections();
      return cols.verifications.findOne({ workspaceId, verificationId });
    },
    async update(workspaceId, verificationId, patch) {
      const { getSabsmsCollections } = await import('../db/collections');
      const { cols } = await getSabsmsCollections();
      await cols.verifications.updateOne(
        { workspaceId, verificationId },
        { $set: patch },
      );
    },
  };
}

/** Build the per-channel delivery payload for a code. */
function buildPayload(
  channel: SabsmsDispatchChannel,
  code: string,
  brand: string | undefined,
  whatsappTemplateId: string | undefined,
): DispatchPayload {
  const label = brand ? `${brand} ` : '';
  switch (channel) {
    case 'email':
      return {
        subject: `${label}verification code`,
        html: `<p>Your ${label}verification code is <b>${code}</b>. It expires soon.</p>`,
        text: `Your ${label}verification code is ${code}. It expires soon.`,
      };
    case 'whatsapp':
      return {
        templateId: whatsappTemplateId,
        templateParams: { '1': code },
        body: `Your ${label}verification code is ${code}.`,
      };
    // sms / mms / rcs / voice all carry a short text body.
    default:
      return { body: `Your ${label}verification code is ${code}.` };
  }
}

/** Keep only channels that have a usable recipient field. */
function resolveOrder(
  order: SabsmsDispatchChannel[],
  recipient: DispatchRecipient,
): SabsmsDispatchChannel[] {
  return order.filter((ch) =>
    PHONE_CHANNELS.has(ch) ? Boolean(recipient.e164) : Boolean(recipient.email),
  );
}

// ─── public API ──────────────────────────────────────────────────────────

export async function verifyStart(
  input: VerifyStartInput,
  deps: OrchestratorDeps = {},
): Promise<VerifyStartResult> {
  const store = deps.store ?? defaultStore();
  const dispatch = deps.dispatch ?? realDispatch;
  const now = deps.now ? deps.now() : new Date();
  const genCode = deps.genCode ?? generateNumericCode;
  const genSalt = deps.genSalt ?? generateSalt;
  const genId = deps.genId ?? randomUUID;

  const codeLength = input.codeLength ?? 6;
  const ttlSecs = input.ttlSecs ?? 300;
  const maxAttempts = input.maxAttempts ?? 5;
  const category: SabsmsMessageCategory = input.category ?? 'otp';

  const order = resolveOrder(
    input.channelOrder ?? DEFAULT_CHANNEL_ORDER,
    input.recipient,
  );

  const verificationId = genId();

  // Cross-tenant pumping guard (opt-in) — refuse before spending a code.
  if (deps.pumpingGuard && input.recipient.e164) {
    const verdict = await deps.pumpingGuard(input.recipient.e164);
    if (verdict.level === 'high') {
      return {
        verificationId,
        delivered: false,
        channelsTried: [],
        blockedReason: 'pumping_risk',
      };
    }
  }

  const code = genCode(codeLength);
  const salt = genSalt();
  const rhash = recipientHash(input.recipient.e164 ?? input.recipient.email ?? '');

  const channelsTried: SabsmsDispatchChannel[] = [];
  let channelUsed: SabsmsDispatchChannel | undefined;

  for (const channel of order) {
    const payload = buildPayload(channel, code, input.brand, input.whatsappTemplateId);
    const ctx: DispatchContext = {
      workspaceId: input.workspaceId,
      category,
      from: input.from,
      contactId: input.recipient.contactId,
      // OTP must reach a just-suppressed contact (mirrors the engine's
      // opt_out_confirmation escape hatch).
      allowSuppressed: true,
    };
    const res = await dispatch(channel, input.recipient, payload, ctx);
    channelsTried.push(channel);
    if (res.status === 'queued' || res.status === 'sent') {
      channelUsed = channel;
      break;
    }
  }

  const doc: SabsmsVerification = {
    workspaceId: input.workspaceId,
    verificationId,
    recipientHash: rhash,
    codeHash: hashCode(code, salt),
    salt,
    channelOrder: order,
    channelsTried,
    channelUsed,
    status: channelUsed ? 'pending' : 'failed',
    attempts: 0,
    maxAttempts,
    category,
    expiresAt: new Date(now.getTime() + ttlSecs * 1000),
    createdAt: now,
  };
  await store.insert(doc);

  return {
    verificationId,
    delivered: Boolean(channelUsed),
    channelUsed,
    channelsTried,
  };
}

export async function verifyCheck(
  input: { workspaceId: string; verificationId: string; code: string },
  deps: OrchestratorDeps = {},
): Promise<VerifyCheckResult> {
  const store = deps.store ?? defaultStore();
  const now = deps.now ? deps.now() : new Date();

  const doc = await store.findById(input.workspaceId, input.verificationId);
  if (!doc) return { status: 'not_found' };
  if (doc.status === 'verified') return { status: 'already_verified' };

  if (now.getTime() >= doc.expiresAt.getTime()) {
    if (doc.status !== 'expired') {
      await store.update(input.workspaceId, input.verificationId, { status: 'expired' });
    }
    return { status: 'expired' };
  }
  if (doc.attempts >= doc.maxAttempts) {
    return { status: 'max_attempts' };
  }

  if (hashEquals(hashCode(input.code, doc.salt), doc.codeHash)) {
    await store.update(input.workspaceId, input.verificationId, {
      status: 'verified',
      verifiedAt: now,
    });
    return { status: 'verified' };
  }

  const attempts = doc.attempts + 1;
  const hitLimit = attempts >= doc.maxAttempts;
  await store.update(input.workspaceId, input.verificationId, {
    attempts,
    status: hitLimit ? 'max_attempts' : 'pending',
  });
  return hitLimit
    ? { status: 'max_attempts' }
    : { status: 'invalid', attemptsRemaining: doc.maxAttempts - attempts };
}
