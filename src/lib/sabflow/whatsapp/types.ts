/**
 * SabFlow — WhatsApp Business Cloud API types
 *
 * Minimal type surface covering:
 *   - messages we send out   (WhatsAppMessage)
 *   - messages we receive    (WhatsAppIncomingMessage + webhook payload)
 *   - per-flow configuration (WhatsAppConfig)
 *
 * Shapes follow the Meta Cloud API v18.0 schema:
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

/* ══════════════════════════════════════════════════════════
   Outgoing messages
   ══════════════════════════════════════════════════════════ */

/** Shared wrapper for URL-based media messages. */
export interface WhatsAppMediaPayload {
  /** Direct HTTPS link to the media asset. Mutually exclusive with `id`. */
  link?: string;
  /** Pre-uploaded media asset ID returned by the /media endpoint. */
  id?: string;
  /** Optional caption shown under the media. */
  caption?: string;
  /** Filename (document only). */
  filename?: string;
}

/** Plain text body. */
export interface WhatsAppTextPayload {
  body: string;
  /** Disable URL previews. Defaults to false server-side. */
  preview_url?: boolean;
}

/** Interactive reply button (max 3 per message). */
export interface WhatsAppReplyButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

/** Interactive list row (groups into `sections`, max 10 rows total). */
export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title?: string;
  rows: WhatsAppListRow[];
}

/** Interactive message — buttons or list variant. */
export type WhatsAppInteractivePayload =
  | {
      type: 'button';
      body: { text: string };
      header?: { type: 'text'; text: string };
      footer?: { text: string };
      action: { buttons: WhatsAppReplyButton[] };
    }
  | {
      type: 'list';
      body: { text: string };
      header?: { type: 'text'; text: string };
      footer?: { text: string };
      action: {
        button: string;
        sections: WhatsAppListSection[];
      };
    };

/** Pre-approved message template. */
export interface WhatsAppTemplatePayload {
  name: string;
  language: { code: string };
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters?: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; image: { link: string } }
    >;
  }>;
}

/** Discriminated union of all outbound message shapes. */
export type WhatsAppMessage =
  | { type: 'text'; text: WhatsAppTextPayload }
  | { type: 'image'; image: WhatsAppMediaPayload }
  | { type: 'audio'; audio: WhatsAppMediaPayload }
  | { type: 'video'; video: WhatsAppMediaPayload }
  | { type: 'document'; document: WhatsAppMediaPayload }
  | { type: 'interactive'; interactive: WhatsAppInteractivePayload }
  | { type: 'template'; template: WhatsAppTemplatePayload };

/* ══════════════════════════════════════════════════════════
   Incoming messages (webhook payload)
   ══════════════════════════════════════════════════════════ */

/** User-facing message content. */
export interface WhatsAppIncomingTextContent {
  body: string;
}

/** Interactive response: user tapped a button or picked a list row. */
export interface WhatsAppIncomingInteractive {
  type: 'button_reply' | 'list_reply';
  button_reply?: {
    id: string;
    title: string;
  };
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
}

/** A single entry in `value.messages[]` from the webhook. */
export interface WhatsAppIncomingMessage {
  /** E.164 phone number of the sender (no + prefix). */
  from: string;
  /** WhatsApp message ID (wamid.*). */
  id: string;
  /** Unix timestamp as a string. */
  timestamp: string;
  /** Message variant. */
  type:
    | 'text'
    | 'image'
    | 'audio'
    | 'video'
    | 'document'
    | 'interactive'
    | 'button'
    | 'location'
    | 'contacts'
    | 'sticker'
    | 'reaction'
    | 'unknown';
  text?: WhatsAppIncomingTextContent;
  interactive?: WhatsAppIncomingInteractive;
  image?: { id: string; mime_type?: string; sha256?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; filename?: string };
  button?: { payload?: string; text?: string };
}

/** Top-level webhook payload (subset we care about). */
export interface WhatsAppWebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: {
        messaging_product?: 'whatsapp';
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          wa_id: string;
          profile?: { name?: string };
        }>;
        messages?: WhatsAppIncomingMessage[];
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
    }>;
  }>;
}

/* ══════════════════════════════════════════════════════════
   Per-flow configuration
   ══════════════════════════════════════════════════════════ */

/**
 * Configuration linking a flow to a WhatsApp Business Cloud channel.
 * Persisted in the `sabflow_whatsapp_configs` collection.
 *
 * `accessToken` is stored encrypted at rest — see
 * `src/lib/sabflow/credentials/encryption.ts`.
 */
export interface WhatsAppConfig {
  flowId: string;
  /** WhatsApp phone-number resource ID (used in the Send Message endpoint). */
  phoneNumberId: string;
  /** Long-lived access token — always persisted encrypted. */
  accessToken: string;
  /** Shared secret echoed during webhook verification. */
  verifyToken: string;
  /** WhatsApp Business Account ID (WABA). */
  businessAccountId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
