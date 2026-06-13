/**
 * SabCRM — field-level security (FLS) — PURE policy model + evaluators.
 *
 * The structural twin of `./scoring.ts` and `./access-compiler.ts`: a
 * `'server-only'`- and I/O-free module so the unit tests (`tsx --test`) AND the
 * `'use client'` field-security settings page can import the types + the
 * deterministic policy math directly. The Mongo CRUD + enforcement wiring live
 * in `./fls.server.ts`, which re-exports everything here.
 *
 * ## Model
 *
 * An {@link FlsPolicy} pins one (object, field, role) triple to an
 * {@link FlsAccess} level:
 *   - `editable`  — read AND write (the implicit default for every unmatched
 *                   field/role; this is why FLS-off behaves EXACTLY as today).
 *   - `readonly`  — visible on read, but a write that touches the field is
 *                   rejected.
 *   - `hidden`    — stripped from read results AND rejected on write.
 *
 * The role is the SabCRM capability label (`view` | `manage` | `admin`) OR a
 * raw project role slug — the resolver decides which it passes; this pure layer
 * just string-matches. A wildcard role `'*'` applies to every role and is used
 * as a base rule that a more specific role rule can override.
 *
 * ## Security posture (READ THIS)
 *
 * `effectiveAccess` is the single source of truth and it is DENY-LAST only in
 * the sense that a missing policy is `editable` (so the feature is a no-op until
 * a project opts in AND writes policies). When two policies could match (an
 * exact-role rule and a `'*'` rule), the EXACT-role rule wins; if two rules of
 * the same specificity disagree (corrupt config), the MORE RESTRICTIVE level
 * wins (`hidden` > `readonly` > `editable`) so a bad config fails toward LESS
 * access, never more. There is no path here that widens access beyond
 * `editable`, which is already the no-FLS default.
 */

/** What a (object, field, role) triple may do. */
export type FlsAccess = 'hidden' | 'readonly' | 'editable';

/** Every recognised {@link FlsAccess} (validates persisted blobs). */
export const FLS_ACCESS_LEVELS: ReadonlySet<string> = new Set<FlsAccess>([
  'hidden',
  'readonly',
  'editable',
]);

/** Wildcard role token: a base rule matched by every role. */
export const FLS_ANY_ROLE = '*';

/** One field-level-security rule. */
export interface FlsPolicy {
  /** Object slug the rule applies to, e.g. `companies`. */
  object: string;
  /** Field key under `data.` the rule restricts, e.g. `revenue`. */
  field: string;
  /**
   * Role this rule targets — the SabCRM capability label (`view`/`manage`/
   * `admin`) or a raw project role slug, or {@link FLS_ANY_ROLE} for a base
   * rule. The resolver supplies the matching role string; this layer only
   * string-compares.
   */
  role: string;
  /** Access this triple grants. */
  access: FlsAccess;
}

/* -------------------------------------------------------------------------- */
/* Ordering / merge helpers                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Restriction rank — higher = LESS access. Used to pick the more restrictive
 * rule when two same-specificity policies disagree (corrupt config fails
 * closed) and never the reverse.
 */
function rank(access: FlsAccess): number {
  switch (access) {
    case 'hidden':
      return 2;
    case 'readonly':
      return 1;
    default:
      return 0; // editable
  }
}

/** The more restrictive of two access levels (fail-closed tie-break). */
function moreRestrictive(a: FlsAccess, b: FlsAccess): FlsAccess {
  return rank(a) >= rank(b) ? a : b;
}

/**
 * Validate + normalise an arbitrary value into an {@link FlsPolicy}, or `null`
 * when it is not a well-formed rule. Trims string fields; an unknown access
 * level is rejected (returns null) rather than silently coerced — a malformed
 * level must not accidentally widen access.
 */
export function normalizePolicy(raw: unknown): FlsPolicy | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const object = typeof o.object === 'string' ? o.object.trim() : '';
  const field = typeof o.field === 'string' ? o.field.trim() : '';
  const role = typeof o.role === 'string' ? o.role.trim() : '';
  const access = typeof o.access === 'string' ? o.access.trim() : '';
  if (!object || !field || !role) return null;
  if (!FLS_ACCESS_LEVELS.has(access)) return null;
  return { object, field, role, access: access as FlsAccess };
}

