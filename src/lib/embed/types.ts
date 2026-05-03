/**
 * Mobile / Desktop / Embed shared type definitions.
 *
 * These types are intentionally framework-agnostic so they can be shared
 * between server-side route handlers, client widgets, the Chrome MV3
 * extension, and the SabNode mobile SDKs.
 */

/** Visual + behavioural configuration for an embeddable web widget. */
export interface WidgetConfig {
  /** Tenant or project id this widget is bound to. */
  id: string;
  /** Tenant ("workspace") id — used for plan / RBAC enforcement. */
  workspaceId: string;
  /** Friendly name displayed in admin UI. */
  name: string;
  /** Optional flow id (SabFlow) to load inside the chat shell. */
  flowId?: string;
  /** Origin patterns that may host this widget (e.g. "https://acme.com"). */
  allowedOrigins: string[];
  /** Visual theme — kept loose so we can extend without breaking embeds. */
  theme?: {
    primary?: string;
    accent?: string;
    background?: string;
    foreground?: string;
    fontFamily?: string;
    radius?: number;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  };
  /** Greeting text shown when the bubble is opened the first time. */
  greeting?: string;
  /** Whether this widget is enabled. Disabled widgets refuse new sessions. */
  enabled: boolean;
  /** Locale (BCP-47) — drives copy in the loader. */
  locale?: string;
  /** ISO timestamp of last update — used as cache-buster for the loader. */
  updatedAt?: string;
}

/** A short-lived signed token authorising a single widget session. */
export interface EmbedToken {
  /** Widget id this token authorises. */
  widgetId: string;
  /** Workspace the widget belongs to. */
  workspaceId: string;
  /** Origin the embed was loaded from (validated server side). */
  origin: string;
  /** Issue time (epoch seconds). */
  iat: number;
  /** Expiry (epoch seconds). */
  exp: number;
  /** Optional already-known visitor id. */
  visitorId?: string;
  /** Detached HMAC signature (hex). */
  signature: string;
}

/** Origin allowlist record persisted alongside the widget. */
export interface EmbedAllowlist {
  widgetId: string;
  /** Exact match origins, e.g. "https://acme.com". */
  origins: string[];
  /** Optional wildcard hosts, e.g. "*.acme.com". */
  wildcardHosts?: string[];
  /** When false, all origins are blocked (kill-switch). */
  active: boolean;
}

/** Payload returned to mobile SDKs after a successful PKCE exchange. */
export interface MobileSdkPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  userId: string;
  workspaceId: string;
  /** Modules the user is entitled to in the mobile shell. */
  scopes: string[];
}

/** Web Push subscription token — mirrors the browser PushSubscription JSON. */
export interface PushNotificationToken {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  /** Workspace this subscription belongs to. */
  workspaceId: string;
  /** Optional user id — null for anonymous visitors. */
  userId?: string | null;
  /** Topic / channel labels. */
  topics?: string[];
  /** Created-at ISO timestamp. */
  createdAt?: string;
}
