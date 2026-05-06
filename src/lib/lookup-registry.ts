/**
 * Lookup registry — type-only contracts shared between the server-side
 * `lookupEntity` action and the client-side `<EntityPicker>` component.
 *
 * IMPORTANT: This file is intentionally side-effect free and contains
 * no Mongo/server imports. It is safe to import from both server and
 * client code. The actual registry implementation lives in
 * `src/app/actions/crm-lookup.actions.ts`.
 */

/**
 * Stable string keys for every entity the picker can resolve.
 * Extend this union as new entities come online — see §13.1 of
 * `crm_function_plan.md`.
 */
export type EntityKey =
  | 'client'      // CRM Account (the company/client record on `crm_accounts`)
  | 'vendor'      // CRM Vendor (`crm_vendors`)
  | 'item'        // CRM Product / Item (`crm_products`)
  | 'employee'    // HR Employee (`crm_employees`)
  | 'user'        // Platform user (`users`)
  | 'account'     // Chart-of-accounts node (`crm_chart_of_accounts`)
  | 'warehouse'   // Stock location (`crm_warehouses`)
  | 'bankAccount';// Payment / bank account (`crm_payment_accounts`)

/**
 * Visual chip presented in the picker trigger and dropdown rows.
 * Keeps the picker decoupled from each entity's schema — only the
 * registry knows how to project a doc into one of these.
 */
export interface LookupChip {
  /** Required main label (e.g. client name, item name). */
  primary: string;
  /** Optional sub-label (e.g. GSTIN, SKU, role). */
  secondary?: string;
  /** Small meta line (e.g. city, price, department). */
  tertiary?: string;
  /** Avatar image URL — falls back to initials if absent. */
  avatarUrl?: string;
  /** Optional accent colour (CSS string). */
  color?: string;
}

/** Single result row returned from `lookupEntity`. */
export interface LookupItem {
  /** Stable id (typically the Mongo `_id` as a string). */
  id: string;
  /** Display projection. */
  chip: LookupChip;
  /**
   * Optional hydrated subset of the underlying document. Consumers
   * may use this to populate dependent fields (e.g. address from a
   * client) without a follow-up fetch.
   */
  raw?: Record<string, unknown>;
}

/** Parameters accepted by both the server action and the client wrapper. */
export interface LookupParams {
  /** Free-text query — debounced on the client, regex-matched on the server. */
  q?: string;
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Page size. Defaults to 20, hard-capped at 50. */
  limit?: number;
  /**
   * Hydrate a known set of ids — used on mount so the picker can
   * render chips for an existing form value.
   */
  ids?: string[];
  /** Entity-specific filter (e.g. `{ active: true }`). */
  filter?: Record<string, unknown>;
  /**
   * Visibility scope. `tenant` is the default — every record visible
   * to the current user. Future support for `project` (active CRM
   * project) and `global` (admin) lookups goes here.
   */
  scope?: 'project' | 'tenant' | 'global';
}

/** Standard envelope returned by `lookupEntity`. */
export interface LookupResult {
  items: LookupItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * Per-entity wiring contract. Used by the server-side registry — kept
 * here so it's also available to ad-hoc test code or alternative
 * consumers. The picker itself never sees this shape.
 */
export interface EntityLookupConfig {
  /** Mongo fields searched when `q` is provided. */
  searchableFields: string[];
  /** Optional default Mongo filter (e.g. exclude archived). */
  defaultFilter?: (ctx: unknown) => Record<string, unknown>;
  /** Project a raw doc into a chip. */
  toChip: (doc: Record<string, unknown>) => LookupChip;
  /** The actual fetch implementation. */
  fetch: (params: LookupParams, ctx: unknown) => Promise<LookupResult>;
}

export type LookupRegistry = Record<EntityKey, EntityLookupConfig>;

/** Hard cap to keep accidental "give me everything" calls cheap. */
export const LOOKUP_MAX_LIMIT = 50;
export const LOOKUP_DEFAULT_LIMIT = 20;
