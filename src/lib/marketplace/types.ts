/**
 * Marketplace types — apps, manifests, installs, reviews.
 *
 * The marketplace is a multi-tenant catalog of third-party (and first-party)
 * apps. Each app exposes a manifest describing its identity, OAuth/install
 * lifecycle endpoints, requested scopes, UI extension points, pricing model,
 * and publisher info. Tenants install apps; installs may incur usage and are
 * subject to a commission split.
 */

import 'server-only';

// ── Pricing ──────────────────────────────────────────────────────────────────

export type AppPricingType = 'free' | 'one-time' | 'subscription' | 'usage';

export interface AppPricing {
  type: AppPricingType;
  /** Amount in the smallest unit of the currency (e.g. cents). Optional for free apps. */
  amount?: number;
  /** ISO-4217 currency code (e.g. "USD", "INR"). Required when amount is set. */
  currency?: string;
}

// ── Publisher ────────────────────────────────────────────────────────────────

export interface AppPublisher {
  /** Display name shown on listing pages. */
  name: string;
  /** Internal user/tenant id of the publisher. */
  userId?: string;
  /** Public-facing website URL. */
  websiteUrl?: string;
  /** Support / contact email. */
  supportEmail?: string;
}

// ── UI extensions ────────────────────────────────────────────────────────────

/**
 * A pluggable UI surface that an app can render inside SabNode.
 * Slot identifies *where* in the host app the extension renders.
 */
export interface AppUiExtension {
  /** Stable id, scoped to the app. */
  id: string;
  /** Where the extension mounts (e.g. "crm.contact.sidebar", "sabflow.node"). */
  slot: string;
  /** Iframe / hosted URL the host app loads. */
  url: string;
  /** Human readable label for the extension. */
  label?: string;
}

// ── Manifest ─────────────────────────────────────────────────────────────────

/**
 * The on-disk / submitted descriptor for an app. Validated via
 * {@link validateManifest} before being persisted.
 */
export interface AppManifest {
  /** Stable, URL-safe identifier (e.g. "acme-crm-sync"). */
  id: string;
  name: string;
  /** Semantic version string (e.g. "1.0.0"). */
  version: string;
  /** OAuth scopes the app requests. Validated against the scope catalogue. */
  scopes: string[];
  /** OAuth redirect URL hit during the auth code exchange. */
  oauth_callback_url: string;
  /** Webhook the platform calls after a successful install. */
  install_callback_url: string;
  /** Webhook the platform calls when a tenant uninstalls. */
  uninstall_callback_url: string;
  /** UI extension points the app contributes. */
  ui_extensions: AppUiExtension[];
  pricing: AppPricing;
  /** Catalogue categories (e.g. ["analytics", "crm"]). */
  categories: string[];
  publisher: AppPublisher;
  /** Optional marketing fields. */
  description?: string;
  iconUrl?: string;
  homepageUrl?: string;
}

// ── App (persisted catalogue entry) ──────────────────────────────────────────

export type AppStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'suspended';

export interface App {
  /** MongoDB ObjectId string. */
  _id?: string;
  /** Mirrors manifest.id and is enforced unique. */
  appId: string;
  manifest: AppManifest;
  status: AppStatus;
  /** Userid of the developer who submitted the app. */
  ownerId: string;
  /** Lifetime aggregate install count for this app. */
  installCount: number;
  /** Average review rating (0–5), or null when no reviews. */
  averageRating: number | null;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
  /** Last published version manifest, used for rollback. */
  publishedManifest?: AppManifest;
}

// ── App listing filter ───────────────────────────────────────────────────────

export interface AppListFilter {
  /** Free-text search over name / description / categories. */
  q?: string;
  category?: string;
  status?: AppStatus;
  ownerId?: string;
  pricingType?: AppPricingType;
  /** Pagination — 1-indexed. */
  page?: number;
  limit?: number;
}

// ── Install (a tenant's installation of an app) ──────────────────────────────

export type InstallStatus = 'pending' | 'active' | 'suspended' | 'uninstalled';

export interface Install {
  _id?: string;
  /** Tenant identifier (typically a user/workspace id). */
  tenantId: string;
  /** Manifest.id of the installed app. */
  appId: string;
  /** Manifest.version installed. */
  version: string;
  /** Scopes granted by the tenant during install. */
  grantedScopes: string[];
  status: InstallStatus;
  /** Free-form config persisted during install_callback. */
  config: Record<string, unknown>;
  /** Aggregated metered units (for usage pricing). */
  usageUnits: number;
  installedAt: Date;
  updatedAt: Date;
  uninstalledAt?: Date;
}

// ── Reviews ──────────────────────────────────────────────────────────────────

export interface Review {
  _id?: string;
  appId: string;
  tenantId: string;
  /** Review author (userId). */
  authorId: string;
  /** 1–5 stars. */
  rating: number;
  title?: string;
  body?: string;
  createdAt: Date;
  updatedAt: Date;
}
