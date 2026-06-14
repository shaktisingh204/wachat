/**
 * WhatsApp message preview model.
 *
 * A normalized, render-only description of every WhatsApp message type the
 * WaChat rewrite can compose — text, media, interactive, CTA-URL, location,
 * carousel, catalog/product, template, and Flow. The builders (Templates,
 * Broadcasts, Flows, Carousel, Chat composer) map their editor state into
 * one of these and hand it to <WhatsAppPreview/> so the phone-frame preview
 * is identical everywhere and re-renders live as the user edits.
 *
 * This is presentation-only; it is intentionally looser than Meta's wire
 * payloads (which the Rust crates build). Keep field names readable.
 */

export type WaMediaKind = "image" | "video" | "document" | "audio" | "sticker";

export interface WaMedia {
  kind: WaMediaKind;
  /** Stable SabFiles URL (never a free-text paste). */
  url?: string;
  /** Document filename / caption fallback. */
  name?: string;
  /** Bytes — shown for documents. */
  size?: number;
  /** Audio/video duration in seconds. */
  durationSec?: number;
  caption?: string;
}

/** A tappable button rendered under a bubble. */
export interface WaButton {
  type: "quick_reply" | "url" | "phone" | "copy" | "flow" | "catalog" | "spm";
  text: string;
  /** For url buttons. */
  url?: string;
  /** For phone buttons. */
  phone?: string;
  /** For copy-code buttons. */
  code?: string;
}

/** A row inside an interactive list section. */
export interface WaListRow {
  title: string;
  description?: string;
}
export interface WaListSection {
  title?: string;
  rows: WaListRow[];
}

/** One card in an interactive media carousel / carousel template. */
export interface WaCarouselCard {
  media?: WaMedia;
  body?: string;
  buttons?: WaButton[];
}

/** A catalog product card (SPM / multi-product). */
export interface WaProduct {
  title: string;
  price?: string;
  image?: WaMedia;
  description?: string;
}

export type WaPreviewType =
  | "text"
  | "media"
  | "location"
  | "location_request"
  | "buttons"
  | "list"
  | "cta_url"
  | "carousel"
  | "catalog"
  | "template"
  | "flow";

export interface WaPreviewMessage {
  type: WaPreviewType;
  /** Whether the bubble is outgoing (business) or incoming (customer). */
  direction?: "in" | "out";

  /* shared */
  header?: { kind: "text" | WaMediaKind; text?: string; media?: WaMedia };
  body?: string;
  footer?: string;
  buttons?: WaButton[];

  /* media */
  media?: WaMedia;

  /* location */
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };

  /* list */
  listButtonText?: string;
  sections?: WaListSection[];

  /* cta_url */
  cta?: { displayText: string; url: string };

  /* carousel */
  cards?: WaCarouselCard[];

  /* catalog */
  catalogTitle?: string;
  products?: WaProduct[];

  /* template */
  templateName?: string;
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION";

  /* flow */
  flow?: { cta: string; name?: string; screens?: number };

  /** Optional message timestamp label (e.g. "10:24"). */
  time?: string;
  /** Delivery status (drives the ticks on outgoing bubbles). */
  status?: "pending" | "sent" | "delivered" | "read" | "failed";
}
