'use server';

/**
 * SabCRM — AI server actions (Intelligence spec, `docs/sabcrm/rnd/intelligence.md`).
 *
 * Part A: `recomputeAiFieldTw` — on-demand recompute of one AI computed field
 * (`FieldType: 'AI'`) on one record via the shared evaluator
 * (`@/lib/sabcrm/ai-fields.server`). Unlike the scheduler pass it ignores
 * inputs-hash equality (a manual recompute always re-runs the LLM and clears
 * a `failed` entry).
 *
 * Part B: `nlToFilterTw` — natural language → canonical {@link FilterGroup}
 * tree. The user's query plus a field catalogue go to the LLM; the JSON reply
 * is validated leaf-by-leaf ("validate, never trust" — see
 * `nlFilterFromModelJson` in the record-surface adapter) and returned for the
 * ViewBar Filter popover to load into its DRAFT. It is never auto-applied —
 * the user reviews the tree and commits through the existing Apply path.
 *
 * Pipeline per action (the standard SaaS plumbing):
 *
 *   1. `gate()` — session → project membership → RBAC
 *      (`canServer('sabcrm', …)`) → plan, copied verbatim from
 *      `sabcrm-twenty.actions.ts`.
 *   2. `canUse(userId, 'ai_requests')` entitlement gate; `recordUsage` with a
 *      deterministic idempotency key on success (sabsheet-ai precedent). The
 *      acting USER is the metered tenant here; the scheduler pass bills the
 *      project owner instead (intelligence.md "billing identity" note).
 *   3. Honest degradation: when no AI provider key is configured
 *      `generateSabcrmText` returns `{ ok:false, error:'AI is not
 *      configured…' }` — we never fabricate a value or a filter.
 */

