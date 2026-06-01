import { NextResponse } from "next/server";

import {
  ensureStandardObjects,
  getObject,
} from "@/lib/sabcrm/objects.server";
import {
  getRecord,
  updateRecord,
  deleteRecord,
} from "@/lib/sabcrm/records.server";
import { ensureSabcrmIndexes } from "@/lib/sabcrm/db";
import { verifyApiKey } from "@/lib/sabcrm/apikeys.server";
import { logRecordAudit } from "@/lib/sabcrm/audit.server";
import { emitSabcrmEvent } from "@/lib/sabcrm/events.server";
import type { CrmRecord, ObjectMetadata } from "@/lib/sabcrm/types";

/**
 * SabCRM — public REST single-record API (headless, API-key authenticated).
 *
 * `GET    /api/sabcrm/:objectSlug/:recordId` — fetch one record (with its label).
 * `PATCH  /api/sabcrm/:objectSlug/:recordId` — patch a record's field values.
 * `DELETE /api/sabcrm/:objectSlug/:recordId` — delete a record.
 *
 * This is the single-record counterpart to the collection route in
 * `./route.ts` and to the in-app server actions in
 * `src/app/actions/sabcrm.actions.ts`. Where the actions resolve a tenant from
 * the session-cookie + RBAC pipeline (`gate()`), this route resolves the tenant
 * from a SabCRM API key via {@link verifyApiKey}: the key authenticates exactly
 * one `projectId`, and every query below is scoped to it — mirroring how the
 * actions scope to `gate().ctx.projectId`.
 *
 * Owner scope
 * -----------
 * The generic record runtime ({@link getRecord} / {@link updateRecord} /
 * {@link deleteRecord}) is additionally owner-scoped by `userId` (it mirrors
 * the rest of SabNode's CRM). An API key has no session user, so — exactly as
 * the collection route does — we derive a stable synthetic owner id from the
 * authenticating key (`api:<keyId>`). Records created through a key carry that
 * constant owner, so this route reaches precisely the records that key created;
 * it never impersonates a real tenant user and cannot cross owner boundaries.
 *
 * Cross-cutting effects (audit + domain events) are best-effort and fired
 * `void` so a slow/failing side channel never unwinds the data write; they are
 * attributed to the authenticating key (`api:<keyId>`).
 *
 * Every response is JSON. Auth failures are `401`; unknown objects / missing
 * records `404`; malformed input `400`; everything else `500`.
 */

/** Runs on the Node.js runtime (Mongo driver + node:crypto in the auth path). */
export const runtime = "nodejs";
/** Per-request auth + DB reads — never statically cached. */
export const dynamic = "force-dynamic";

/** Owner id that scopes every record reached through an API key. */
function apiOwnerId(keyId: string): string {
  return `api:${keyId}`;
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

/** Authenticated, object-resolved context shared by all three verbs. */
interface RouteContext {
  projectId: string;
  ownerId: string;
  /** The authenticating key's id — used as the audit/event actor. */
  keyId: string;
  object: ObjectMetadata;
}

/**
 * Resolve auth + the requested object, shared by every verb. Returns either a
 * ready-to-use context or a JSON error response to short-circuit with. Mirrors
 * the collection route's `resolveContext` so both surfaces behave identically.
 */
async function resolveContext(
  req: Request,
  objectSlug: string,
): Promise<
  | { ok: true; ctx: RouteContext }
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

  // Ensure the object catalogue + indexes exist for this tenant before we touch
  // records (idempotent; mirrors the action layer's seed-then-query).
  await Promise.all([
    ensureSabcrmIndexes(),
    ensureStandardObjects(auth.projectId),
  ]);

  const object = await getObject(auth.projectId, objectSlug);
  if (!object) {
    return {
      ok: false,
      response: json({ error: `Unknown object "${objectSlug}".` }, 404),
    };
  }

  return {
    ok: true,
    ctx: {
      projectId: auth.projectId,
      ownerId: apiOwnerId(auth.keyId),
      keyId: auth.keyId,
      object,
    },
  };
}

/**
 * Guards that the `:recordId` actually belongs to the `:objectSlug` in the
 * path. The record runtime resolves a record by id alone (scoped to
 * project + owner), so a caller could otherwise read/patch/delete a record of a
 * different object through a mismatched URL. We reject that with `404` so the
 * object slug in the URL is authoritative.
 */
function recordMatchesObject(
  record: { object: string },
  objectSlug: string,
): boolean {
  return record.object === objectSlug;
}

