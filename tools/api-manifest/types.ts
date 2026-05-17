/**
 * SabNode Developer Platform — manifest spec types.
 *
 * The manifest is the single source of truth for the public `/api/v1/*`
 * surface. A code generator (`tools/api-codegen/*`) consumes it to emit:
 *
 *   - One `route.ts` per spec under `src/app/api/v1/**`
 *   - The OpenAPI 3.1 document served by `/api/v1/openapi`
 *   - The `OAuthScope` union in `src/lib/api-platform/types.ts`
 *   - Typed TS / Python SDKs (later phases)
 *
 * Everything here is intentionally framework-agnostic JSON-ish — no Next.js
 * or Zod imports — so the manifest stays fast to load from CI lint scripts.
 */

/* ── Core unions ────────────────────────────────────────────────────────── */

/** HTTP verbs supported by v1. */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Resource-shape of the operation. Drives default scope + HTTP method when
 *  `verb === 'custom'` we let the spec author pick its own method + path. */
export type Verb = 'list' | 'get' | 'create' | 'update' | 'delete' | 'custom';

/** Rate-limit tier. Mirrors `RateLimitTier` in `src/lib/api-platform/types.ts`.
 *  Endpoints declare the **minimum** tier required; FREE keys can hit every
 *  endpoint whose `tier === 'FREE'`. */
export type Tier = 'FREE' | 'PRO' | 'ENTERPRISE';

/* ── JSON schema fragment ───────────────────────────────────────────────── */

/**
 * The small subset of JSON Schema we use in the manifest. Kept hand-written
 * instead of importing a full type so a spec author can write a literal
 * without dependency surface.
 */
export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean' | 'null';
  format?: string;
  enum?: ReadonlyArray<string | number | boolean | null>;
  nullable?: boolean;
  description?: string;
  required?: ReadonlyArray<string>;
  properties?: Readonly<Record<string, JsonSchema>>;
  items?: JsonSchema;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
  $ref?: string;
  example?: unknown;
}

/* ── Delegate kinds ─────────────────────────────────────────────────────── */

/**
 * What the generated handler calls into. Exactly one delegate per spec.
 *
 *  - `inline`   → very small handlers (`/me`) emitted directly in the route
 *  - `handler`  → co-located hand-written handler exported from a
 *                  `_handlers.ts` file next to the route. The generator only
 *                  emits the `withApiV1` plumbing; the body lives in the
 *                  handler module. This is the default for any non-trivial
 *                  endpoint — it keeps domain logic out of generated code
 *                  while letting the platform own auth, rate-limit, scope,
 *                  request-id, and OpenAPI registration.
 *  - `action`   → call a `'use server'` export from `src/app/actions/*.ts`
 *                  with a JSON envelope; only suitable for actions whose
 *                  inputs match the request body verbatim.
 *  - `rust`     → call a method on a typed Rust client under
 *                  `src/lib/rust-client/*`. Useful for simple pass-throughs.
 *  - `rust-fwd` → forward as the authenticated user via `rustFetchAsUser`
 *                  (used for the legacy wachat / contacts surface that
 *                  pre-dates the typed Rust clients).
 */
export type DelegateInline = {
  kind: 'inline';
  /** Symbolic name; the codegen has a small lookup table for these. */
  name: 'me';
};

export type DelegateHandler = {
  kind: 'handler';
  /** Named export from the handler module. */
  export: string;
  /** Module path. Defaults to `./_handlers` (co-located). Use an `@/...`
   *  alias to share one handler module across multiple routes — e.g.
   *  identity endpoints all delegate to `@/lib/api-platform/handlers/identity`. */
  from?: string;
};

export type DelegateAction = {
  kind: 'action';
  /** File stem under `src/app/actions/`, e.g. `'contact'` → `contact.actions.ts`. */
  module: string;
  /** Named export from the action module. */
  export: string;
};

export type DelegateRust = {
  kind: 'rust';
  /** Property name on `rustClient` (camelCase). */
  client: string;
  /** Method on the client. */
  method: string;
};

export type DelegateRustFwd = {
  kind: 'rust-fwd';
  /** Path relative to the Rust service (must start with `/`). */
  path: string;
  /** HTTP method forwarded to the Rust side; usually mirrors the spec. */
  method: HttpMethod;
};

export type Delegate =
  | DelegateInline
  | DelegateHandler
  | DelegateAction
  | DelegateRust
  | DelegateRustFwd;

/* ── Endpoint spec ──────────────────────────────────────────────────────── */

/**
 * One v1 endpoint.
 *
 * The path is **relative to `/api/v1`**. Dynamic segments use the Next.js
 * `[name]` form, e.g. `/contacts/[id]/merge`. The generator translates these
 * to OpenAPI `{name}` syntax automatically.
 */
export interface EndpointSpec {
  /** Module grouping, used for OpenAPI tags + folder layout. */
  module: string;
  /** Resource the spec operates on, e.g. `'contacts'`, `'leads'`. */
  resource: string;
  /** Shape of the operation. Determines default method + path when not
   *  overridden. */
  verb: Verb;
  /** Path relative to `/api/v1`. Must start with `/`. */
  path: string;
  /** HTTP method. */
  method: HttpMethod;
  /** Required OAuth scope. Wildcards are valid. */
  scope: string;
  /** Minimum tier required to call the endpoint. */
  tier: Tier;
  /** Short one-line summary shown in OpenAPI + docs. */
  summary: string;
  /** Longer description; OpenAPI `description` field. */
  description?: string;
  /** Path parameters (must match `[...]` segments in `path`). */
  pathParams?: ReadonlyArray<{
    name: string;
    schema: JsonSchema;
    description?: string;
  }>;
  /** Query parameters. */
  queryParams?: ReadonlyArray<{
    name: string;
    schema: JsonSchema;
    required?: boolean;
    description?: string;
  }>;
  /** JSON body schema (POST/PATCH/PUT). */
  requestBody?: {
    schema: JsonSchema;
    required?: boolean;
    description?: string;
  };
  /** Response schemas keyed by HTTP status code. Status `'2xx'` is the
   *  primary success case. */
  responses: Readonly<Record<string, { schema?: JsonSchema; description: string }>>;
  /** Where the handler delegates the actual work. */
  delegate: Delegate;
  /** Webhook events emitted on success. Drives the platform-wide event
   *  enum and the OpenAPI `x-emits` extension. */
  emits?: ReadonlyArray<string>;
  /** Credit cost per successful call. `0` (default) means no charge. */
  credits?: number;
  /** When true, the generator wires `withIdempotency` around the handler. */
  idempotent?: boolean;
  /** Opt-out of rate limiting for special-case endpoints (e.g. discovery). */
  skipRateLimit?: boolean;
}

/* ── Manifest root ──────────────────────────────────────────────────────── */

export interface Manifest {
  /** Top-level info echoed into the OpenAPI document. */
  info: {
    title: string;
    version: string;
    description: string;
  };
  /** Every endpoint, flat. Order is insignificant — the generator sorts. */
  endpoints: ReadonlyArray<EndpointSpec>;
  /** Reusable component schemas referenced via `$ref: '#/components/schemas/X'`. */
  schemas: Readonly<Record<string, JsonSchema>>;
}
