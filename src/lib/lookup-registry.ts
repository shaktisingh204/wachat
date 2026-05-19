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
  | 'account'     // Chart-of-accounts node (`crm_chart_of_accounts`)
  | 'asset'       // HR/IT asset (`crm_assets`)
  | 'bankAccount' // Payment / bank account (`crm_payment_accounts`)
  | 'branch'      // Multi-branch location (collection TBD — see action TODO)
  | 'brand'       // Product brand (free-text dropdown today; `crm_brands` future)
  | 'category'    // Product category (`crm_product_categories`)
  | 'city'        // Static city list (src/data/reference/cities.ts) + inline-create
  | 'client'      // CRM Account (the company/client record on `crm_accounts`)
  | 'contact'     // CRM Contact (`crm_contacts`)
  | 'country'     // Static country list (src/data/reference/countries.ts)
  | 'currency'    // Static currency list (no DB)
  | 'deal'        // CRM Deal (`crm_deals`)
  | 'department'  // HR department (`crm_departments`)
  | 'designation' // HR designation (`crm_designations`)
  | 'employee'    // HR Employee (`crm_employees`)
  | 'enum'        // Catalogued named-enum picker — pass filter.enumName (see src/data/reference/crm-enums.ts)
  | 'industry'    // Industry classification (static enum) + inline-create
  | 'invoice'     // CRM Invoice (`crm_invoices`)
  | 'issue'       // CRM Project Issue (`crm_issues`)
  | 'item'        // CRM Product / Item (`crm_products`)
  | 'jobTitle'    // Job title taxonomy (static + inline-create)
  | 'language'    // Static ISO 639-1 language list
  | 'lead'        // CRM Lead (`crm_leads`)
  | 'leadSource'  // Lead source taxonomy (static + inline-create)
  | 'location'    // Country/state/city location lookup (TODO collection)
  | 'pipeline'    // Sales pipeline (embedded on `users.crmPipelines`)
  | 'project'     // CRM Project (`crm_projects`)
  | 'purchaseOrder' // CRM Purchase Order (`crm_purchase_orders`)
  | 'quotation'   // CRM Quotation (`crm_quotations`)
  | 'rfq'         // CRM Request-for-Quote (`crm_rfqs`)
  | 'salutation'  // Salutation list (Mr/Mrs/Dr/...) (static + inline-create)
  | 'sla'         // Ticket SLA rule (`crm_slas`)
  | 'stage'       // Pipeline stage (embedded on `users.crmPipelines[].stages`)
  | 'state'       // Static state/region list (src/data/reference/states.ts)
  | 'subtask'     // CRM Project Subtask (`crm_subtasks`)
  | 'tag'         // Cross-entity tag (collection TBD — see action TODO)
  | 'task'        // CRM Task (`crm_tasks`)
  | 'taxRate'     // Tax rate (`crm_taxes`)
  | 'ticket'      // CRM Support Ticket (`crm_tickets`)
  | 'ticketGroup' // Support ticket group (`crm_ticket_groups`)
  | 'timezone'    // IANA timezone list (runtime via Intl)
  | 'unit'        // Unit of measure (PCS/KG/L/HRS/...) + inline-create
  | 'user'        // Platform user (`users`)
  | 'vendor'      // CRM Vendor (`crm_vendors`)
  | 'vendorBill'  // Vendor bill / purchase invoice (`crm_bills`)
  | 'vendorType'  // Vendor classification (goods/services/both) + inline-create
  | 'warehouse';  // Stock location (`crm_warehouses`)

/**
 * Runtime mirror of the `EntityKey` union. Settings UIs and other
 * consumers that need to enumerate every registered entity (e.g. the
 * `entity_ref` custom-field configurator) read from this array.
 *
 * The `satisfies readonly EntityKey[]` clause keeps it in lock-step
 * with the type union — adding a new key to the union without adding
 * it here, or vice-versa, fails the TS build. Append-only.
 */
export const ENTITY_KEYS = [
  'account',
  'asset',
  'bankAccount',
  'branch',
  'brand',
  'category',
  'city',
  'client',
  'contact',
  'country',
  'currency',
  'deal',
  'department',
  'designation',
  'employee',
  'enum',
  'industry',
  'invoice',
  'issue',
  'item',
  'jobTitle',
  'language',
  'lead',
  'leadSource',
  'location',
  'pipeline',
  'project',
  'purchaseOrder',
  'quotation',
  'rfq',
  'salutation',
  'sla',
  'stage',
  'state',
  'subtask',
  'tag',
  'task',
  'taxRate',
  'ticket',
  'ticketGroup',
  'timezone',
  'unit',
  'user',
  'vendor',
  'vendorBill',
  'vendorType',
  'warehouse',
] as const satisfies readonly EntityKey[];

/**
 * Reference-data entity keys — backed by hardcoded lists in
 * `src/data/reference/*`. The picker treats these as "id = label", so a
 * user-typed value created inline can round-trip without a server write.
 *
 * Keep this in lock-step with the static handlers in
 * `src/app/actions/crm-lookup.actions.ts`.
 */
export const REFERENCE_ENTITY_KEYS: readonly EntityKey[] = [
  'country',
  'state',
  'city',
  'timezone',
  'language',
  'salutation',
  'leadSource',
  'jobTitle',
  'currency',
  'industry',
  'unit',
  'vendorType',
  'enum',
] as const;

export function isReferenceEntity(entity: EntityKey): boolean {
  return (REFERENCE_ENTITY_KEYS as readonly EntityKey[]).includes(entity);
}

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
  /**
   * Server-side recently-picked items for the current user, populated
   * by the Rust executor on empty-state queries (no `q`, no `ids`,
   * page=0). Drives the picker's "Recent" empty state without a
   * separate client-side localStorage cache. Optional — only set when
   * the lookup endpoint is the Rust one and the user has a recents
   * history. The TS server action leaves it unset for now.
   */
  recent?: LookupItem[];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toChip: (doc: any) => LookupChip;
  /** The actual fetch implementation. */
  fetch: (params: LookupParams, ctx: unknown) => Promise<LookupResult>;
}

export type LookupRegistry = Record<EntityKey, EntityLookupConfig>;

/** Hard cap to keep accidental "give me everything" calls cheap. */
export const LOOKUP_MAX_LIMIT = 50;
export const LOOKUP_DEFAULT_LIMIT = 20;
