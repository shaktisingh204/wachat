/**
 * Saved-views shared types (§5.10).
 *
 * A "saved view" is a per-list snapshot of filters + visible columns + sort,
 * keyed by `entityKind`. Lives in collection `crm_saved_views`.
 *
 * Scope:
 *   - `private` — only the owner sees it.
 *   - `shared`  — every member of the tenant sees it.
 *
 * A user may have at most one `isDefault === true` per (userId, entityKind).
 * The server action `setDefaultSavedView` enforces this by demoting peers
 * inside a single Mongo update.
 */

import 'server-only';

export type SavedViewScope = 'private' | 'shared';

export type SavedViewSortDir = 'asc' | 'desc';

export interface SavedViewBase {
    /** Hex string id (Mongo ObjectId rendered). */
    _id: string;
    /** Display name of the view. Required, trimmed, ≤ 80 chars. */
    name: string;
    /** Which list this view belongs to — e.g. `'contact'`, `'lead'`, `'invoice'`. */
    entityKind: string;
    /** Tenant root user id. Matches the `userId` column on other CRM rows. */
    ownerId: string;
    /** `'private'` (default) or `'shared'`. */
    scope: SavedViewScope;
    /**
     * Free-form filter map — interpretation is per-entity. The server stores
     * verbatim; the client decides which keys it cares about.
     */
    filters: Record<string, unknown>;
    /** Ordered list of column ids the page should render. */
    visibleColumns: string[];
    /** Optional sort field. */
    sortBy?: string;
    /** Optional sort direction. */
    sortDir?: SavedViewSortDir;
    /** Per-user, per-entity default. Only one may be true at a time. */
    isDefault: boolean;
    /** ISO timestamp. */
    createdAt: string;
    /** ISO timestamp. */
    updatedAt: string;
}

export type SavedView = SavedViewBase;

/** Mongo collection name. */
export const SAVED_VIEWS_COLLECTION = 'crm_saved_views';

/** Permission key — already registered in `permission-modules.ts`. */
export const SAVED_VIEW_PERMISSION_KEY = 'crm_saved_view' as const;
