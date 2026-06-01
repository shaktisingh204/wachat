import { NextResponse } from "next/server";

import {
  ensureStandardObjects,
  getObject,
} from "@/lib/sabcrm/objects.server";
import {
  createRecord,
  listRecords,
  type FilterCondition,
  type RecordQueryExtended,
  type SortKey,
} from "@/lib/sabcrm/records.server";
import { ensureSabcrmIndexes } from "@/lib/sabcrm/db";
import { verifyApiKey } from "@/lib/sabcrm/apikeys.server";
import { assertWithinRecordLimit, SabcrmLimitError } from "@/lib/sabcrm/limits.server";

/**
 * SabCRM — public REST record API (headless, API-key authenticated).
 *
 * `GET  /api/sabcrm/:objectSlug` — list records of one object.
 * `POST /api/sabcrm/:objectSlug` — create a record on one object.
 *
 * This is the headless counterpart to the in-app server actions in
 * `src/app/actions/sabcrm.actions.ts`. Where those resolve a tenant from the
 * session-cookie + RBAC pipeline (`gate()`), this route resolves the tenant
 * from a SabCRM API key via {@link verifyApiKey}: the key authenticates exactly
 * one `projectId`, and every query below is scoped to it — mirroring how the
 * actions scope to `gate().ctx.projectId`.
 *
 * Owner scope
 * -----------
 * The generic record runtime ({@link listRecords} / {@link createRecord}) is
 * additionally owner-scoped by `userId` (it mirrors the rest of SabNode's CRM).
 * An API key has no session user, so we derive a stable synthetic owner id from
 * the authenticating key — `api:<keyId>`. This keeps tenant + owner scoping
 * fully intact and ensures records created through a key round-trip cleanly
 * through this route's list/get (the owner is constant per key). It never
 * impersonates a real tenant user.
 *
 * Every response is JSON. Auth failures are `401`; unknown objects `404`;
 * malformed input `400`; plan-cap rejections `402`; everything else `500`.
 */

/** Runs on the Node.js runtime (Mongo driver + node:crypto in the auth path). */
export const runtime = "nodejs";
/** Per-request auth + DB reads — never statically cached. */
export const dynamic = "force-dynamic";

/** Hard ceiling on page size for the public API (matches the runtime cap). */
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 30;

/** The recognised typed filter operators (kept in sync with records.server). */
const FILTER_OPERATORS = new Set<FilterCondition["op"]>([
  "eq",
  "neq",
  "contains",
  "notContains",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "notIn",
  "isEmpty",
  "isNotEmpty",
]);

/** Owner id that scopes every record reached through an API key. */
function apiOwnerId(keyId: string): string {
  return `api:${keyId}`;
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

/** Coerce a `?page=` / `?pageSize=` query value into a positive integer. */
function parseIntParam(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Build a {@link RecordQueryExtended} from URL search params.
 *
 * Supported params:
 *   - `page`, `pageSize` — pagination (pageSize clamped to {@link MAX_PAGE_SIZE}).
 *   - `search`           — free-text search across the object's text fields.
 *   - `sortBy`,`sortDir` — single-key sort (`asc` | `desc`, default `desc`).
 *   - `filter[<field>]=<value>`            — legacy exact-match filter.
 *   - `where[<field>][<op>]=<value>`       — typed condition (op ∈ FILTER_OPERATORS).
 *
 * `in` / `notIn` values may be comma-separated to express a list.
 */
function buildQuery(
  objectSlug: string,
  params: URLSearchParams,
): RecordQueryExtended {
  const query: RecordQueryExtended = { object: objectSlug };

  const page = parseIntParam(params.get("page"));
  if (page) query.page = page;

  const pageSize = parseIntParam(params.get("pageSize"));
  query.pageSize = Math.min(pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const search = params.get("search");
  if (search && search.trim()) query.search = search.trim();

  const sortBy = params.get("sortBy");
  if (sortBy) {
    const dir = params.get("sortDir") === "asc" ? "asc" : "desc";
    const sort: SortKey[] = [{ field: sortBy, dir }];
    query.sort = sort;
  }

  // Legacy exact-match filters: filter[<field>]=<value>
  const filters: Record<string, unknown> = {};
  // Typed conditions: where[<field>][<op>]=<value>
  const conditions: FilterCondition[] = [];

  for (const [rawKey, value] of params.entries()) {
    const filterMatch = /^filter\[([^\]]+)\]$/.exec(rawKey);
    if (filterMatch?.[1]) {
      filters[filterMatch[1]] = value;
      continue;
    }
    const whereMatch = /^where\[([^\]]+)\]\[([^\]]+)\]$/.exec(rawKey);
    if (whereMatch?.[1] && whereMatch[2]) {
      const field = whereMatch[1];
      const op = whereMatch[2] as FilterCondition["op"];
      if (!FILTER_OPERATORS.has(op)) continue;
      if (op === "isEmpty" || op === "isNotEmpty") {
        conditions.push({ field, op });
      } else if (op === "in" || op === "notIn") {
        conditions.push({
          field,
          op,
          value: value.split(",").map((v) => v.trim()).filter(Boolean),
        });
      } else {
        conditions.push({ field, op, value });
      }
    }
  }

  if (Object.keys(filters).length > 0) query.filters = filters;
  if (conditions.length > 0) query.conditions = conditions;

  return query;
}

