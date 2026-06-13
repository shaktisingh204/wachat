import { NextResponse } from "next/server";

import {
  ensureStandardObjects,
  getObject,
} from "@/lib/sabcrm/objects.server";
import {
  createRecord,
  updateRecord,
  deleteRecord,
} from "@/lib/sabcrm/records.server";
import { ensureSabcrmIndexes } from "@/lib/sabcrm/db";
import { verifyApiKey } from "@/lib/sabcrm/apikeys.server";
import {
  assertWithinRecordLimit,
  SabcrmLimitError,
} from "@/lib/sabcrm/limits.server";
import {
  checkRateLimit,
  logApiCall,
  rateLimitHeaders,
  isBulkOp,
  MAX_BULK_BATCH,
  type BulkOp,
  type RateLimitVerdict,
} from "@/lib/sabcrm/api-logs.server";

/**
 * SabCRM — public REST bulk API (headless, API-key authenticated).
 *
 * `POST /api/sabcrm/:objectSlug/bulk`
 *
 *   { "op": "create" | "update" | "delete", "records": [ … ] }
 *
 *   - create: each element is a field-value map (or `{ data: {...} }`).
 *   - update: each element is `{ id, data: {...} }` (or `{ id, ...fields }`).
 *   - delete: each element is an id string, or `{ id }`.
 *
 * Scope: a mutating write — the SabCRM key authenticates one `projectId`
 * (via {@link verifyApiKey}) and every operation is scoped to it, exactly as the
 * collection / single-record routes are. Records are owner-scoped by the
 * synthetic `api:<keyId>` id so the batch reaches precisely the records that key
 * owns.
 *
 * Bounded by design:
 *   - The batch is capped at {@link MAX_BULK_BATCH} elements (`413` otherwise).
 *   - A `create` batch is pre-checked against the project's plan record cap as a
 *     whole (`402` if it would overflow) so we never half-import past a limit.
 *
 * Partial success: each element is applied independently and the response
 * reports a per-element `results[]` plus a `summary` of succeeded/failed counts,
 * so one bad row never fails the whole batch. The HTTP status is `200` when at
 * least one element succeeded, `422` when every element failed.
 *
 * Every response is JSON. Auth `401`; unknown object `404`; malformed body
 * `400`; oversize batch `413`; plan-cap `402`; rate limit `429`.
 */

/** Mongo driver + node:crypto in the auth path — Node.js runtime only. */
export const runtime = "nodejs";
/** Per-request auth + DB writes — never statically cached. */
export const dynamic = "force-dynamic";

/** Owner id that scopes every record reached through an API key. */
function apiOwnerId(keyId: string): string {
  return `api:${keyId}`;
}

function json(
  body: unknown,
  status = 200,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, { status, headers });
}

/** Build a 429 response from a denied rate-limit verdict. */
function rateLimited(verdict: RateLimitVerdict): NextResponse {
  return json(
    {
      error:
        "Rate limit exceeded. Slow down and retry after the window resets.",
      retryAfterSeconds: verdict.retryAfterSeconds,
    },
    429,
    rateLimitHeaders(verdict),
  );
}

/** Per-element outcome reported back to the caller. */
interface BulkItemResult {
  /** 0-based index of the element in the request `records[]`. */
  index: number;
  ok: boolean;
  /** Affected record id (create/update success, or the supplied delete id). */
  id?: string;
  /** Failure reason when `ok` is false. */
  error?: string;
}

/** Pull a `{ data }` envelope or a bare map out of one create/update element. */
function extractData(element: unknown): Record<string, unknown> | null {
  if (!element || typeof element !== "object" || Array.isArray(element)) {
    return null;
  }
  const obj = element as Record<string, unknown>;
  const values =
    "data" in obj && obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>)
      : obj;
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return null;
  }
  return values;
}

