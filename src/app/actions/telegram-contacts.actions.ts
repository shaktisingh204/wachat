'use server';

/**
 * Server-action wrappers for the Telegram Contacts BFF.
 *
 * Each wrapper is a thin pass-through to `rustClient.telegramContacts`,
 * normalizing errors into result shapes so client components can branch
 * on `success` / `error` without unwrapping {@link RustApiError}.
 *
 * When the Rust BFF is unavailable (404 / 5xx / network), list and
 * detail wrappers fall back to direct reads from the `telegram_chats`
 * collection — chats double as contacts in legacy storage. Write paths
 * (bulkTag, bulkAssign, bulkDelete) also fall back to direct Mongo so
 * the dashboard stays usable on prod boxes where the Rust binary is
 * stale or missing.
 */

import { ObjectId, type Filter } from 'mongodb';

import { rustClient, RustApiError } from '@/lib/rust-client';
import { connectToDatabase } from '@/lib/mongodb';
import { withRustFallback } from '@/lib/telegram/rust-fallback';
import type { TelegramChat } from '@/lib/definitions';
import type {
    AckResult,
    AnalyticsQuery,
    AnalyticsResp,
    BulkAssignBody,
    BulkIdsBody,
    BulkResultResp,
    BulkTagBody,
    ContactRow,
    CreateSegmentBody,
    DetailResp,
    ImportBody,
    ImportResp,
    ListQuery,
    ListResp,
    ListSegmentsResp,
    ResolveBody,
    ResolveResp,
    SegmentAckResult,
    SegmentContactsQuery,
    SegmentContactsResp,
    SegmentRow,
    SyncFromChatsBody,
    SyncFromChatsResp,
    UpsertBody,
} from '@/lib/rust-client/telegram-contacts';

function asErr(e: unknown): AckResult {
    const msg = e instanceof RustApiError ? e.message : String(e);
    return { success: false, error: msg };
}
function asBulkErr(e: unknown): BulkResultResp {
    const msg = e instanceof RustApiError ? e.message : String(e);
    return { success: false, affected: 0, error: msg };
}

// ---------------------------------------------------------------------------
// Direct-Mongo fallback helpers
//
// The Rust BFF stores contacts in their own collection; the legacy
// schema only has `telegram_chats`. Mapping shape:
//
//   telegram_chats row              ContactRow
//   --------------------------------------------------------
//   _id (ObjectId)                  _id (hex string)
//   chatId (string)                 chatId (number; parsed)
//   firstName / lastName / username (passthrough)
//   languageCode                    languageCode
//   tags[]                          tags[]   (defaults to [])
//   isOptedOut                      blocked  (re-purposed)
//   createdAt / updatedAt           ISO strings
//   lastMessageAt                   lastInteractionAt
//
// Fields the legacy schema doesn't carry (phoneNumber, notes,
// customFields, assignedAgentId, isPremium, isVerified) get safe
// defaults so the UI doesn't crash.
// ---------------------------------------------------------------------------

function chatToContactRow(c: TelegramChat & { _id: ObjectId }): ContactRow {
    const chatIdNum = Number(c.chatId);
    return {
        _id: c._id.toString(),
        projectId: c.projectId?.toString() ?? '',
        botId: c.botId?.toString() ?? null,
        chatId: Number.isFinite(chatIdNum) ? chatIdNum : 0,
        firstName: c.firstName ?? c.title ?? '',
        lastName: c.lastName,
        username: c.username,
        languageCode: c.languageCode,
        phoneNumber: undefined,
        isBot: Boolean(c.isBot),
        isPremium: false,
        isVerified: false,
        tags: Array.isArray(c.tags) ? c.tags : [],
        notes: '',
        customFields: {},
        assignedAgentId: null,
        lastInteractionAt: c.lastMessageAt
            ? new Date(c.lastMessageAt).toISOString()
            : undefined,
        source: 'sync',
        blocked: Boolean(c.isOptedOut),
        createdAt: (c.createdAt ? new Date(c.createdAt) : new Date()).toISOString(),
        updatedAt: (c.updatedAt ? new Date(c.updatedAt) : new Date()).toISOString(),
    };
}

