/**
 * Types for `sabcrm-comms.actions.ts` — the SabCRM ↔ WaChat bridge that
 * surfaces a record's WhatsApp conversation on the record detail page.
 *
 * The thread is resolved by matching the record's first PHONE / PHONES value
 * (digits-only `waId`) to a WaChat contact inside the tenant's
 * WhatsApp-connected project, reusing WaChat's own conversation + send
 * actions (`whatsapp.actions.ts`).
 */

import type { SabcrmRustActivity } from './sabcrm-twenty.actions.types';

/** One WhatsApp message, flattened from WaChat's Meta payload shape. */
export interface SabcrmWhatsappMessage {
  id: string;
  /** `in` = received from the contact, `out` = sent by the business. */
  direction: 'in' | 'out';
  /** Best-effort plain text (caption / body); `[type]` for rich media. */
  text: string;
  /** Meta message type (`text`, `image`, `template`, …). */
  type: string;
  /** ISO timestamp, or null when WaChat stored none. */
  at: string | null;
  /** Outbound delivery status (`sent` | `delivered` | `read` | …). */
  status?: string | null;
}

/**
 * Stable handle onto the resolved WaChat conversation. Returned for display /
 * debugging only — the send action re-resolves the thread server-side and
 * never trusts a client-supplied ref.
 */
export interface SabcrmWhatsappThreadRef {
  /** The WaChat (WhatsApp-connected) project the conversation lives in. */
  wachatProjectId: string;
  /** The business phone number the conversation rides on. */
  phoneNumberId: string;
  /** The contact's WhatsApp id (digits-only phone). */
  waId: string;
  /** WaChat contact document id. */
  wachatContactId: string;
}

/** Result of {@link getSabcrmWhatsappThread}. */
export interface SabcrmWhatsappThread {
  /** True when a WaChat conversation could be resolved for this record. */
  connected: boolean;
  /** Human-readable reason when `connected` is false. */
  reason?: string;
  /**
   * Set when the record HAS a usable phone number — even when WaChat itself
   * isn't connected (lets the UI distinguish "no phone" from "no WaChat").
   */
  phone?: string;
  /** Last ~50 messages, oldest first. Empty when not connected. */
  messages: SabcrmWhatsappMessage[];
  threadRef?: SabcrmWhatsappThreadRef;
}

/** Result payload of {@link sendSabcrmWhatsappMessage}. */
export interface SabcrmWhatsappSendResult {
  /**
   * The `WHATSAPP` timeline activity logged for the send, or null when the
   * message went out but activity logging failed (non-fatal).
   */
  activity: SabcrmRustActivity | null;
}
