/**
 * Shape definitions for the SabFlow coverage dashboard.
 *
 * These mirror the JSON inventories produced by sibling Phase C.1
 * sub-tasks (C.1.1 → C.1.7). Sibling tasks run in parallel, so the
 * loader code must treat every field as optional and gracefully
 * degrade when files or keys are missing.
 *
 * If the shape diverges from what a sibling task emits, the loader
 * is the only place that needs to adapt — the dashboard renders
 * defensively from these types.
 */

export interface RustStubRow {
    /** e.g. `n8n-nodes-base.httpRequest` */
    nodeType: string;
    /** Absolute path under `rust/crates/sabflow-nodes/` */
    file?: string;
    /** Whether a working TS forge fallback masks this stub today. */
    hasForgeFallback?: boolean;
    /** ISO-8601 timestamp of the last commit that touched the file. */
    lastTouched?: string;
    /** `low` | `medium` | `high` — author hint for backfill effort. */
    complexityHint?: 'low' | 'medium' | 'high' | string;
    /** Optional: the C.1 inventory may flip this once a node ships. */
    isStub?: boolean;
}

export interface RustStubsInventory {
    /** Total node types registered (stub + non-stub combined). */
    totalNodes?: number;
    /** Count of nodes still emitting `stub: true`. */
    stubCount?: number;
    /** Count of stubs masked by a working forge fallback. */
    maskedCount?: number;
    /** Generation timestamp of this inventory file. */
    generatedAt?: string;
    /** All node rows. */
    nodes?: RustStubRow[];
}

export interface ForgeFallbackRow {
    nodeType: string;
    forgeFile?: string;
    /** The Rust stub this fallback masks, if any. */
    maskedRustStub?: string;
}

export interface ForgeFallbackInventory {
    totalFallbacks?: number;
    generatedAt?: string;
    fallbacks?: ForgeFallbackRow[];
}

export interface N8nMissingRow {
    nodeType: string;
    displayName?: string;
    category?: string;
    credentialTypes?: string[];
    /** n8n release the node first appeared in. */
    landedIn?: string;
}

export interface N8nMissingInventory {
    /** Total n8n nodes catalogued (covered + missing). */
    n8nTotalCount?: number;
    /** SabFlow's current coverage count. */
    sabflowCoverageCount?: number;
    generatedAt?: string;
    missing?: N8nMissingRow[];
}

export type PriorityBand = 'S' | 'A' | 'B' | 'C';

export interface PriorityBandRow {
    nodeType: string;
    band: PriorityBand | string;
    /** Optional flag indicating whether SabFlow has shipped this. */
    shipped?: boolean;
    /** Optional demand score the band was derived from. */
    score?: number;
}

export interface PriorityBandsInventory {
    generatedAt?: string;
    bands?: PriorityBandRow[];
}

/**
 * Defensive loader result. Each section reports its own load status
 * so the UI can render an "Inventory pending" banner per-section
 * instead of failing the whole page.
 */
export type LoadResult<T> =
    | { status: 'ok'; data: T; path: string }
    | { status: 'missing'; path: string }
    | { status: 'error'; path: string; message: string };

export interface CoverageData {
    rustStubs: LoadResult<RustStubsInventory>;
    forgeFallbacks: LoadResult<ForgeFallbackInventory>;
    n8nMissing: LoadResult<N8nMissingInventory>;
    priorityBands: LoadResult<PriorityBandsInventory>;
    playbackGap: LoadResult<string>;
    marketplaceState: LoadResult<string>;
    collabState: LoadResult<string>;
}
