import 'server-only';

/**
 * SabCRM Favorites client — wraps the Rust `/v1/sabcrm/favorites` surface
 * (crate `sabcrm-favorites`, mounted by `sabnode-api`).
 *
 * Favorites are per-user, per-project bookmarks of a record, keyed by
 * `(projectId, userId, object, recordId)`. The `userId` is resolved on the
 * Rust side from the `AuthUser` JWT — never sent in the body. Tenant scope is
 * `projectId`.
 *
 * The Rust handlers wrap responses in `{ favorites: [...] }` (list) and
 * `{ favorite: {...} }` (single); this client unwraps them. Wire shapes
 * mirror `rust/crates/sabcrm-favorites/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** A SabCRM favorite as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustFavorite {
  id: string;
  projectId: string;
  userId: string;
  object: string;
  recordId: string;
  createdAt: string;
  /**
   * Spaced numeric sort slot driving the caller's drag-to-reorder order
   * (ascending; `createdAt` ascending breaks ties). Assigned at the tail on
   * add and rewritten by {@link sabcrmFavoritesApi.reorder}. Mirrors Twenty's
   * fractional positioning.
   */
  position?: number;
}

/**
 * One entry in a {@link sabcrmFavoritesApi.reorder} request — a favorite id and
 * its new zero-based slot in the caller's ordered list. Mirrors the Rust
 * `ReorderItem` DTO.
 */
export interface SabcrmFavoriteReorderItem {
  /** Hex id (`_id`) of the favorite to move. */
  id: string;
  /** New zero-based position in the ordered list (must be `>= 0`). */
  position: number;
}

/** Raw `{ favorites }` envelope from `GET /`. */
interface ListEnvelope {
  favorites: SabcrmRustFavorite[];
}

/** Raw `{ favorite }` envelope from `POST /`. */
interface SingleEnvelope {
  favorite: SabcrmRustFavorite;
}

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const BASE = '/v1/sabcrm/favorites';

export const sabcrmFavoritesApi = {
  /** `GET /v1/sabcrm/favorites` — the caller's favorites, newest first. */
  async list(projectId: string): Promise<SabcrmRustFavorite[]> {
    const res = await rustFetch<ListEnvelope>(`${BASE}${qs({ projectId })}`);
    return res.favorites;
  },

  /** `POST /v1/sabcrm/favorites` — upsert a favorite for the caller. */
  async add(
    projectId: string,
    object: string,
    recordId: string,
  ): Promise<SabcrmRustFavorite> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, object, recordId }),
    });
    return res.favorite;
  },

  /**
   * `PATCH /v1/sabcrm/favorites/reorder` — reassign `position` across the
   * caller's favorites within a project (Twenty's drag-to-reorder). Only the
   * listed favorites are touched; each item's zero-based `position` is mapped
   * to a spaced numeric slot server-side. Returns `{ ok: true }`; re-fetch via
   * {@link list} to read back the new order.
   */
  reorder(
    projectId: string,
    items: SabcrmFavoriteReorderItem[],
  ): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(`${BASE}/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ projectId, items }),
    });
  },

  /** `DELETE /v1/sabcrm/favorites` — remove a favorite (idempotent). */
  remove(
    projectId: string,
    object: string,
    recordId: string,
  ): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}${qs({ projectId, object, recordId })}`,
      { method: 'DELETE' },
    );
  },
};