/** Pull an id out of a delete/update element (string or `{ id }`). */
function extractId(element: unknown): string | null {
  if (typeof element === "string") return element.trim() || null;
  if (element && typeof element === "object" && !Array.isArray(element)) {
    const id = (element as Record<string, unknown>).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ objectSlug: string }> },
): Promise<NextResponse> {
  const started = Date.now();
  const { objectSlug } = await params;
  const path = new URL(req.url).pathname;

  /* --- auth + object resolution --------------------------------------- */
  const auth = await verifyApiKey(req);
  if (!auth) {
    return json(
      { error: "Unauthorized: a valid SabCRM API key is required." },
      401,
    );
  }
  const projectId = auth.projectId;
  const keyId = auth.keyId;
  const ownerId = apiOwnerId(keyId);

  await Promise.all([ensureSabcrmIndexes(), ensureStandardObjects(projectId)]);

  const object = await getObject(projectId, objectSlug);
  if (!object) {
    return json({ error: `Unknown object "${objectSlug}".` }, 404);
  }

  /* --- rate limit ----------------------------------------------------- */
  const verdict = await checkRateLimit(keyId, { projectId });
  const finish = (status: number, payload: unknown): NextResponse => {
    void logApiCall({
      projectId,
      keyId,
      method: "POST",
      path,
      status,
      ms: Date.now() - started,
    });
    return json(payload, status, rateLimitHeaders(verdict));
  };
  if (!verdict.allowed) {
    void logApiCall({
      projectId,
      keyId,
      method: "POST",
      path,
      status: 429,
      ms: Date.now() - started,
    });
    return rateLimited(verdict);
  }

  /* --- body validation ------------------------------------------------ */
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return finish(400, { error: "Request body must be valid JSON." });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return finish(400, {
      error: 'Request body must be a JSON object with "op" and "records".',
    });
  }

  const { op: rawOp, records: rawRecords } = body as {
    op?: unknown;
    records?: unknown;
  };

  if (!isBulkOp(rawOp)) {
    return finish(400, {
      error: 'Field "op" must be one of "create", "update", "delete".',
    });
  }
  const op: BulkOp = rawOp;

  if (!Array.isArray(rawRecords)) {
    return finish(400, { error: 'Field "records" must be an array.' });
  }
  if (rawRecords.length === 0) {
    return finish(400, { error: '"records" must not be empty.' });
  }
  if (rawRecords.length > MAX_BULK_BATCH) {
    return finish(413, {
      error: `Batch too large: ${rawRecords.length} records (max ${MAX_BULK_BATCH}).`,
    });
  }

  /* --- plan record cap (create only, whole-batch) --------------------- */
  if (op === "create") {
    try {
      await assertWithinRecordLimit(projectId, rawRecords.length);
    } catch (err) {
      if (err instanceof SabcrmLimitError) {
        return finish(402, { error: err.message, feature: err.feature });
      }
      // Unexpected limit-check failure — surface as a server error.
      console.error("[sabcrm:api] bulk record-limit check failed:", err);
      return finish(500, { error: "Failed to verify plan limits." });
    }
  }

  /* --- per-element application ---------------------------------------- */
  const results: BulkItemResult[] = [];

  for (let index = 0; index < rawRecords.length; index += 1) {
    const element = rawRecords[index];
    try {
      if (op === "create") {
        const data = extractData(element);
        if (!data) {
          results.push({
            index,
            ok: false,
            error: "Each create element must be a JSON object of field values.",
          });
          continue;
        }
        const record = await createRecord(projectId, ownerId, objectSlug, data);
        results.push({ index, ok: true, id: record._id });
      } else if (op === "update") {
        const id = extractId(element);
        const data = extractData(element);
        if (!id) {
          results.push({
            index,
            ok: false,
            error: 'Each update element requires an "id".',
          });
          continue;
        }
        if (!data) {
          results.push({
            index,
            ok: false,
            error: "Each update element must include field values.",
          });
          continue;
        }
        const record = await updateRecord(projectId, ownerId, id, data);
        if (!record) {
          results.push({ index, ok: false, id, error: "Record not found." });
          continue;
        }
        results.push({ index, ok: true, id: record._id });
      } else {
        // delete
        const id = extractId(element);
        if (!id) {
          results.push({
            index,
            ok: false,
            error: 'Each delete element must be an id string or { "id" }.',
          });
          continue;
        }
        const removed = await deleteRecord(projectId, ownerId, id);
        if (!removed) {
          results.push({ index, ok: false, id, error: "Record not found." });
          continue;
        }
        results.push({ index, ok: true, id });
      }
    } catch (err) {
      results.push({
        index,
        ok: false,
        error:
          err instanceof Error ? err.message : "Failed to apply this element.",
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  // 200 when anything succeeded; 422 when the whole batch failed.
  const status = succeeded > 0 ? 200 : 422;

  return finish(status, {
    object: objectSlug,
    op,
    summary: { total: results.length, succeeded, failed },
    results,
  });
}
