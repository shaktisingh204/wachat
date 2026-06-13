import 'server-only';

/**
 * SabCRM — field-level security (FLS) runtime (server-only).
 *
 * Persists FLS policies in `sabcrm_fls_policies` (projectId-scoped, the
 * native-Mongo config pattern of `./scoring.server.ts` + `./sequences.server`)
 * and enforces them on the read path (strip hidden field data) and the write
 * path (reject readonly/hidden edits). The pure policy math lives in `./fls.ts`
 * and is re-exported here so callers only import from this file.
 *
 * ## DEFAULT-OFF (read this before wiring)
 *
 * FLS enforcement is gated by a PER-PROJECT flag stored in
 * `sabcrm_fls_settings` (`{ projectId, enforced }`). The flag defaults to
 * `false`, and `redactForViewer` / `assertWriteAllowed` are HARD no-ops when it
 * is off — they return the records unchanged / allow the write, byte-for-byte
 * as today. This guarantees that merely shipping this module changes nothing:
 * a project must EXPLICITLY enable enforcement (and that should only be done on
 * a running app with a security review, because turning it on can hide fields
 * and block writes that previously worked).
 *
 * ## Fail-closed direction
 *
 * Every restriction here can only NARROW access (hide fields / block writes),
 * never widen it. On a config-read error the helpers conservatively fall back
 * to the no-op (off) behaviour rather than risk hiding fields the operator did
 * not intend — i.e. when enforcement state is uncertain we behave EXACTLY as
 * today (no silent breakage), and the pure layer's conflict resolution already
 * fails toward LESS access once enforcement IS on. (See `effectiveAccess`.)
 *
 * ## Two-store gotcha (IMPORTANT)
 *
 * `redactForViewer` is designed to attach to the NATIVE-TS read path
 * (`./records.server.ts` list/get results). It does NOT automatically cover the
 * RUST read path — anything served straight from the Rust crate bypasses this
 * redaction. Wiring FLS into the Rust path is a separate, server-side task; the
 * settings UI documents this gap so an operator does not assume the Rust API is
 * also redacted. `assertWriteAllowed` likewise guards the native-TS write path
 * (`updateRecord`); Rust writes must be guarded crate-side.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  blockedWriteFields,
  hiddenFields,
  normalizePolicy,
  redactRecord,
  type FlsAccess,
  type FlsPolicy,
} from './fls';

export {
  effectiveAccess,
  visibleFields,
  hiddenFields,
  redactRecord,
  blockedWriteFields,
  normalizePolicy,
  FLS_ACCESS_LEVELS,
  FLS_ANY_ROLE,
  type FlsAccess,
  type FlsPolicy,
} from './fls';

const POLICIES_COLL = 'sabcrm_fls_policies';
const SETTINGS_COLL = 'sabcrm_fls_settings';

/** Cap on policies returned for one object (defensive bound). */
const MAX_POLICIES = 2000;

/* -------------------------------------------------------------------------- */
/* Per-project enforcement flag (DEFAULT-OFF)                                   */
/* -------------------------------------------------------------------------- */

/** Raw settings doc. */
interface FlsSettingsDoc {
  projectId: string;
  enforced?: boolean;
  updatedAt?: string;
}

/**
 * Whether FLS enforcement is ENABLED for a project. Defaults to `false`
 * (off → unchanged behaviour). On any read error returns `false` so a downed
 * config store can NEVER silently start hiding fields / blocking writes — when
 * enforcement state is uncertain we behave exactly as today.
 */
export async function isFlsEnforced(projectId: string): Promise<boolean> {
  try {
    if (!projectId) return false;
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(SETTINGS_COLL)
      .findOne({ projectId })) as FlsSettingsDoc | null;
    return doc?.enforced === true;
  } catch {
    return false;
  }
}

/** Set the per-project FLS enforcement flag (config-gated by the action). */
export async function setFlsEnforced(
  projectId: string,
  enforced: boolean,
): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection(SETTINGS_COLL)
    .updateOne(
      { projectId },
      { $set: { enforced: !!enforced, updatedAt: new Date().toISOString() } },
      { upsert: true },
    );
}

/* -------------------------------------------------------------------------- */
/* Policy CRUD                                                                  */
/* -------------------------------------------------------------------------- */

/** Raw policy doc. */
interface FlsPolicyDoc {
  _id: ObjectId | string;
  projectId: string;
  object: string;
  field: string;
  role: string;
  access: FlsAccess;
  updatedAt?: string;
}

/** Normalise a persisted doc into the API {@link FlsPolicy} (or null if junk). */
function toPolicy(doc: FlsPolicyDoc): FlsPolicy | null {
  return normalizePolicy({
    object: doc.object,
    field: doc.field,
    role: doc.role,
    access: doc.access,
  });
}