import { createHash } from 'crypto';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmObjectsApi,
  type ObjectMetadata as SabcrmRustObjectMetadata,
  type SabcrmFieldMetadata,
} from '@/lib/rust-client/sabcrm-objects';
import { canUse } from '@/lib/billing/entitlements';
import { recordUsage } from '@/lib/billing/usage-meter';
import { aiFieldConfig, type ActionResult } from '@/lib/sabcrm/types';
import { generateSabcrmText } from '@/lib/sabcrm/ai-llm.server';
import {
  aiSourceFields,
  aiSourceValue,
  aiInputsHash,
  evaluateAiField,
} from '@/lib/sabcrm/ai-fields.server';
import type { FilterGroup } from '@/components/sabcrm/20ui/composites/record';
import { nlFilterFromModelJson } from '@/app/sabcrm/[objectSlug]/record-surface-adapter';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-twenty.actions.ts` verbatim, including the cross-tenant
 * defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user
  // (the shared RBAC resolver fails open for non-members; deny instead).
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into an error result. */
function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

// ---------------------------------------------------------------------------
// Part A — manual recompute of an AI computed field
// ---------------------------------------------------------------------------

/** Mongo collection holding CRM records (the records crate's collection). */
const RECORDS_COLL = 'sabcrm_records';

/**
 * Recompute one AI field on one record, on demand (spec §A6).
 *
 * Pipeline: `gate('edit')` → `canUse(userId, 'ai_requests')` → load the
 * merged object via the Rust path (two-store gotcha) → `aiFieldConfig` →
 * load the record doc from Mongo → compute the inputs hash → `evaluateAiField`
 * (always recomputes — hash equality is ignored on the manual path) →
 * `recordUsage` → return the new value.
 */
export async function recomputeAiFieldTw(
  objectSlug: string,
  recordId: string,
  fieldKey: string,
  projectId?: string,
): Promise<ActionResult<{ value: unknown; computedAt: string }>> {
  if (!objectSlug || !recordId || !fieldKey) {
    return { ok: false, error: 'Object, record and field are required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  // The acting user is the metered tenant (sabsheet-ai precedent).
  const allowed = await canUse(g.ctx.userId, 'ai_requests');
  if (!allowed) return { ok: false, error: 'AI quota exceeded.' };

  try {
    const object = await sabcrmObjectsApi.get(objectSlug, g.ctx.projectId);
    const field = object.fields.find((f) => f.key === fieldKey);
    if (!field) return { ok: false, error: `Unknown field "${fieldKey}".` };
    const cfg = aiFieldConfig(field);
    if (!cfg) {
      return { ok: false, error: 'This field has no AI configuration.' };
    }

    // The record doc straight from Mongo — the evaluator writes the same way
    // (dotted `$set` on data.<key> / data.__ai.<key>, no `updatedAt` bump).
    if (!ObjectId.isValid(recordId)) {
      return { ok: false, error: 'Invalid record id.' };
    }
    const { db } = await connectToDatabase();
    const record = (await db.collection(RECORDS_COLL).findOne({
      _id: new ObjectId(recordId),
      projectId: g.ctx.projectId,
    })) as { data?: Record<string, unknown>; deletedAt?: unknown } | null;
    if (!record || record.deletedAt) {
      return { ok: false, error: 'Record not found.' };
    }

    // Inputs hash — stored on the meta so the scheduler sees the row in sync.
    const data = record.data ?? {};
    const keys = new Set<string>(object.fields.map((f) => f.key));
    for (const k of Object.keys(data)) {
      if (k !== '__ai') keys.add(k);
    }
    const sources = aiSourceFields(cfg.prompt, keys);
    const values: Record<string, unknown> = {};
    for (const token of sources) values[token] = aiSourceValue(data, token);
    const hash = aiInputsHash(cfg.prompt, values);

    const result = await evaluateAiField({
      db,
      projectId: g.ctx.projectId,
      objectSlug,
      field,
      recordId,
      inputsHash: hash,
    });

    if (result.status !== 'ready') {
      return {
        ok: false,
        error: result.detail ?? 'AI could not compute a value.',
      };
    }

    try {
      await recordUsage({
        tenantId: g.ctx.userId,
        feature: 'ai_requests',
        units: 1,
        idempotencyKey: `sabcrm-ai-field:manual:${recordId}:${fieldKey}:${Date.now()}`,
        meta: { feature: 'sabcrm', op: 'aiFieldManual', object: objectSlug },
      });
    } catch (e) {
      // Metering must never block a successful result.
      console.error('[sabcrm-ai] recordUsage failed for recomputeAiFieldTw:', e);
    }

    return {
      ok: true,
      data: { value: result.value, computedAt: new Date().toISOString() },
    };
  } catch (e) {
    return fail(e, 'Failed to recompute the field.');
  }
}

// ---------------------------------------------------------------------------
// Part B — natural-language filtering
// ---------------------------------------------------------------------------

export interface NlFilterResult {
  /** Validated, pruned, ready for the Filter popover's `setDraft`. */
  group: FilterGroup;
  /** Model notes for parts it could not express (shown muted in the popover). */
  unresolved?: string;
}

const NL_FILTER_SYSTEM =
  'You translate a natural-language request into a JSON filter for a CRM ' +
  'object. Reply with ONLY minified JSON, no markdown.';

const NL_QUERY_MAX = 500;

/** Serialise one catalogue field as `key | label | type | options(value:label)…`. */
function catalogueLine(f: SabcrmFieldMetadata): string {
  const opts = (f.options ?? [])
    .map((o) => `${o.value}:${o.label}`)
    .join(', ');
  return `${f.key} | ${f.label} | ${f.type}${opts ? ` | options: ${opts}` : ''}`;
}

/** Build the user prompt: catalogue, date anchor, operator vocabulary, schema, examples, query. */
function buildNlPrompt(fields: SabcrmFieldMetadata[], query: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    'CRM object fields (key | label | type | options):',
    ...fields.map(catalogueLine),
    '',
    `Today's date: ${today} (resolve relative dates like "last month" to literal YYYY-MM-DD bounds).`,
    '',
    'Operators, by field type:',
    '- TEXT, EMAIL, PHONE, LINK: contains, eq, ne, isEmpty, isNotEmpty',
    '- NUMBER, NUMERIC, CURRENCY, RATING: eq, ne, gt, lt, gte, lte, isEmpty, isNotEmpty',
    '- DATE, DATE_TIME: eq, ne, gt, lt, gte, lte, isEmpty, isNotEmpty (values are YYYY-MM-DD strings)',
    '- SELECT, MULTI_SELECT, BOOLEAN: eq, ne, isEmpty, isNotEmpty (SELECT values MUST be the option value, never the label)',
    '- every other type: eq, ne, isEmpty, isNotEmpty',
    'isEmpty/isNotEmpty take no "value"; every other op requires a string "value".',
    '',
    'Reply with ONLY minified JSON matching this schema (groups nest at most 3 deep):',
    '{"op":"and"|"or","conditions":[{"fieldKey":string,"op":string,"value"?:string} | <nested group>],"unresolved"?:string}',
    'Put anything you cannot express into the optional top-level "unresolved" string.',
    '',
    'Example 1 — "deals created last month" (today 2026-06-12):',
    '{"op":"and","conditions":[{"fieldKey":"createdAt","op":"gte","value":"2026-05-01"},{"fieldKey":"createdAt","op":"lte","value":"2026-05-31"}]}',
    '',
    'Example 2 — "open enterprise accounts" where stage is a SELECT with options open:Open, closed:Closed and tier is a SELECT with options ent:Enterprise, smb:SMB (labels map to option VALUES):',
    '{"op":"and","conditions":[{"fieldKey":"stage","op":"eq","value":"open"},{"fieldKey":"tier","op":"eq","value":"ent"}]}',
    '',
    `Request: ${query}`,
  ].join('\n');
}

