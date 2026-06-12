/**
 * Types for `sabcrm-email.actions.ts` — the SabCRM ↔ SabMail bridge that
 * surfaces a record's email correspondence on the record detail page.
 *
 * The correspondent is resolved from the record's first EMAIL / EMAILS value
 * (object metadata drives which `data.*` keys are email fields, in field
 * order — the same recipe the WhatsApp bridge uses for PHONE / PHONES).
 * Sends ride SabMail / the platform transport via `sendSabcrmEmailCore`
 * (`src/lib/sabcrm/email-core.ts`).
 */

import type { SabcrmRustActivity } from './sabcrm-twenty.actions.types';

/** One email in the record's thread, flattened for the Email tab. */
export interface SabcrmEmailMessage {
  id: string;
  /** `in` = received from the correspondent, `out` = sent by the tenant. */
  direction: 'in' | 'out';
  subject: string;
  /** Short body preview. */
  snippet: string;
  /** ISO timestamp, or null when unknown. */
  at: string | null;
  /**
   * Where the entry came from: a SabMail mailbox message (`sabmail`) or the
   * record's `EMAIL` activity history (`activity`) — the fallback when
   * SabMail has no per-correspondent rows (e.g. stub transport).
   */
  source: 'sabmail' | 'activity';
}

/** An email template offered by the compose Select (kind = `email`). */
export interface SabcrmEmailTemplateOption {
  id: string;
  name: string;
  subject?: string;
}

/** Result of `getSabcrmMailContext`. */
export interface SabcrmMailContext {
  /**
   * True when the record has an email address AND the tenant has an active
   * SabMail account to send from. False is a STATE, not an error — the tab
   * renders a no-email or connect-SabMail CTA from `reason` + `address`.
   */
  connected: boolean;
  /** Human-readable reason when `connected` is false. */
  reason?: string;
  /**
   * The record's resolved email address — set even when SabMail is not
   * connected (lets the UI distinguish "no email on record" from
   * "no SabMail account").
   */
  address?: string;
  /** The tenant's sending identity (first active SabMail account). */
  account?: { id: string; email: string };
  /**
   * How the thread was assembled: `sabmail` = per-correspondent mailbox
   * messages, `activities` = the record's EMAIL-activity history (sent log),
   * `mixed` = both, `none` = empty.
   */
  threadSource: 'sabmail' | 'activities' | 'mixed' | 'none';
  /** Thread entries, oldest first. Empty when not connected. */
  thread: SabcrmEmailMessage[];
  /** Email templates for the compose prefill Select. */
  templates: SabcrmEmailTemplateOption[];
}

/** Input of `sendSabcrmEmail`. */
export interface SendSabcrmEmailInput {
  subject: string;
  body: string;
  /**
   * Optional sabcrm-templates id — when set and `subject` / `body` are
   * blank, the template is rendered server-side against the record
   * (`{{field}}` interpolation) and fills the gaps.
   */
  templateId?: string;
}

/** Result payload of `sendSabcrmEmail`. */
export interface SabcrmEmailSendResult {
  /**
   * The `EMAIL` timeline activity logged for the send, or null when the
   * email went out but activity logging failed (non-fatal).
   */
  activity: SabcrmRustActivity | null;
  /** Transport message id when the provider returned one. */
  messageId?: string;
}

/** Result payload of `renderSabcrmEmailTemplate` (compose prefill). */
export interface SabcrmEmailTemplateRender {
  subject?: string;
  body: string;
  /** `{{placeholder}}` paths that resolved to no value. */
  missingVariables: string[];
}