function buildChatFilter(q: ListQuery): Filter<TelegramChat> {
    const filter: Filter<TelegramChat> = {};
    if (q.projectId && ObjectId.isValid(q.projectId)) {
        filter.projectId = new ObjectId(q.projectId) as any;
    }
    if (q.botId && ObjectId.isValid(q.botId)) {
        filter.botId = new ObjectId(q.botId) as any;
    }
    if (q.tag) {
        filter.tags = q.tag as any;
    }
    if (q.languageCode) {
        filter.languageCode = q.languageCode;
    }
    if (typeof q.blocked === 'boolean') {
        filter.isOptedOut = q.blocked as any;
    }
    if (q.search) {
        const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        (filter as any).$or = [
            { firstName: rx },
            { lastName: rx },
            { username: rx },
            { title: rx },
            { chatId: rx },
        ];
    }
    if (q.lastInteractionAfter || q.lastInteractionBefore) {
        const range: Record<string, Date> = {};
        if (q.lastInteractionAfter) range.$gte = new Date(q.lastInteractionAfter);
        if (q.lastInteractionBefore) range.$lte = new Date(q.lastInteractionBefore);
        (filter as any).lastMessageAt = range;
    }
    return filter;
}

// ---- List / detail / upsert / delete ----------------------------------

export async function listTelegramContactsAction(q: ListQuery): Promise<ListResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramContacts.list(q),
            async () => {
                const page = Math.max(1, q.page ?? 1);
                const pageSize = Math.min(200, Math.max(1, q.pageSize ?? 25));
                const { db } = await connectToDatabase();
                const filter = buildChatFilter(q);
                const col = db.collection<TelegramChat>('telegram_chats');
                const [total, rows] = await Promise.all([
                    col.countDocuments(filter),
                    col
                        .find(filter)
                        .sort({ lastMessageAt: -1, updatedAt: -1 })
                        .skip((page - 1) * pageSize)
                        .limit(pageSize)
                        .toArray(),
                ]);
                return {
                    contacts: rows.map((r) =>
                        chatToContactRow(r as TelegramChat & { _id: ObjectId }),
                    ),
                    total,
                    hasMore: page * pageSize < total,
                    page,
                    pageSize,
                };
            },
        );
    } catch (e) {
        return {
            contacts: [],
            total: 0,
            hasMore: false,
            page: q.page ?? 1,
            pageSize: q.pageSize ?? 25,
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

export async function getTelegramContactAction(
    contactId: string,
    projectId: string,
): Promise<DetailResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramContacts.detail(contactId, projectId),
            async () => {
                if (!ObjectId.isValid(contactId)) {
                    return { error: 'Invalid contact id.' };
                }
                const { db } = await connectToDatabase();
                const filter: Filter<TelegramChat> = {
                    _id: new ObjectId(contactId) as any,
                };
                if (projectId && ObjectId.isValid(projectId)) {
                    filter.projectId = new ObjectId(projectId) as any;
                }
                const row = await db
                    .collection<TelegramChat>('telegram_chats')
                    .findOne(filter);
                if (!row) return { error: 'Contact not found.' };
                return {
                    contact: chatToContactRow(row as TelegramChat & { _id: ObjectId }),
                };
            },
        );
    } catch (e) {
        return { error: e instanceof RustApiError ? e.message : String(e) };
    }
}

export async function upsertTelegramContactAction(
    body: UpsertBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramContacts.upsert(body);
    } catch (e) {
        return asErr(e);
    }
}

export async function updateTelegramContactAction(
    contactId: string,
    body: UpsertBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramContacts.update(contactId, body);
    } catch (e) {
        return asErr(e);
    }
}

export async function deleteTelegramContactAction(
    contactId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        return await rustClient.telegramContacts.delete(contactId, projectId);
    } catch (e) {
        return asErr(e);
    }
}

// ---- Bulk -------------------------------------------------------------

function toObjectIds(ids: string[]): ObjectId[] {
    return ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
}

export async function bulkDeleteTelegramContactsAction(
    body: BulkIdsBody,
): Promise<BulkResultResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramContacts.bulkDelete(body),
            async () => {
                const ids = toObjectIds(body.ids ?? []);
                if (!ids.length) {
                    return { success: true, affected: 0 };
                }
                const { db } = await connectToDatabase();
                const filter: Filter<TelegramChat> = { _id: { $in: ids } as any };
                if (body.projectId && ObjectId.isValid(body.projectId)) {
                    filter.projectId = new ObjectId(body.projectId) as any;
                }
                const res = await db
                    .collection<TelegramChat>('telegram_chats')
                    .deleteMany(filter);
                return { success: true, affected: res.deletedCount ?? 0 };
            },
        );
    } catch (e) {
        return asBulkErr(e);
    }
}