/* -------------------------------------------------------------------------- */
/* GET — fetch one record                                                     */
/* -------------------------------------------------------------------------- */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ objectSlug: string; recordId: string }> },
): Promise<NextResponse> {
  const { objectSlug, recordId } = await params;

  const resolved = await resolveContext(req, objectSlug);
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  try {
    const record = await getRecord(ctx.projectId, ctx.ownerId, recordId);
    if (!record || !recordMatchesObject(record, objectSlug)) {
      return json({ error: "Record not found." }, 404);
    }

    return json({ object: objectSlug, record });
  } catch (err) {
    console.error(
      "[sabcrm:api] GET record failed:",
      objectSlug,
      recordId,
      err,
    );
    const message =
      err instanceof Error ? err.message : "Failed to load record.";
    return json({ error: message }, 500);
  }
}

/* -------------------------------------------------------------------------- */
/* PATCH — update a record's field values                                     */
/* -------------------------------------------------------------------------- */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ objectSlug: string; recordId: string }> },
): Promise<NextResponse> {
  const { objectSlug, recordId } = await params;

  const resolved = await resolveContext(req, objectSlug);
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  // Accept both `{ data: {...} }` and a bare field map, mirroring POST on the
  // collection route.
  const patch =
    body && typeof body === "object" && "data" in body
      ? (body as { data: unknown }).data
      : body;

  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return json(
      { error: "Request body must be a JSON object of field values." },
      400,
    );
  }

  try {
    // Confirm the record exists for this object before patching so a mismatched
    // slug or a foreign record can never be touched. `updateRecord` re-checks
    // existence under the same project+owner scope; this also lets us 404 with
    // a precise message and skip a write when nothing matches.
    const existing = await getRecord(ctx.projectId, ctx.ownerId, recordId);
    if (!existing || !recordMatchesObject(existing, objectSlug)) {
      return json({ error: "Record not found." }, 404);
    }

    // The record runtime drops unknown keys (sanitiseData) and shallow-merges
    // declared field keys, so the patch is validated against the object schema.
    const record: CrmRecord | null = await updateRecord(
      ctx.projectId,
      ctx.ownerId,
      recordId,
      patch as Record<string, unknown>,
    );
    if (!record) return json({ error: "Record not found." }, 404);

    const changedFields = Object.keys(patch as Record<string, unknown>);

    void logRecordAudit(
      {
        tenantUserId: ctx.ownerId,
        projectId: ctx.projectId,
        actor: ctx.ownerId,
      },
      "update",
      record.object,
      record._id,
      {
        reason: `Updated ${record.object} record via API key`,
        diff: Object.fromEntries(
          Object.entries(patch as Record<string, unknown>).map(([k, v]) => [
            k,
            { after: v },
          ]),
        ),
      },
    );

    void emitSabcrmEvent(ctx.projectId, "record.updated", {
      tenantUserId: ctx.ownerId,
      objectSlug: record.object,
      recordId: record._id,
      record: record as Record<string, unknown>,
      changedFields,
    });

    return json({ object: objectSlug, record });
  } catch (err) {
    console.error(
      "[sabcrm:api] PATCH record failed:",
      objectSlug,
      recordId,
      err,
    );
    const message =
      err instanceof Error ? err.message : "Failed to update record.";
    return json({ error: message }, 500);
  }
}

/* -------------------------------------------------------------------------- */
/* DELETE — remove a record                                                   */
/* -------------------------------------------------------------------------- */

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ objectSlug: string; recordId: string }> },
): Promise<NextResponse> {
  const { objectSlug, recordId } = await params;

  const resolved = await resolveContext(req, objectSlug);
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  try {
    // Resolve first so we can (a) confirm the slug matches and (b) attribute the
    // audit/event with the record's object even though the row is then gone.
    const existing = await getRecord(ctx.projectId, ctx.ownerId, recordId);
    if (!existing || !recordMatchesObject(existing, objectSlug)) {
      return json({ error: "Record not found." }, 404);
    }

    const deleted = await deleteRecord(ctx.projectId, ctx.ownerId, recordId);
    if (!deleted) return json({ error: "Record not found." }, 404);

    void logRecordAudit(
      {
        tenantUserId: ctx.ownerId,
        projectId: ctx.projectId,
        actor: ctx.ownerId,
      },
      "delete",
      existing.object,
      recordId,
      { reason: `Deleted ${existing.object} record ${recordId} via API key` },
    );

    void emitSabcrmEvent(ctx.projectId, "record.deleted", {
      tenantUserId: ctx.ownerId,
      objectSlug: existing.object,
      recordId,
    });

    return json({ object: objectSlug, id: recordId, deleted: true });
  } catch (err) {
    console.error(
      "[sabcrm:api] DELETE record failed:",
      objectSlug,
      recordId,
      err,
    );
    const message =
      err instanceof Error ? err.message : "Failed to delete record.";
    return json({ error: message }, 500);
  }
}
