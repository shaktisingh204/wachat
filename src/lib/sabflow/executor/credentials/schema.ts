/**
 * SabFlow Executor — Credential schema (Track B · Phase 5 · §1)
 * ===============================================================
 *
 * **n8n-compatible** credential schema for the SabFlow executor. Every
 * type id, every `CredentialTypeDef` shape, and every persisted field is
 * picked so that:
 *
 *  - An n8n `credentials.json` export imports 1:1 into SabFlow (see
 *    `docs/adr/sabflow-credentials-schema.md` §4 for the field map).
 *  - A SabFlow credential export round-trips back into n8n untouched
 *    (modulo our envelope encryption, which we strip on export).
 *  - The nine sibling Phase 5 sub-tasks (CredentialsHelper, OAuth2
 *    refresh, KEK rotation, test-connection, audit hooks, RBAC,
 *    SabFiles backing, import path, REST surface) consume *this file*
 *    as the single source of truth for shapes.
 *
 * Out of scope (owned by siblings — do NOT inline here):
 *
 *  - Envelope crypto primitives → `./crypto.ts` (Phase 5 §2).
 *  - Mongo CRUD helpers / model registration → Phase 5 §3 (we describe
 *    the collection shape here but do **not** register a model or open
 *    any indexes — see Constraints in the task brief).
 *  - RBAC enforcement → `./rbac.ts` (already shipped).
 *  - Audit hooks → `./audit.ts` (already shipped).
 *  - OAuth2 refresh → Phase 5 §6.
 *  - `testConnection()` per-type implementations → Phase 5 §7.
 *
 * See: `docs/adr/sabflow-credentials-schema.md`.
 */

import 'server-only';

import type { ObjectId } from 'mongodb';

import type { NodePropertyDef } from '../contract';

/* ------------------------------------------------------------------ */
/* 1. Credential type ids (n8n-compatible)                             */
/* ------------------------------------------------------------------ */

/**
 * Stable string id for a credential **type** (not a credential instance).
 *
 * Format: **camelCase** for n8n parity. n8n stores credential type ids in
 * `credentials.json` exactly like this:
 *
 *   - `'httpBasicAuth'`     — generic HTTP Basic Auth (user + password)
 *   - `'httpHeaderAuth'`    — generic HTTP header (e.g. `X-API-Key`)
 *   - `'oAuth2Api'`         — generic OAuth2 (authorization-code / client-credentials)
 *   - `'oAuth1Api'`         — generic OAuth1
 *   - `'googleSheetsOAuth2Api'`, `'slackApi'`, `'openAiApi'`, ...
 *
 * Anything that comes out of `n8n export:credentials --type=json` must
 * parse cleanly when stuffed into this field. We deliberately type this
 * as an open `string` (branded for readability) rather than a closed
 * union — n8n ships hundreds of types and the migration tool (Phase 5
 * §8) will populate `sabflow_credential_types` at runtime. The
 * **registry** of supported types is `CREDENTIAL_TYPES_KNOWN` below,
 * which is non-exhaustive and grows as nodes land in Phase 3.
 *
 * Branding (`__credentialType`) is a phantom field — it never appears
 * at runtime, but it stops accidental cross-assignment from raw
 * `string`s in TypeScript.
 *
 * @example
 * ```ts
 * const t: CredentialType = 'oAuth2Api';
 * ```
 */
export type CredentialType = string & { readonly __credentialType?: never };

/**
 * Known credential type ids — non-exhaustive, used for editor pickers,
 * RBAC defaults, and the n8n importer's "do we have a matching type?"
 * fast-path. Sub-task #7 (test-connection) and Phase 3 (built-in nodes)
 * extend this list as each node lands. Anything not in this set is
 * still a valid `CredentialType` — it is just opaque to the editor
 * until a `CredentialTypeDef` (see §3) is registered.
 *
 * Ordering is intentional: generic types first, then well-known
 * vendor groups (AI, comms, storage, productivity, commerce).
 */
