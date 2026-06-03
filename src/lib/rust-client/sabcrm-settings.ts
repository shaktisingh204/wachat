import 'server-only';

/**
 * SabCRM Settings client — wraps the Rust `/v1/sabcrm/settings` surface
 * (crate `sabcrm-settings`, mounted by `sabnode-api`).
 *
 * Settings are free-form per-project CRM workspace configuration: there is
 * exactly ONE settings document per project (keyed by a unique `projectId`),
 * holding an arbitrary key/value `data` map. Tenant scope is `projectId`.
 *
 * The Rust handlers wrap responses in `{ data: { ... } }`; this client
 * unwraps to the bare `data` map. Wire shapes mirror
 * `rust/crates/sabcrm-settings/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** Free-form per-project settings map as stored/returned by the engine. */
export type SabcrmRustSettings = Record<string, unknown>;

/** Raw `{ data }` envelope from `GET /` and `PUT /`. */
interface SettingsEnvelope {
  data: SabcrmRustSettings;
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

const BASE = '/v1/sabcrm/settings';

export const sabcrmSettingsApi = {
  /** `GET /v1/sabcrm/settings` — the project's settings (or `{}`). */
  async get(projectId: string): Promise<SabcrmRustSettings> {
    const res = await rustFetch<SettingsEnvelope>(`${BASE}${qs({ projectId })}`);
    return res.data;
  },

  /** `PUT /v1/sabcrm/settings` — merge `data` into the project's settings. */
  async update(
    projectId: string,
    data: SabcrmRustSettings,
  ): Promise<SabcrmRustSettings> {
    const res = await rustFetch<SettingsEnvelope>(
      `${BASE}${qs({ projectId })}`,
      {
        method: 'PUT',
        body: JSON.stringify({ projectId, data }),
      },
    );
    return res.data;
  },
};
