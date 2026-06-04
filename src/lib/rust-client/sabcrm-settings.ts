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

/**
 * The settings sections backed by a strongly-typed, server-validated endpoint
 * (`GET`/`PUT /v1/sabcrm/settings/<section>`). Each is one named slice of the
 * same per-project document (`data.<section>`); a `PUT` validates the body and
 * `$set`s only the supplied keys (PATCH semantics). Sections NOT listed here
 * (e.g. `profile`, `accounts`) have no typed schema and are read/written via
 * the free-form blob ({@link sabcrmSettingsApi.get} / `.update`).
 */
export const SABCRM_TYPED_SETTINGS_SECTIONS = [
  'general',
  'appearance',
  'notifications',
  'localization',
  'lab',
  'security',
] as const;

export type SabcrmTypedSettingsSection =
  (typeof SABCRM_TYPED_SETTINGS_SECTIONS)[number];

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

  /**
   * `GET /v1/sabcrm/settings/<section>` — read one typed section's stored
   * slice, parsed + defaulted by the engine. Returns the bare section object
   * (NOT a `{ data }` envelope — typed endpoints return the struct directly).
   */
  async getSection(
    projectId: string,
    section: SabcrmTypedSettingsSection,
  ): Promise<SabcrmRustSettings> {
    const res = await rustFetch<SabcrmRustSettings>(
      `${BASE}/${section}${qs({ projectId })}`,
    );
    return res ?? {};
  },

  /**
   * `PUT /v1/sabcrm/settings/<section>` — validate + merge a typed section.
   * The body is the section slice itself (projectId travels in the query, not
   * the body); only the supplied keys are `$set`. Returns the stored slice.
   */
  async putSection(
    projectId: string,
    section: SabcrmTypedSettingsSection,
    patch: SabcrmRustSettings,
  ): Promise<SabcrmRustSettings> {
    const res = await rustFetch<SabcrmRustSettings>(
      `${BASE}/${section}${qs({ projectId })}`,
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      },
    );
    return res ?? {};
  },
};