export const CREDENTIAL_TYPES_KNOWN = [
  // Generic
  'httpBasicAuth',
  'httpHeaderAuth',
  'httpQueryAuth',
  'httpDigestAuth',
  'oAuth1Api',
  'oAuth2Api',
  // AI
  'openAiApi',
  'anthropicApi',
  'cohereApi',
  'mistralCloudApi',
  'groqApi',
  'perplexityApi',
  'openRouterApi',
  'huggingFaceApi',
  // Google (OAuth2 + service account variants)
  'googleApi',
  'googleSheetsOAuth2Api',
  'googleDriveOAuth2Api',
  'googleCalendarOAuth2Api',
  'googleGmailOAuth2Api',
  'googleBigQueryOAuth2Api',
  'googleChatOAuth2Api',
  // Microsoft
  'microsoftOAuth2Api',
  'microsoftGraphSecurityOAuth2Api',
  'microsoftOutlookOAuth2Api',
  'microsoftTeamsOAuth2Api',
  // Comms
  'slackApi',
  'slackOAuth2Api',
  'discordApi',
  'telegramApi',
  'twilioApi',
  'whatsAppApi',
  // Storage
  'awsS3',
  'awsApi',
  'dropboxOAuth2Api',
  'ftp',
  'sftp',
  // CRM
  'hubspotApi',
  'hubspotOAuth2Api',
  'salesforceOAuth2Api',
  'pipedriveApi',
  'airtableTokenApi',
  // Productivity
  'notionApi',
  'asanaApi',
  'trelloApi',
  'clickUpApi',
  'mondayComApi',
  'linearApi',
  'jiraSoftwareCloudApi',
  // Commerce
  'stripeApi',
  'shopifyApi',
  'paypalApi',
  // Databases
  'mongoDb',
  'postgres',
  'mySql',
  'redis',
] as const satisfies readonly CredentialType[];

/** Convenience type for the *known* subset above. */
export type KnownCredentialType = (typeof CREDENTIAL_TYPES_KNOWN)[number];

/* ------------------------------------------------------------------ */
/* 2. Decrypted credential data                                        */
/* ------------------------------------------------------------------ */

/**
 * Decrypted credential payload handed to a node's `ctx.getCredentials()`.
 *
 * n8n parity: `ICredentialDataDecryptedObject` — a flat key/value map of
 * scalar primitives. Nodes interpret keys by convention (`username`,
 * `password`, `apiKey`, `accessToken`, `clientId`, `clientSecret`,
 * `oauthTokenData`, …).
 *
 * Why scalars only?
 *
 * 1. Envelope encryption (see ADR §3) serialises plaintext with
 *    `JSON.stringify`. Allowing `Buffer` / `Date` / `bigint` would
 *    silently mangle on round-trip.
 * 2. n8n's importer emits scalars only — staying compatible costs us
 *    nothing.
 * 3. Anything richer (PEM blobs, signed JWTs) is encoded as a base64
 *    `string` by convention and decoded inside the node.
 *
 * `null` and `undefined` are permitted so that *optional* OAuth2 fields
 * (`refreshToken`, `expiresAt`, …) can be cleared without dropping the
 * key entirely.
 */
export type DecryptedCredentialData = Record<
  string,
  string | number | boolean | null | undefined
>;

/* ------------------------------------------------------------------ */
/* 3. Credential type definition (editor + runtime + tests)            */
/* ------------------------------------------------------------------ */

/**
 * The contract a credential **type** publishes once, to be consumed by:
 *
 *   - the editor's "New credential" form (`displayName` + `properties`),
 *   - the n8n importer (matches by `type` id),
 *   - the test-connection harness (`testOperation`, owned by Phase 5 §7),
 *   - the OAuth2 refresh worker (when `properties` declares the OAuth2
 *     shape — Phase 5 §6 reads the same `properties` to know where the
 *     refresh token lives).
 *
 * Mirrors n8n's `ICredentialType`. Kept narrow for Phase 1; richer
 * concepts (`extends`, `genericAuth`, `authenticate`) land in their
 * owning siblings without reshaping this surface.
 */
export interface CredentialTypeDef {
  /** Stable id, e.g. `'oAuth2Api'`. Must match the `type` on every record. */
  type: CredentialType;

  /** Human-readable name surfaced in the picker (e.g. "OAuth2 API"). */
  displayName: string;

  /**
   * Optional documentation URL (n8n's `documentationUrl`). Surfaced as a
   * "Learn more" link next to the credential form.
   */
  documentationUrl?: string;

  /**
   * Optional icon hint. Either an SVG path relative to
   * `public/icons/credentials/`, or a tabler-icon id (e.g.
   * `'IconKey'`). Editor falls back to a generic key glyph when absent.
   */
  icon?: string;

