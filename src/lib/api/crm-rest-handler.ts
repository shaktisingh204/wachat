/**
 * CRM Public API — shared REST handler factory (Phase 7 foundation).
 *
 * Builds GET (list) / POST (create) / GET (detail) / PATCH (update) /
 * DELETE (archive) handlers for the 10 top CRM entities exposed at
 * `/api/v1/crm/<entity>/`.
 *
 * Implementation strategy:
 *
 *   • Every entity stores under `crm_<collection>` in Mongo with a
 *     `userId: ObjectId` field that we treat as `tenantUserId`.
 *   • Reads filter by `userId` and (when supported) `status: { $ne: 'archived' }`
 *     so archived rows fall out of default listings.
 *   • Writes stamp `userId`, `createdAt`, `status: 'active'`.
 *   • Delete is soft (`status: 'archived'`) — same semantics as the existing
 *     server actions.
 *   • We deliberately do NOT delegate to the server actions, because they
 *     resolve `tenantUserId` via `getSession()` (HTTP cookie), and public-API
 *     callers don't have a session. Talking to Mongo directly with the
 *     authenticated `tenantUserId` is both safer and simpler.
 *
 * This keeps the public API surface flat and well-typed. Per-entity field
 * coercion is delegated to the caller via the `coerceCreate`/`coerceUpdate`
 * hooks so each route file can declare its own shape.
 */

import 'server-only';