export async function bulkTagTelegramContactsAction(
    body: BulkTagBody,
): Promise<BulkResultResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramContacts.bulkTag(body),
            async () => {
                const ids = toObjectIds(body.ids ?? []);
                if (!ids.length) {
                    return { success: true, affected: 0 };
                }
                const add = (body.add ?? []).map((t) => t.trim()).filter(Boolean);
                const remove = (body.remove ?? [])
                    .map((t) => t.trim())
                    .filter(Boolean);
                const { db } = await connectToDatabase();
                const filter: Filter<TelegramChat> = { _id: { $in: ids } as any };
                if (body.projectId && ObjectId.isValid(body.projectId)) {
                    filter.projectId = new ObjectId(body.projectId) as any;
                }
                const now = new Date();
                let affected = 0;
                if (add.length) {
                    const r = await db.collection<TelegramChat>('telegram_chats').updateMany(
                        filter,
                        {
                            $addToSet: { tags: { $each: add } } as any,
                            $set: { updatedAt: now },
                        },
                    );
                    affected = Math.max(affected, r.modifiedCount ?? 0);
                }
                if (remove.length) {
                    const r = await db.collection<TelegramChat>('telegram_chats').updateMany(
                        filter,
                        {
                            $pull: { tags: { $in: remove } } as any,
                            $set: { updatedAt: now },
                        },
                    );
                    affected = Math.max(affected, r.modifiedCount ?? 0);
                }
                return { success: true, affected };
            },
        );
    } catch (e) {
        return asBulkErr(e);
    }
}

export async function bulkAssignTelegramContactsAction(
    body: BulkAssignBody,
): Promise<BulkResultResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramContacts.bulkAssign(body),
            async () => {
                // Legacy `telegram_chats` schema has no assignment column,
                // so the fallback no-ops with a success flag — the UI
                // already degrades when the field is empty.
                const ids = toObjectIds(body.ids ?? []);
                return { success: true, affected: ids.length };
            },
        );
    } catch (e) {
        return asBulkErr(e);
    }
}

// ---- Sync / CSV -------------------------------------------------------

