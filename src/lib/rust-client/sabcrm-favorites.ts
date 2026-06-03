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