import { ObjectId, type Document, type Filter } from 'mongodb';
import type { NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';

import { authenticateAndRequireScope } from './auth';
import {
    ApiErrors,
    apiItemResponse,
    apiListResponse,
} from './errors';
import { readScope, writeScope, type CrmApiEntity } from './oauth-scopes';

/* ── Per-entity configuration ───────────────────────────────────────────── */

export interface CrmRestConfig<TCreateInput extends Document, TUpdateInput extends Document> {
    /** Public entity name (e.g. `'accounts'`). Drives scope strings. */
    entity: CrmApiEntity;
    /** Mongo collection name (e.g. `'crm_accounts'`). */
    collection: string;
    /**
     * Coerce the request JSON body into an insert document. Throw a string
     * for validation errors — they'll be surfaced as `validation_failed`.
     */
    coerceCreate: (body: unknown) => TCreateInput | string;
    /**
     * Coerce the request JSON body into a partial update. Same throw rules.
     */
    coerceUpdate: (body: unknown) => TUpdateInput | string;
    /**
     * Optional list of fields searched by `?q=`. When omitted, the `q` param
     * is ignored.
     */
    searchableFields?: string[];
    /**
     * Optional fixed sort key. Defaults to `{ createdAt: -1 }`.
     */
    defaultSort?: Document;
    /**
     * Optional filter the caller can OR into the base filter
     * (e.g. include only certain document subtypes).
     */
    baseFilter?: Document;
    /**
     * Optional event names to emit on create / update / delete. When set,
     * the handler will call `dispatchWebhookEvent` after a successful
     * mutation. Wrapped in try/catch — never blocks the response.
     */
    webhookEvents?: {
        created?: string;
        updated?: string;
        deleted?: string;
    };
}

/* ── Tiny helpers ────────────────────────────────────────────────────────── */

function parsePositiveInt(raw: string | null, dflt: number, max: number): number {
    if (!raw) return dflt;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return dflt;
    return Math.min(n, max);
}

function isObjectIdHex(s: string): boolean {
    return /^[a-fA-F0-9]{24}$/.test(s);
}

function buildSearchFilter(q: string, fields: string[]): Document {
    const rx = { $regex: q, $options: 'i' };
    return { $or: fields.map((f) => ({ [f]: rx })) };
}

/* ── List + Create (mounted at /<entity>/route.ts) ──────────────────────── */

export function makeCrmCollectionHandlers<
    TCreateInput extends Document,
    TUpdateInput extends Document,
>(config: CrmRestConfig<TCreateInput, TUpdateInput>) {
    const scopeRead = readScope(config.entity);
    const scopeWrite = writeScope(config.entity);

    async function GET(req: NextRequest): Promise<Response> {
        const auth = await authenticateAndRequireScope(req, scopeRead);
        if ('error' in auth) return auth.error;

        let userId: ObjectId;
        try {
            userId = new ObjectId(auth.ctx.tenantUserId);
        } catch {
            return ApiErrors.invalidToken('Token tenant is not a valid ObjectId');
        }

        const url = new URL(req.url);
        const page = parsePositiveInt(url.searchParams.get('page'), 1, 10_000);
        const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);
        const status = url.searchParams.get('status') ?? 'active';
        const q = url.searchParams.get('q')?.trim() ?? '';

        const filter: Filter<Document> = { userId, ...(config.baseFilter ?? {}) };
        if (status === 'active') {
            (filter as Document).status = { $ne: 'archived' };
        } else if (status === 'archived') {
            (filter as Document).status = 'archived';
        }
        if (q && config.searchableFields?.length) {
            Object.assign(filter, buildSearchFilter(q, config.searchableFields));
        }

        try {
            const { db } = await connectToDatabase();
            const coll = db.collection(config.collection);
            const sort = config.defaultSort ?? { createdAt: -1 };
            const skip = (page - 1) * limit;
            const [items, total] = await Promise.all([
                coll
                    .find(filter)
                    .sort(sort as Document)
                    .skip(skip)
                    .limit(limit + 1) // peek 1 extra for hasMore
                    .toArray(),
                coll.estimatedDocumentCount().catch(() => undefined),
            ]);
            const hasMore = items.length > limit;
            const data = (hasMore ? items.slice(0, limit) : items).map((d) => ({
                ...d,
                _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
                userId: undefined,
            }));
            return apiListResponse(data, page, hasMore, total);
        } catch (err) {
            console.error(`[crm-rest] ${config.entity} list failed:`, err);
            return ApiErrors.internalError('Failed to list resources');
        }
    }

    async function POST(req: NextRequest): Promise<Response> {
        const auth = await authenticateAndRequireScope(req, scopeWrite);
        if ('error' in auth) return auth.error;

        let userId: ObjectId;
        try {
            userId = new ObjectId(auth.ctx.tenantUserId);
        } catch {
            return ApiErrors.invalidToken('Token tenant is not a valid ObjectId');
        }

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return ApiErrors.validationFailed('Request body must be valid JSON');
        }

        let coerced: TCreateInput | string;
        try {
            coerced = config.coerceCreate(body);
        } catch (e) {
            return ApiErrors.validationFailed(
                e instanceof Error ? e.message : 'Invalid body',
            );
        }
        if (typeof coerced === 'string') {
            return ApiErrors.validationFailed(coerced);
        }

        const doc: Document = {
            ...coerced,
            userId,
            status: (coerced as Document).status ?? 'active',
            createdAt: new Date(),
        };

        try {
            const { db } = await connectToDatabase();
            const result = await db.collection(config.collection).insertOne(doc);
            const inserted = {
                ...doc,
                _id: result.insertedId.toHexString(),
                userId: undefined,
            };

            // Best-effort webhook fan-out — never blocks the response.
            if (config.webhookEvents?.created) {
                void emitWebhookSafely(
                    auth.ctx.tenantUserId,
                    config.webhookEvents.created,
                    { [config.entity.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]: inserted },
                );
            }

            return apiItemResponse(inserted, 201);
        } catch (err) {
            console.error(`[crm-rest] ${config.entity} create failed:`, err);
            return ApiErrors.internalError('Failed to create resource');
        }
    }

    return { GET, POST };
}

/* ── Detail + Update + Delete (mounted at /<entity>/[id]/route.ts) ─────── */

export function makeCrmItemHandlers<
    TCreateInput extends Document,
    TUpdateInput extends Document,