  /**
   * Categorisation tag used by the editor's grouped picker and the
   * RBAC default-share rules. Free-form so new categories land without
   * a schema bump.
   */
  category?: 'generic' | 'ai' | 'comms' | 'storage' | 'crm' | 'database' | 'productivity' | 'commerce' | string;

  /**
   * Field schema rendered in the credential form. Same shape as the
   * node `properties` array (we reuse `NodePropertyDef` from the
   * executor contract so editor code path is identical).
   *
   * Conventional field names (followed by the n8n importer):
   *
   *   - `'username'` / `'password'`          → httpBasicAuth
   *   - `'name'` / `'value'`                 → httpHeaderAuth (header)
   *   - `'apiKey'` / `'accessToken'`         → API-key style
   *   - `'clientId'` / `'clientSecret'`      → OAuth2
   *   - `'accessTokenUrl'` / `'authUrl'`     → OAuth2 endpoints
   *   - `'scope'`                            → OAuth2 scopes (space-sep)
   *   - `'oauthTokenData'`                   → OAuth2 token cache (n8n-shaped)
   */
  properties: NodePropertyDef[];

  /**
   * Optional declarative test for the "Test connection" button. Owned
   * by Phase 5 §7 (`testOperation` runner). When absent, the editor
   * still allows save but does not show a green / red dot.
   *
   * The shape is intentionally a *description* of an HTTP probe — not
   * a callback — so it serialises cleanly across the Node ↔ Rust
   * worker boundary, just like a node's `execute()` parameters.
   */
  testOperation?: CredentialTestOperation;

  /**
   * When this credential type is an OAuth2 family, the executor needs
   * to know where the refresh token + expiry live so it can refresh
   * just-in-time during `getCredentials()`. Phase 5 §6 reads this.
   * `null` / absent means "treat as a static credential, never refresh".
   */
  oauth2?: {
    /** Field name in `properties` holding the n8n-shaped token cache. */
    tokenDataField: string;
    /** Authorize URL (templated; `{{...}}` resolves against the record's data). */
    authUrl: string;
    /** Access-token URL. */
    accessTokenUrl: string;
    /** Whether to send `client_id` / `client_secret` in the body (default) or as Basic auth. */
    authStyle?: 'body' | 'header';
  };
}

/**
 * Declarative test-connection probe consumed by Phase 5 §7. Kept here
 * so the schema is fully self-describing; the runner is not.
 */
export interface CredentialTestOperation {
  request: {
    /** HTTP method (defaults to GET). */
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    /** Endpoint URL (templated against decrypted credential data). */
    url: string;
    /** Optional headers (templated). */
    headers?: Record<string, string>;
    /** Optional query params (templated). */
    qs?: Record<string, string | number | boolean>;
    /** Optional body (JSON-serialisable, templated). */
    body?: unknown;
  };
  /**
   * What constitutes success. When omitted, any 2xx is success and any
   * other status is failure.
   */
  rules?: Array<
    | { type: 'responseSuccessBody'; properties: { key: string; value: string | number | boolean; message?: string } }
    | { type: 'responseStatusCode'; properties: { value: number; message?: string } }
  >;
}

/* ------------------------------------------------------------------ */
/* 4. Persisted credential entity                                      */
/* ------------------------------------------------------------------ */

/**
 * Owner discriminator on a credential record.
 *
 * - `'user'`      — private to the creator (default for new records).
 *   Only `createdBy` and workspace admins with `sabflow.credential.admin`
 *   can read.
 * - `'workspace'` — any workspace member with `sabflow.credential.use`
 *   can decrypt at runtime (n8n's "shared" credential).
 * - `'shared'`    — explicit ACL stored elsewhere (Phase 5 §10); this
 *   record signals "consult the ACL collection".
 */
export type CredentialOwnerType = 'user' | 'workspace' | 'shared';

