/**
 * SabSMS v3 — omnichannel channel-dispatch types.
 *
 * The dispatcher (`./dispatcher.ts`) is the single seam every outbound
 * message crosses, regardless of channel. SMS/MMS/RCS are served by the
 * SabSMS Rust engine; WhatsApp by WaChat; email by SabMail; voice by
 * SabCall; live-chat by SabChat. Each is a `ChannelAdapter`; the
 * dispatcher runs one compliance gate (`./compliance-preflight.ts`)
 * before handing off, so every channel inherits the same
 * consent/suppression ledger.
 *
 * Pure types — safe to import anywhere.
 */

import type { SabsmsMessageCategory, SabsmsRcsPayload } from '../types';

/** Every channel SabSMS can fan out to. SMS/MMS/RCS are native; the rest
 *  are orchestrated to sibling SabNode modules. */
export type SabsmsDispatchChannel =
  | 'sms'
  | 'mms'
  | 'rcs'
  | 'whatsapp'
  | 'email'
  | 'voice'
  | 'chat';

/** Channels keyed on a phone number — these share the phone suppression
 *  ledger. (`email` has its own ledger in SabMail; `chat` is widget-keyed.) */
export const PHONE_BASED_CHANNELS: ReadonlySet<SabsmsDispatchChannel> = new Set([
  'sms',
  'mms',
  'rcs',
  'whatsapp',
  'voice',
]);

export interface DispatchRecipient {
  /** E.164 phone — required for all phone-based channels. */
  e164?: string;
  /** Email address — required for the `email` channel. */
  email?: string;
  /** SabCRM / SabSMS contact id, for attribution + identity-graph linkage. */
  contactId?: string;
  /** WhatsApp wa_id, when it differs from `e164`. */
  waId?: string;
}

export interface DispatchPayload {
  /** Plain text body (SMS/WhatsApp/voice TTS/email text). */
  body?: string;
  /** Email subject. */
  subject?: string;
  /** Email HTML body. */
  html?: string;
  /** Explicit text body when `body` is reserved for another use. */
  text?: string;
  /** Resolved public media URLs (R2) for MMS / WhatsApp media. */
  mediaUrls?: string[];
  /** Approved template id (DLT / WhatsApp / RCS), when sending templated. */
  templateId?: string;
  /** Variable bindings for the template. */
  templateParams?: Record<string, string>;
  /** RCS rich-card payload (card + suggestions + SMS fallback). */
  rcs?: SabsmsRcsPayload;
  /** Free-form per-channel extras (voice script, chat metadata, …). */
  meta?: Record<string, unknown>;
}

export interface DispatchContext {
  workspaceId: string;
  category: SabsmsMessageCategory;
  /** Sender header / from-address / caller-id, channel-appropriate. */
  from?: string;
  campaignId?: string;
  contactId?: string;
  idempotencyKey?: string;
  tags?: string[];
  /**
   * Bypass the suppression gate. ONLY for opt-out confirmations and
   * OTP/transactional flows that must reach a contact who was just
   * suppressed (mirrors the engine's `opt_out_confirmation` escape hatch).
   */
  allowSuppressed?: boolean;
}

export type DispatchStatus =
  /** Accepted and in-flight (engine queued / provider accepted). */
  | 'queued'
  /** Delivered synchronously (rare; some channels ack inline). */
  | 'sent'
  /** Recipient is on the suppression ledger (adapter-level). */
  | 'suppressed'
  /** Blocked by the compliance pre-flight before reaching the adapter. */
  | 'blocked'
  /** Channel has no live adapter binding yet (e.g. voice before SabCall). */
  | 'not_configured'
  /** Adapter errored. */
  | 'failed';

export interface DispatchResult {
  /** The channel that actually carried the message (may differ from the
   *  requested one once V3.2 cross-channel fallback lands). */
  channelUsed: SabsmsDispatchChannel;
  status: DispatchStatus;
  providerMessageId?: string;
  /** Estimated cost in credits, when the adapter reports it. */
  cost?: number;
  /** Set when `status === 'blocked'` — the failing gate's reason code. */
  blockedReason?: string;
  /** Set when `status === 'failed' | 'not_configured'`. */
  error?: string;
}

/**
 * A channel adapter. One instance may serve several related channels
 * (the SMS adapter serves `sms`/`mms`/`rcs`), so the requested channel is
 * passed into `dispatch`.
 */
export interface ChannelAdapter {
  dispatch(
    channel: SabsmsDispatchChannel,
    recipient: DispatchRecipient,
    payload: DispatchPayload,
    ctx: DispatchContext,
  ): Promise<DispatchResult>;
}
