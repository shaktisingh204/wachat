/**
 * SabFlow — App preset types (Tier 2 of the 1,000-apps plan).
 *
 * A preset is a JSON document under `src/lib/sabflow/app-presets/<id>.json`
 * that describes how to call a third-party API: base URL, auth shape, and a
 * list of endpoints with their input fields. The generic `forge_app_preset`
 * block (see `src/lib/sabflow/forge/blocks/generic/app_preset.ts`) reads these
 * at runtime and dispatches them through the normal forge surface.
 *
 * Companion: `SABFLOW_1000_APPS_PLAN.md` §3.
 */

/** Auth families supported by the preset dispatcher. */
export type AppPresetAuthType =
  | 'bearer'
  | 'basic'
  | 'header'
  | 'query_token'
  | 'oauth2'
  | 'aws_sigv4'
  | 'none';

export type AppPresetAuth = {
  type: AppPresetAuthType;
  /** Matches a `CredentialType` id in `src/lib/sabflow/credentials/types.ts`. */
  credentialType?: string;
  /** Header name for `bearer` / `header` auth. Default: `Authorization`. */
  header?: string;
  /** Scheme prefix for `bearer` auth. Default: `Bearer`. */
  scheme?: string;
  /** Query-string parameter name when `type === 'query_token'`. */
  queryParam?: string;
};

/** Renderable input types — superset must remain compatible with `ForgeFieldType`. */
export type AppPresetFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'toggle'
  | 'select'
  | 'json'
  | 'password';

/** Where in the HTTP request a field's value lands. */
export type AppPresetFieldLocation = 'path' | 'query' | 'body' | 'header';

export type AppPresetSelectOption = {
  value: string;
  label: string;
};

export type AppPresetField = {
  id: string;
  label: string;
  type: AppPresetFieldType;
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  description?: string;
  /**
   * Defaults when omitted:
   *   - `path` if the endpoint's `path` contains `{<id>}`
   *   - `body` for POST/PATCH/PUT
   *   - `query` otherwise
   */
  in?: AppPresetFieldLocation;
  /** For `select` fields. */
  options?: AppPresetSelectOption[];
};

export type AppPresetHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AppPresetEndpoint = {
  id: string;
  label: string;
  description?: string;
  method: AppPresetHttpMethod;
  /** e.g. `/videos/{video_id}` — placeholders resolve against same-id fields. */
  path: string;
  fields: AppPresetField[];
  /** Minimal JSONPath projector — `$`, `$.foo`, `$.foo[0].bar`. Defaults to `$`. */
  outputPath?: string;
};

/** Lifecycle state for a preset. Auto-imported presets start as `draft`. */
export type AppPresetStatus = 'verified' | 'draft';

export type AppPreset = {
  /** kebab-case, globally unique. Becomes `forge_app_preset:<id>` for routing. */
  id: string;
  name: string;
  description?: string;
  category: string;
  /** react-icons/lu name, e.g. `LuVideo`. */
  iconName: string;
  version: number;
  /** ISO date `YYYY-MM-DD`. Drives stale-badge logic (>6 mo). */
  lastVerified: string;
  /** Default: `verified` for hand-curated entries, `draft` for auto-imported. */
  status?: AppPresetStatus;
  auth: AppPresetAuth;
  baseUrl: string;
  endpoints: AppPresetEndpoint[];
};

/** Lightweight projection used by the picker / list endpoints. */
export type AppPresetSummary = {
  id: string;
  name: string;
  category: string;
  iconName: string;
  endpointCount: number;
  lastVerified: string;
  status: AppPresetStatus;
  /** Present (true) when the preset is `status: 'draft'` but complete enough to list. */
  draft?: boolean;
  /** Only present (false) on incomplete presets surfaced via `includeIncomplete`. */
  complete?: boolean;
};