/**
 * Resolve auth + the requested object, shared by both verbs. Returns either a
 * ready-to-use context (project + owner + object metadata) or a JSON error
 * response to short-circuit with.
 */
async function resolveContext(
  req: Request,
  objectSlug: string,
): Promise<
  | { ok: true; projectId: string; ownerId: string }
  | { ok: false; response: NextResponse }
> {
  const auth = await verifyApiKey(req);
  if (!auth) {
    return {
      ok: false,
      response: json(
        { error: "Unauthorized: a valid SabCRM API key is required." },
        401,
      ),
    };
  }

  // Make sure the object catalogue + indexes exist for this tenant before we
  // touch records (idempotent; mirrors the action layer's seed-then-query).
  await Promise.all([
    ensureSabcrmIndexes(),
    ensureStandardObjects(auth.projectId),
  ]);

  const object = await getObject(auth.projectId, objectSlug);
  if (!object) {
    return {
      ok: false,
      response: json(
        { error: `Unknown object "${objectSlug}".` },
        404,
      ),
    };
  }

  return {
    ok: true,
    projectId: auth.projectId,
    ownerId: apiOwnerId(auth.keyId),
  };
}

/* -------------------------------------------------------------------------- */
/* GET — list records                                                         */
/* -------------------------------------------------------------------------- */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ objectSlug: string }> },
): Promise<NextResponse> {
  const { objectSlug } = await params;

  const ctx = await resolveContext(req, objectSlug);
  if (!ctx.ok) return ctx.response;

  try {
    const url = new URL(req.url);
    const query = buildQuery(objectSlug, url.searchParams);

    const data = await listRecords(ctx.projectId, ctx.ownerId, query);

    return json({
      object: objectSlug,
      records: data.records,
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
    });
  } catch (err) {
    console.error("[sabcrm:api] GET records failed:", objectSlug, err);
    const message =
      err instanceof Error ? err.message : "Failed to list records.";
    return json({ error: message }, 500);
  }
}

/* -------------------------------------------------------------------------- */
/* POST — create a record                                                     */
/* -------------------------------------------------------------------------- */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ objectSlug: string }> },
): Promise<NextResponse> {
  const { objectSlug } = await params;

  const ctx = await resolveContext(req, objectSlug);
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  // Accept both `{ data: {...} }` and a bare field map for ergonomics.
  const values =
    body && typeof body === "object" && "data" in body
      ? (body as { data: unknown }).data
      : body;

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return json(
      { error: "Request body must be a JSON object of field values." },
      400,
    );
  }

  try {
    // Enforce the per-plan record cap before inserting (mirrors the action
    // layer's createRecordAction guard).
    await assertWithinRecordLimit(ctx.projectId);

    const record = await createRecord(
      ctx.projectId,
      ctx.ownerId,
      objectSlug,
      values as Record<string, unknown>,
    );

    return json({ object: objectSlug, record }, 201);
  } catch (err) {
    if (err instanceof SabcrmLimitError) {
      return json({ error: err.message, feature: err.feature }, 402);
    }
    console.error("[sabcrm:api] POST record failed:", objectSlug, err);
    const message =
      err instanceof Error ? err.message : "Failed to create record.";
    return json({ error: message }, 500);
  }
}