/* -------------------------------------------------------------------------- */
/* Effective access for one (field, role)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the effective {@link FlsAccess} for one `field` under one `role`,
 * given a list of policies (already scoped to ONE object by the caller).
 *
 * Resolution order:
 *   1. Default is `editable` (no policy → unchanged behaviour).
 *   2. Exact-role rules for the field take precedence over `'*'` rules.
 *   3. Among rules of the SAME specificity, the MORE RESTRICTIVE level wins
 *      (fail-closed on conflicting/corrupt config).
 *
 * Pure + deterministic; no I/O.
 */
export function effectiveAccess(
  policies: FlsPolicy[],
  role: string,
  field: string,
): FlsAccess {
  let exact: FlsAccess | null = null;
  let wildcard: FlsAccess | null = null;
  for (const p of policies) {
    if (p.field !== field) continue;
    if (p.role === role) {
      exact = exact === null ? p.access : moreRestrictive(exact, p.access);
    } else if (p.role === FLS_ANY_ROLE) {
      wildcard =
        wildcard === null ? p.access : moreRestrictive(wildcard, p.access);
    }
  }
  // Exact-role wins outright; otherwise the wildcard base; otherwise editable.
  if (exact !== null) return exact;
  if (wildcard !== null) return wildcard;
  return 'editable';
}

/* -------------------------------------------------------------------------- */
/* Read-side helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Given the object's full field-key list, return the keys VISIBLE to `role`
 * (i.e. not `hidden`). `readonly` fields are still visible. Fields with no
 * policy default to `editable` → visible. Order is preserved.
 */
export function visibleFields(
  policies: FlsPolicy[],
  role: string,
  allFields: string[],
): string[] {
  return allFields.filter(
    (key) => effectiveAccess(policies, role, key) !== 'hidden',
  );
}

/**
 * The complement of {@link visibleFields}: the field keys HIDDEN from `role`.
 * These are the keys the read path must strip from `data`.
 */
export function hiddenFields(
  policies: FlsPolicy[],
  role: string,
  allFields: string[],
): string[] {
  return allFields.filter(
    (key) => effectiveAccess(policies, role, key) === 'hidden',
  );
}

/**
 * Return a shallow clone of a record with the given hidden field keys stripped
 * from its `data` map. Never mutates the input. A record without a `data` map
 * is returned essentially unchanged (with a fresh `data: {}`), and an empty
 * `hiddenFieldKeys` returns a structurally-equal clone (no-op when FLS is off).
 *
 * NOTE: this strips ONLY `data.<key>` scalars — the FLS-managed envelope. It
 * deliberately does NOT touch top-level columns (`_id`, `userId`, audit), which
 * are not user fields and are governed by the sharing filter, not FLS.
 */
export function redactRecord<
  T extends { data?: Record<string, unknown> | null | undefined },
>(record: T, hiddenFieldKeys: string[]): T {
  if (!hiddenFieldKeys || hiddenFieldKeys.length === 0) {
    return { ...record, data: { ...(record.data ?? {}) } };
  }
  const drop = new Set(hiddenFieldKeys);
  const nextData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record.data ?? {})) {
    if (!drop.has(k)) nextData[k] = v;
  }
  return { ...record, data: nextData };
}

/* -------------------------------------------------------------------------- */
/* Write-side helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Given the keys a write touches, return the subset that the `role` may NOT
 * write — i.e. keys whose effective access is `readonly` OR `hidden`. An empty
 * result means the write is allowed by FLS. Pure + deterministic.
 *
 * A write that names a `hidden` field is also blocked (you cannot edit what you
 * cannot see); a `readonly` field is blocked on write but readable.
 */
export function blockedWriteFields(
  policies: FlsPolicy[],
  role: string,
  patchKeys: string[],
): string[] {
  const blocked: string[] = [];
  for (const key of patchKeys) {
    const access = effectiveAccess(policies, role, key);
    if (access === 'readonly' || access === 'hidden') blocked.push(key);
  }
  return blocked;
}