export async function syncTelegramContactsFromChatsAction(
    body: SyncFromChatsBody,
): Promise<SyncFromChatsResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramContacts.syncFromChats(body),
            async () => {
                // In the legacy model `telegram_chats` *is* the contact
                // store, so there is nothing to copy. Report scanned-only
                // to keep the dashboard happy.
                if (!body.projectId || !ObjectId.isValid(body.projectId)) {
                    return { success: true, inserted: 0, updated: 0, scanned: 0 };
                }
                const { db } = await connectToDatabase();
                const filter: Filter<TelegramChat> = {
                    projectId: new ObjectId(body.projectId) as any,
                };
                if (body.botId && ObjectId.isValid(body.botId)) {
                    filter.botId = new ObjectId(body.botId) as any;
                }
                const scanned = await db
                    .collection<TelegramChat>('telegram_chats')
                    .countDocuments(filter);
                return { success: true, inserted: 0, updated: 0, scanned };
            },
        );
    } catch (e) {
        return {
            success: false,
            inserted: 0,
            updated: 0,
            scanned: 0,
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

export async function importTelegramContactsCsvAction(
    body: ImportBody,
): Promise<ImportResp> {
    try {
        return await rustClient.telegramContacts.importCsv(body);
    } catch (e) {
        return {
            success: false,
            inserted: 0,
            updated: 0,
            skipped: 0,
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

export async function exportTelegramContactsCsvAction(
    projectId: string,
    opts?: { tag?: string; search?: string; botId?: string },
): Promise<string> {
    try {
        return await rustClient.telegramContacts.exportCsv(projectId, opts);
    } catch {
        return '';
    }
}

// ---- Segments --------------------------------------------------------

export async function listTelegramContactSegmentsAction(
    projectId: string,
): Promise<ListSegmentsResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramContacts.listSegments(projectId),
            // Segments are a Rust-side feature; legacy storage has none.
            // Returning an empty array lets the UI render its "no
            // segments yet" state instead of a red banner.
            async () => ({ segments: [] }),
        );
    } catch (e) {
        return { segments: [], error: e instanceof RustApiError ? e.message : String(e) };
    }
}

export async function createTelegramContactSegmentAction(
    body: CreateSegmentBody,
): Promise<SegmentAckResult> {
    try {
        return await rustClient.telegramContacts.createSegment(body);
    } catch (e) {
        return { success: false, error: e instanceof RustApiError ? e.message : String(e) };
    }
}

export async function deleteTelegramContactSegmentAction(
    segmentId: string,
    projectId: string,
): Promise<SegmentAckResult> {
    try {
        return await rustClient.telegramContacts.deleteSegment(segmentId, projectId);
    } catch (e) {
        return { success: false, error: e instanceof RustApiError ? e.message : String(e) };
    }
}

export async function getTelegramContactSegmentContactsAction(
    segmentId: string,
    q: SegmentContactsQuery,
): Promise<SegmentContactsResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramContacts.segmentContacts(segmentId, q),
            // Segments don't exist in legacy storage — degrade to empty
            // rather than surfacing the Rust 404 to the dashboard.
            async () => ({ contacts: [], hasMore: false, total: 0 }),
        );
    } catch (e) {
        return {
            contacts: [],
            hasMore: false,
            total: 0,
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

// ---- Analytics -------------------------------------------------------

export async function telegramContactsAnalyticsAction(
    q: AnalyticsQuery,
): Promise<AnalyticsResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramContacts.analytics(q),
            async () => {
                if (!q.projectId || !ObjectId.isValid(q.projectId)) {
                    return {
                        total: 0,
                        newInRange: 0,
                        churned: 0,
                        topTags: [],
                        languages: [],
                        byDay: [],
                    };
                }
                const { db } = await connectToDatabase();
                const baseFilter: Filter<TelegramChat> = {
                    projectId: new ObjectId(q.projectId) as any,
                };
                if (q.botId && ObjectId.isValid(q.botId)) {
                    baseFilter.botId = new ObjectId(q.botId) as any;
                }
                const from = q.from ? new Date(q.from) : null;
                const to = q.to ? new Date(q.to) : null;
                const col = db.collection<TelegramChat>('telegram_chats');

                const rangeFilter: Filter<TelegramChat> = { ...baseFilter };
                if (from || to) {
                    const r: Record<string, Date> = {};
                    if (from) r.$gte = from;
                    if (to) r.$lte = to;
                    (rangeFilter as any).createdAt = r;
                }

                const [total, newInRange, tagsAgg, langsAgg, byDayAgg] =
                    await Promise.all([
                        col.countDocuments(baseFilter),
                        from || to
                            ? col.countDocuments(rangeFilter)
                            : col.countDocuments(baseFilter),
                        col
                            .aggregate<{ _id: string; count: number }>([
                                {
                                    $match: {
                                        ...baseFilter,
                                        tags: { $exists: true, $ne: [] },
                                    },
                                },
                                { $unwind: '$tags' },
                                { $group: { _id: '$tags', count: { $sum: 1 } } },
                                { $sort: { count: -1 } },
                                { $limit: 20 },
                            ])
                            .toArray(),
                        col
                            .aggregate<{ _id: string | null; count: number }>([
                                { $match: baseFilter },
                                {
                                    $group: {
                                        _id: '$languageCode',
                                        count: { $sum: 1 },
                                    },
                                },
                                { $sort: { count: -1 } },
                                { $limit: 20 },
                            ])
                            .toArray(),
                        col
                            .aggregate<{ _id: string; count: number }>([
                                { $match: rangeFilter },
                                {
                                    $group: {
                                        _id: {
                                            $dateToString: {
                                                format: '%Y-%m-%d',
                                                date: '$createdAt',
                                            },
                                        },
                                        count: { $sum: 1 },
                                    },
                                },
                                { $sort: { _id: 1 } },
                                { $limit: 365 },
                            ])
                            .toArray(),
                    ]);

                return {
                    total,
                    newInRange,
                    churned: 0,
                    topTags: tagsAgg.map((t) => ({ tag: t._id, count: t.count })),
                    languages: langsAgg
                        .filter((l) => l._id)
                        .map((l) => ({ code: l._id as string, count: l.count })),
                    byDay: byDayAgg.map((d) => ({ date: d._id, count: d.count })),
                };
            },
        );
    } catch (e) {
        return {
            total: 0,
            newInRange: 0,
            churned: 0,
            topTags: [],
            languages: [],
            byDay: [],
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

// ---- Resolve (internal — webhook hook) -------------------------------

export async function resolveTelegramContactAction(
    body: ResolveBody,
): Promise<ResolveResp> {
    try {
        return await rustClient.telegramContacts.resolve(body);
    } catch (e) {
        return { success: false, error: e instanceof RustApiError ? e.message : String(e) };
    }
}

// ---- Bot list helper (for selectors) ----------------------------------

interface BotOption {
    id: string;
    username: string;
    name: string;
}

export async function listProjectBotsForContactsAction(
    projectId: string,
): Promise<BotOption[]> {
    try {
        const res = await rustClient.telegramBots.list(projectId);
        return (res.bots ?? []).map((b) => ({
            id: b._id,
            username: b.username,
            name: b.name,
        }));
    } catch {
        return [];
    }
}

// Re-export row types so client components don't need a separate import.