/**
 * Natural language → validated {@link FilterGroup} for the active object.
 *
 * The result lands in the ViewBar Filter popover's DRAFT for user review —
 * this action never applies a filter itself.
 */
export async function nlToFilterTw(
  objectSlug: string,
  query: string,
  projectId?: string,
): Promise<ActionResult<NlFilterResult>> {
  // 1. gate
  const g = await gate('view', projectId);
  if (!g.ok) return g;

  const q = (query ?? '').trim();
  if (!q) return { ok: false, error: 'Describe the filter you want.' };
  if (q.length > NL_QUERY_MAX) {
    return { ok: false, error: `Query too long (max ${NL_QUERY_MAX} characters).` };
  }

  // 2. AI entitlement (the acting user is the metered tenant — sabsheet parity)
  const allowed = await canUse(g.ctx.userId, 'ai_requests');
  if (!allowed) return { ok: false, error: 'AI quota exceeded.' };

  // 3. field catalogue (filterableFields rule: RELATION/FILE excluded)
  let object: SabcrmRustObjectMetadata;
  try {
    object = await sabcrmObjectsApi.get(objectSlug, g.ctx.projectId);
  } catch (e) {
    return fail(e, 'Could not load the object.');
  }
  const fields = (object.fields ?? []).filter(
    (f) => f.type !== 'RELATION' && f.type !== 'FILE',
  );
  if (fields.length === 0) {
    return { ok: false, error: 'This object has no filterable fields.' };
  }

  // 4. LLM (shared ladder: gateway → Anthropic direct → OpenAI direct →
  // honest "AI is not configured")
  const llm = await generateSabcrmText({
    system: NL_FILTER_SYSTEM,
    prompt: buildNlPrompt(fields, q),
  });
  if (!llm.ok) return { ok: false, error: llm.error };

  // 5. validate, never trust
  const parsed = nlFilterFromModelJson(
    llm.text,
    fields.map((f) => ({ key: f.key, type: f.type, options: f.options })),
  );
  if (!parsed) {
    return { ok: false, error: 'Could not turn that into a filter.' };
  }

  // 6. meter (deterministic key — a retried submit is not double-billed)
  try {
    await recordUsage({
      tenantId: g.ctx.userId,
      feature: 'ai_requests',
      units: 1,
      idempotencyKey: createHash('sha256')
        .update(`sabcrm-nl-filter:${objectSlug}:${q}`)
        .digest('hex'),
      meta: { feature: 'sabcrm', op: 'nlFilter', object: objectSlug },
    });
  } catch (e) {
    // Metering must never block a successful result.
    console.error('[sabcrm-ai] recordUsage failed for nlToFilterTw:', e);
  }

  return {
    ok: true,
    data: { group: parsed.group, unresolved: parsed.unresolved },
  };
}