/**
 * The persisted credential row.
 *
 * Collection: **`sabflow_credentials`** (Mongo, native driver — see
 * `getCredentialsCollection()` for the typed accessor / index pattern
 * Phase 5 §3 will plug in).
 *
 * ## Encryption model (see ADR §3)
 *
 * The `dataEncrypted` `Buffer` is **not** the raw plaintext. It is the
 * AES-256-GCM ciphertext of `JSON.stringify(DecryptedCredentialData)`
 * under a fresh per-record DEK; the DEK is itself wrapped under a KEK
 * identified by the `kek` field. `crypto.ts` already implements both
 * sides — this row just holds the bytes.
 *
 * The `Buffer` carries the full envelope packed as
 * `iv (12) ‖ ciphertext (var) ‖ tag (16) ‖ wrappedDek (60)`. Phase 5
 * §3's reader splits this back into a `CredentialEnvelope` before
 * handing it to `decryptCredential()`.
 *
 * ## Field stability for n8n round-trip
 *
 * `name`, `type`, `createdAt`, `updatedAt`, `ownerType` (mapped to
 * n8n's `nodesAccess` / shared flag) and `data` (the decrypted form)
 * are the only fields the n8n importer/exporter touches. Everything
 * else is SabFlow-specific (workspace, KEK id, envelope mechanics).
 */
export interface CredentialEntity {
  /** Mongo `_id`. Hex-string projection at the API surface. */
  _id: ObjectId;

  /** Tenant isolation key. Indexed first on every read. */
  workspaceId: ObjectId;

  /** Human label shown in the picker. Unique per `(workspaceId, type)` by convention, not by constraint. */
  name: string;

  /** Credential type id — must match a `CredentialTypeDef.type`. */
  type: CredentialType;

  /**
   * Envelope-encrypted JSON of the credential's `DecryptedCredentialData`.
   * Layout: `iv (12) ‖ ciphertext (n) ‖ tag (16) ‖ wrappedDek (60)`.
   * See ADR §3 for the wire format and `./crypto.ts` for the
   * serialiser. **Never** decoded outside the executor worker.
   */
  dataEncrypted: Buffer;

  /**
   * Id of the KEK that wrapped this record's DEK. Mirrors
   * `CredentialEnvelope.kekId` so a rotation that only touches the
   * envelope (cheap) still leaves a queryable trail of "which records
   * are still under the old KEK".
   *
   * Resolves to `process.env['SABFLOW_KEK_' + kek]` at decrypt time.
   */
  kek: string;

  /**
   * Schema version of this row. Phase 1 ships **`1`**. Bumped on
   * breaking changes to the persisted shape (e.g. moving the wrapped
   * DEK out into a sidecar collection). Older versions are read with a
   * tagged-union upcaster in Phase 5 §3.
   */
  version: number;

  /** UTC creation timestamp. Set on insert. */
  createdAt: Date;

  /** UTC last-write timestamp. Updated on every mutation including KEK rotation. */
  updatedAt: Date;

  /** User id (ObjectId hex) of the creator. Drives default ownership + audit attribution. */
  createdBy: string;

  /** Sharing scope. See {@link CredentialOwnerType}. */
  ownerType: CredentialOwnerType;

  /**
   * Optional whitelist of node types that may request this credential.
   * Mirrors n8n's `nodesAccess[].nodeType` allow-list. `undefined` ==
   * "any node that declares this credential type may use it".
   *
   * @example `['n8n-nodes-base.httpRequest', 'sabflow.gmail']`
   */
  allowedNodeTypes?: string[];
}

/**
 * Public DTO emitted by the REST surface. Identical to {@link CredentialEntity}
 * with:
 *
 *   - `_id` projected to a hex `string` for JSON,
 *   - `dataEncrypted` and `kek` stripped (never leave the worker), and
 *   - an optional `data` field hydrated by callers that pass the
 *     RBAC `sabflow.credential.use` gate **and** explicitly opt-in
 *     (e.g. the test-connection runner).
 *
 * UI lists never see `data` — only metadata.
 */
export interface CredentialDTO {
  id: string;
  workspaceId: string;
  name: string;
  type: CredentialType;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  ownerType: CredentialOwnerType;
  allowedNodeTypes?: string[];
  /** Decrypted payload — only present for the `cred.use` / `cred.test` paths. */
  data?: DecryptedCredentialData;
}

/* ------------------------------------------------------------------ */
/* 5. Collection name (constant — no model registration)               */
/* ------------------------------------------------------------------ */

/**
 * Canonical Mongo collection name for credential rows. Phase 5 §3
 * registers indexes on `(workspaceId, type)`, `(workspaceId, updatedAt)`,
 * and `(kek)`; this file deliberately does **not** open a connection
 * or create the indexes — that's the model layer's job.
 */
export const SABFLOW_CREDENTIALS_COLLECTION = 'sabflow_credentials' as const;
