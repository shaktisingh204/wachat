'use server';

/**
 * Server-action wrappers for the Telegram Contacts BFF.
 *
 * Each wrapper is a thin pass-through to `rustClient.telegramContacts`,
 * normalizing errors into result shapes so client components can branch
 * on `success` / `error` without unwrapping {@link RustApiError}.
 */

import { rustClient, RustApiError } from '@/lib/rust-client';
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

// ---- List / detail / upsert / delete ----------------------------------

export async function listTelegramContactsAction(q: ListQuery): Promise<ListResp> {
    try {
        return await rustClient.telegramContacts.list(q);
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
        return await rustClient.telegramContacts.detail(contactId, projectId);
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

export async function bulkDeleteTelegramContactsAction(
    body: BulkIdsBody,
): Promise<BulkResultResp> {
    try {
        return await rustClient.telegramContacts.bulkDelete(body);
    } catch (e) {
        return asBulkErr(e);
    }
}

export async function bulkTagTelegramContactsAction(
    body: BulkTagBody,
): Promise<BulkResultResp> {
    try {
        return await rustClient.telegramContacts.bulkTag(body);
    } catch (e) {
        return asBulkErr(e);
    }
}

export async function bulkAssignTelegramContactsAction(
    body: BulkAssignBody,
): Promise<BulkResultResp> {
    try {
        return await rustClient.telegramContacts.bulkAssign(body);
    } catch (e) {
        return asBulkErr(e);
    }
}

// ---- Sync / CSV -------------------------------------------------------

export async function syncTelegramContactsFromChatsAction(
    body: SyncFromChatsBody,
): Promise<SyncFromChatsResp> {
    try {
        return await rustClient.telegramContacts.syncFromChats(body);
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
        return await rustClient.telegramContacts.listSegments(projectId);
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
        return await rustClient.telegramContacts.segmentContacts(segmentId, q);
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
        return await rustClient.telegramContacts.analytics(q);
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

export interface BotOption {
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
export type {
    AnalyticsResp,
    ContactRow,
    ListResp,
    SegmentRow,
};