/** All FLS policies for a project (optionally narrowed to one object). */
export async function listFlsPolicies(
  projectId: string,
  objectSlug?: string,
): Promise<FlsPolicy[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const query: Record<string, unknown> = { projectId };
  if (objectSlug) query.object = objectSlug;
  const docs = (await db
    .collection(POLICIES_COLL)
    .find(query)
    .limit(MAX_POLICIES)
    .toArray()) as unknown as FlsPolicyDoc[];
  const out: FlsPolicy[] = [];
  for (const d of docs) {
    const p = toPolicy(d);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Replace the ENTIRE policy set for one (project, object) with the supplied
 * list (the matrix editor saves an object's full grid at once). Malformed rows
 * are dropped via {@link normalizePolicy}; duplicate (field, role) pairs are
 * de-duped keeping the LAST occurrence. Returns the persisted, normalised set.
 *
 * Done as a delete-then-insert inside one logical save; the object scope keeps
 * other objects' policies untouched.
 */
export async function replaceObjectFlsPolicies(
  projectId: string,
  objectSlug: string,
  policies: unknown[],
): Promise<FlsPolicy[]> {
  if (!projectId || !objectSlug) return [];
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();

  // Normalise + scope-pin + de-dup on (field, role).
  const byKey = new Map<string, FlsPolicy>();
  for (const raw of Array.isArray(policies) ? policies : []) {
    const p = normalizePolicy(raw);
    if (!p) continue;
    if (p.object !== objectSlug) continue; // hard-pin to the saved object
    byKey.set(`${p.field}::${p.role}`, p);
  }
  const clean = [...byKey.values()];

  await db.collection(POLICIES_COLL).deleteMany({ projectId, object: objectSlug });
  if (clean.length > 0) {
    await db.collection(POLICIES_COLL).insertMany(
      clean.map((p) => ({
        projectId,
        object: p.object,
        field: p.field,
        role: p.role,
        access: p.access,
        updatedAt: now,
      })),
    );
  }
  return clean;
}

/* -------------------------------------------------------------------------- */
/* Viewer-role resolution                                                       */
/* -------------------------------------------------------------------------- */

/** SabCRM capability label used as the FLS `role` key. */
export type FlsRole = 'owner' | 'admin' | 'manage' | 'view';

/**
 * Map a raw project agent-role slug onto the SabCRM capability label used as
 * the FLS `role` key. Mirrors `deriveCrmRole` in `./members.server.ts` so the
 * settings matrix and enforcement agree on role names.
 */
function deriveFlsRole(projectRole: string): FlsRole {
  const n = projectRole.toLowerCase().trim();
  if (n === 'owner') return 'owner';
  if (n === 'admin') return 'admin';
  if (n === 'manager') return 'manage';
  return 'view';
}

/**
 * Resolve a viewer's FLS role within a project by reading `projects` directly:
 * the project owner → `owner`; an agent → their mapped capability; an unknown
 * user → the MOST RESTRICTIVE role (`view`) so a stranger never gets a
 * permissive role by accident (fail-closed). Self-contained (no live session),
 * so it works for any `viewerUserId`. On error returns `view`.
 */
export async function resolveViewerFlsRole(
  projectId: string,
  viewerUserId: string,
): Promise<FlsRole> {
  try {
    if (!projectId || !viewerUserId || !ObjectId.isValid(projectId)) {
      return 'view';
    }
    const { db } = await connectToDatabase();
    const project = (await db
      .collection('projects')
      .findOne(
        { _id: new ObjectId(projectId) },
        { projection: { userId: 1, agents: 1 } },
      )) as { userId?: unknown; agents?: Array<{ userId?: unknown; role?: string }> } | null;
    if (!project) return 'view';

    const ownerHex =
      project.userId instanceof ObjectId
        ? project.userId.toHexString()
        : String(project.userId ?? '');
    if (ownerHex && ownerHex === String(viewerUserId)) return 'owner';

    for (const a of project.agents ?? []) {
      if (!a?.userId) continue;
      const hex =
        a.userId instanceof ObjectId
          ? a.userId.toHexString()
          : String(a.userId);
      if (hex === String(viewerUserId)) return deriveFlsRole(a.role ?? 'agent');
    }
    return 'view';
  } catch {
    return 'view';
  }
}

/* -------------------------------------------------------------------------- */
/* Enforcement — read path                                                      */
/* -------------------------------------------------------------------------- */

/** Minimal record shape the read-path redactor needs. */
type RedactableRecord = { data?: Record<string, unknown> | null | undefined };

/**
 * Strip FLS-hidden field data from a batch of records for a given viewer.
 *
 * **DEFAULT-OFF:** returns the input array UNCHANGED unless the project's FLS
 * enforcement flag is on AND there is at least one `hidden` policy for the
 * viewer's role on this object. Owners are never redacted (they manage the
 * config). Best-effort: any failure returns the records unchanged so a config
 * problem can never blank out a list — it fails toward MORE visibility for the
 * read (the opposite for writes, see {@link assertWriteAllowed}). This is the
 * safe direction for a default-off feature: it cannot silently break reads.
 *
 * NOTE (two-store gotcha): this only redacts records flowing through the
 * native-TS read path. Records served by the Rust crate are NOT covered.
 */
export async function redactForViewer<T extends RedactableRecord>(
  projectId: string,
  object: string,
  viewerUserId: string,
  records: T[],
): Promise<T[]> {
  try {
    if (!Array.isArray(records) || records.length === 0) return records;
    if (!(await isFlsEnforced(projectId))) return records; // OFF → unchanged

    const role = await resolveViewerFlsRole(projectId, viewerUserId);
    if (role === 'owner') return records; // owners see everything

    const policies = await listFlsPolicies(projectId, object);
    if (policies.length === 0) return records;

    // Collect every field key that appears in any record's data, plus every
    // field named by a policy, so a hidden key is stripped even if a record
    // happens not to declare every field.
    const allKeys = new Set<string>();
    for (const p of policies) allKeys.add(p.field);
    for (const r of records) {
      for (const k of Object.keys(r.data ?? {})) allKeys.add(k);
    }
    const hidden = hiddenFields(policies, role, [...allKeys]);
    if (hidden.length === 0) return records;

    return records.map((r) => redactRecord(r, hidden));
  } catch {
    return records; // best-effort — never blank a read on a config error
  }
}

/** Single-record convenience wrapper around {@link redactForViewer}. */
export async function redactOneForViewer<T extends RedactableRecord>(
  projectId: string,
  object: string,
  viewerUserId: string,
  record: T,
): Promise<T> {
  const [out] = await redactForViewer(projectId, object, viewerUserId, [record]);
  return out ?? record;
}

/* -------------------------------------------------------------------------- */
/* Enforcement — write path                                                     */
/* -------------------------------------------------------------------------- */

/** Result of a write-side FLS check. */
export interface FlsWriteCheck {
  /** True when the write is permitted (always true when FLS is off). */
  allowed: boolean;
  /** Field keys in the patch the viewer may not write (readonly/hidden). */
  blocked: string[];
}

/**
 * Assert that a viewer may write every field key present in `patch` for an
 * object.
 *
 * **DEFAULT-OFF:** returns `{ allowed: true, blocked: [] }` unless the
 * project's FLS enforcement flag is on. When ON and the patch touches a
 * `readonly` / `hidden` field for the viewer's role, returns
 * `{ allowed: false, blocked: [...] }` — the write path should reject the
 * mutation. Owners always pass.
 *
 * **Fail-CLOSED for writes:** if enforcement IS on but the policy read throws,
 * this BLOCKS the write (returns `allowed: false`) rather than letting an
 * unguarded edit through — the conservative direction for a mutation once a
 * project has explicitly opted into enforcement.
 *
 * NOTE (two-store gotcha): this guards the native-TS write path only. Rust
 * writes must be guarded crate-side.
 */
export async function assertWriteAllowed(
  projectId: string,
  object: string,
  viewerUserId: string,
  patch: Record<string, unknown>,
): Promise<FlsWriteCheck> {
  // OFF → always allowed (no behaviour change). Resolved first and outside the
  // try so the off-path can never fail-close.
  let enforced = false;
  try {
    enforced = await isFlsEnforced(projectId);
  } catch {
    enforced = false; // uncertain state ⇒ behave as today (off)
  }
  if (!enforced) return { allowed: true, blocked: [] };

  const patchKeys = Object.keys(patch ?? {}).filter(
    (k) => !k.startsWith('__'), // never gate reserved envelope keys
  );
  if (patchKeys.length === 0) return { allowed: true, blocked: [] };

  try {
    const role = await resolveViewerFlsRole(projectId, viewerUserId);
    if (role === 'owner') return { allowed: true, blocked: [] };
    const policies = await listFlsPolicies(projectId, object);
    const blocked = blockedWriteFields(policies, role, patchKeys);
    return { allowed: blocked.length === 0, blocked };
  } catch {
    // Enforcement is ON but we couldn't evaluate — fail CLOSED for the write.
    return { allowed: false, blocked: patchKeys };
  }
}