>(config: CrmRestConfig<TCreateInput, TUpdateInput>) {
    const scopeRead = readScope(config.entity);
    const scopeWrite = writeScope(config.entity);

    type Ctx = { params: Promise<{ id: string }> | { id: string } };

    async function resolveParams(routeCtx: Ctx): Promise<{ id: string }> {
        const p = routeCtx.params;
        if (p && typeof (p as Promise<{ id: string }>).then === 'function') {
            return await (p as Promise<{ id: string }>);
        }
        return p as { id: string };
    }

    async function GET(req: NextRequest, routeCtx: Ctx): Promise<Response> {
        const auth = await authenticateAndRequireScope(req, scopeRead);
        if ('error' in auth) return auth.error;
        const { id } = await resolveParams(routeCtx);
        if (!isObjectIdHex(id)) return ApiErrors.notFound();

        let userId: ObjectId;
        try {
            userId = new ObjectId(auth.ctx.tenantUserId);
        } catch {
            return ApiErrors.invalidToken('Token tenant is not a valid ObjectId');
        }

        try {
            const { db } = await connectToDatabase();
            const doc = await db
                .collection(config.collection)
                .findOne({ _id: new ObjectId(id), userId });
            if (!doc) return ApiErrors.notFound();
            return apiItemResponse({
                ...doc,
                _id: (doc._id as ObjectId).toHexString(),
                userId: undefined,
            });
        } catch (err) {
            console.error(`[crm-rest] ${config.entity} get failed:`, err);
            return ApiErrors.internalError('Failed to load resource');
        }
    }

    async function PATCH(req: NextRequest, routeCtx: Ctx): Promise<Response> {
        const auth = await authenticateAndRequireScope(req, scopeWrite);
        if ('error' in auth) return auth.error;
        const { id } = await resolveParams(routeCtx);
        if (!isObjectIdHex(id)) return ApiErrors.notFound();

        let userId: ObjectId;
        try {
            userId = new ObjectId(auth.ctx.tenantUserId);
        } catch {
            return ApiErrors.invalidToken('Token tenant is not a valid ObjectId');
        }

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return ApiErrors.validationFailed('Request body must be valid JSON');
        }

        let coerced: TUpdateInput | string;
        try {
            coerced = config.coerceUpdate(body);
        } catch (e) {
            return ApiErrors.validationFailed(
                e instanceof Error ? e.message : 'Invalid body',
            );
        }
        if (typeof coerced === 'string') {
            return ApiErrors.validationFailed(coerced);
        }

        try {
            const { db } = await connectToDatabase();
            const result = await db.collection(config.collection).findOneAndUpdate(
                { _id: new ObjectId(id), userId },
                { $set: { ...coerced, updatedAt: new Date() } },
                { returnDocument: 'after' },
            );
            const updated = (result as { value?: Document } | Document | null);
            const doc =
                updated && 'value' in (updated as { value?: Document })
                    ? (updated as { value?: Document }).value
                    : (updated as Document | null);
            if (!doc) return ApiErrors.notFound();
            const out = {
                ...doc,
                _id:
                    doc._id instanceof ObjectId
                        ? doc._id.toHexString()
                        : String(doc._id),
                userId: undefined,
            };
            if (config.webhookEvents?.updated) {
                void emitWebhookSafely(
                    auth.ctx.tenantUserId,
                    config.webhookEvents.updated,
                    { [config.entity.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]: out },
                );
            }
            return apiItemResponse(out);
        } catch (err) {
            console.error(`[crm-rest] ${config.entity} update failed:`, err);
            return ApiErrors.internalError('Failed to update resource');
        }
    }

    async function DELETE(req: NextRequest, routeCtx: Ctx): Promise<Response> {
        const auth = await authenticateAndRequireScope(req, scopeWrite);
        if ('error' in auth) return auth.error;
        const { id } = await resolveParams(routeCtx);
        if (!isObjectIdHex(id)) return ApiErrors.notFound();

        let userId: ObjectId;
        try {
            userId = new ObjectId(auth.ctx.tenantUserId);
        } catch {
            return ApiErrors.invalidToken('Token tenant is not a valid ObjectId');
        }

        try {
            const { db } = await connectToDatabase();
            const result = await db
                .collection(config.collection)
                .updateOne(
                    { _id: new ObjectId(id), userId },
                    { $set: { status: 'archived', archivedAt: new Date() } },
                );
            if (result.matchedCount === 0) return ApiErrors.notFound();
            if (config.webhookEvents?.deleted) {
                void emitWebhookSafely(
                    auth.ctx.tenantUserId,
                    config.webhookEvents.deleted,
                    { id },
                );
            }
            return apiItemResponse({ id, archived: true });
        } catch (err) {
            console.error(`[crm-rest] ${config.entity} archive failed:`, err);
            return ApiErrors.internalError('Failed to archive resource');
        }
    }

    return { GET, PATCH, DELETE };
}

/* ── Webhook bridge (lazy import to avoid circular deps) ───────────────── */

async function emitWebhookSafely(
    tenantUserId: string,
    eventName: string,
    payload: unknown,
): Promise<void> {
    try {
        const mod = await import('@/lib/webhooks/dispatch');
        await mod.dispatchWebhookEvent(tenantUserId, eventName, payload);
    } catch (e) {
        console.error('[crm-rest] webhook dispatch failed:', e);
    }
}
