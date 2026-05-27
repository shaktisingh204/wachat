'use server';

/**
 * CRM HR Announcements — server-action wrappers around the Rust crate
 * (`/v1/crm/announcements`).
 *
 * Field shape mirrors the Rust DTO which serialises with
 * `rename_all = "camelCase"`. On Rust failure we record a fallback
 * telemetry event and return `{ error }` — there is no Mongo shadow read
 * to fall back to.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmAnnouncementsApi,
    type CrmAnnouncementAudience,
    type CrmAnnouncementCategory,
    type CrmAnnouncementCreateInput,
    type CrmAnnouncementDoc,
    type CrmAnnouncementListParams,
    type CrmAnnouncementListResponse,
    type CrmAnnouncementPriority,
    type CrmAnnouncementStatus,
    type CrmAnnouncementUpdateInput,
} from '@/lib/rust-client/crm-announcements';

import { sendSlackNotification } from '@/lib/integrations/slack';
import { notifyTeamMember } from '@/lib/team-notifications';
import { connectToDatabase } from '@/lib/mongodb';

const BASE_PATH = '/dashboard/hrm/hr/announcements';

async function broadcastAnnouncement(title: string, body?: string, announcementId?: string) {
    try {
        void sendSlackNotification(`📢 *Announcement Published:*\n*${title}*\n${body ? body.substring(0, 100) : ''}...`);
        
        const { db } = await connectToDatabase();
        const users = await db.collection('users').find({}, { projection: { _id: 1 } }).limit(500).toArray();
        const notifyPromises = users.map((u: any) => notifyTeamMember({
            recipientUserId: u._id,
            message: `New HR Announcement: ${title}`,
            link: announcementId ? `/dashboard/hrm/hr/announcements/${announcementId}` : '/dashboard/hrm/hr/announcements',
            eventType: 'announcement_published',
            sourceApp: 'system'
        }));
        await Promise.allSettled(notifyPromises);
    } catch (e) {
        console.error('[broadcastAnnouncement] failed:', e);
    }
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

function asStringList(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const items = s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    return items.length > 0 ? items : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

/* ─── Validation sets ────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmAnnouncementStatus> =
    new Set<CrmAnnouncementStatus>([
        'draft',
        'scheduled',
        'published',
        'archived',
    ]);

const VALID_CATEGORIES: ReadonlySet<CrmAnnouncementCategory> =
    new Set<CrmAnnouncementCategory>([
        'general',
        'hr',
        'policy',
        'event',
        'celebration',
        'urgent',
    ]);

const VALID_PRIORITIES: ReadonlySet<CrmAnnouncementPriority> =
    new Set<CrmAnnouncementPriority>(['low', 'normal', 'high', 'urgent']);

const VALID_AUDIENCES: ReadonlySet<CrmAnnouncementAudience> =
    new Set<CrmAnnouncementAudience>(['all', 'department', 'team', 'role']);

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getAnnouncements(
    filters?: CrmAnnouncementListParams,
): Promise<CrmAnnouncementListResponse> {
    const empty: CrmAnnouncementListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_announcement', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmAnnouncementsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getAnnouncements] rust call failed:', msg);
        recordRustFallback({
            entity: 'announcement',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getAnnouncementById(
    id: string,
): Promise<CrmAnnouncementDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_announcement', 'view');
    if (!guard.ok) return null;

    try {
        return await crmAnnouncementsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getAnnouncementById] rust call failed:', msg);
        recordRustFallback({
            entity: 'announcement',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmAnnouncementCreateInput;
    error?: string;
} {
    const title = asString(formData.get('title'));
    if (!title) {
        return {
            payload: {} as CrmAnnouncementCreateInput,
            error: 'Title is required.',
        };
    }

    const body = asString(formData.get('body'));
    if (!body) {
        return {
            payload: {} as CrmAnnouncementCreateInput,
            error: 'Body is required.',
        };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmAnnouncementStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmAnnouncementStatus)
            ? (statusRaw as CrmAnnouncementStatus)
            : undefined;

    const categoryRaw = asString(formData.get('category'));
    const category: CrmAnnouncementCategory | undefined =
        categoryRaw &&
        VALID_CATEGORIES.has(categoryRaw as CrmAnnouncementCategory)
            ? (categoryRaw as CrmAnnouncementCategory)
            : undefined;

    const priorityRaw = asString(formData.get('priority'));
    const priority: CrmAnnouncementPriority | undefined =
        priorityRaw &&
        VALID_PRIORITIES.has(priorityRaw as CrmAnnouncementPriority)
            ? (priorityRaw as CrmAnnouncementPriority)
            : undefined;

    const audienceRaw = asString(formData.get('audience'));
    const audience: CrmAnnouncementAudience | undefined =
        audienceRaw &&
        VALID_AUDIENCES.has(audienceRaw as CrmAnnouncementAudience)
            ? (audienceRaw as CrmAnnouncementAudience)
            : undefined;

    // Optional attachments JSON — additive; the Rust DTO accepts unknown
    // fields silently, and detail pages that don't expect attachments
    // simply ignore them.
    const attachmentsRaw = asString(formData.get('attachments'));
    let attachments: CrmAnnouncementAttachment[] | undefined;
    if (attachmentsRaw) {
        try {
            const parsed: unknown = JSON.parse(attachmentsRaw);
            if (Array.isArray(parsed)) {
                attachments = parsed
                    .filter(
                        (a): a is Record<string, unknown> =>
                            !!a && typeof a === 'object',
                    )
                    .map((a) => ({
                        id: String(a.id ?? ''),
                        url: String(a.url ?? ''),
                        name: String(a.name ?? ''),
                        mime: a.mime != null ? String(a.mime) : undefined,
                        size:
                            typeof a.size === 'number'
                                ? a.size
                                : a.size != null
                                  ? Number(a.size)
                                  : undefined,
                    }))
                    .filter((a) => a.id && a.url);
            }
        } catch {
            /* swallow invalid JSON — keep payload otherwise valid */
        }
    }

    const payload: CrmAnnouncementCreateInput & {
        attachments?: CrmAnnouncementAttachment[];
    } = {
        title,
        body,
        audienceIds: asStringList(formData.get('audienceIds')),
        publishAt: asString(formData.get('publishAt')),
        expiresAt: asString(formData.get('expiresAt')),
        pinned: asBool(formData.get('pinned')),
        allowComments: asBool(formData.get('allowComments')),
        requireAcknowledgement: asBool(formData.get('requireAcknowledgement')),
        bannerUrl: asString(formData.get('bannerUrl')),
        tags: asStringList(formData.get('tags')),
        ...(category ? { category } : {}),
        ...(priority ? { priority } : {}),
        ...(audience ? { audience } : {}),
        ...(status ? { status } : {}),
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };

    return { payload };
}

interface CrmAnnouncementAttachment {
    id: string;
    url: string;
    name: string;
    mime?: string;
    size?: number;
}

/**
 * Create or update an announcement. If `announcementId` is supplied
 * (hidden form field) we PATCH, otherwise we POST.
 */
export async function saveAnnouncement(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const announcementId = asString(formData.get('announcementId'));
    const isEditing = !!announcementId;

    const guard = await requirePermission(
        'crm_announcement',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmAnnouncementUpdateInput =
                payload as CrmAnnouncementUpdateInput;
            const updated = await crmAnnouncementsApi.update(
                announcementId!,
                patch,
            );
            if (payload.status === 'published') {
                void broadcastAnnouncement(payload.title, payload.body, announcementId!);
            }
            revalidatePath(BASE_PATH);
            revalidatePath(`${BASE_PATH}/${announcementId}`);
            return {
                message: 'Announcement updated.',
                id: updated?._id ?? announcementId,
            };
        }

        const created = await crmAnnouncementsApi.create(payload);
        if (payload.status === 'published') {
            void broadcastAnnouncement(payload.title, payload.body, created.id);
        }
        revalidatePath(BASE_PATH);
        return {
            message: 'Announcement created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[saveAnnouncement] rust call failed:', msg);
        recordRustFallback({
            entity: 'announcement',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save announcement: ${msg}` };
    }
}

/* ─── KPIs ───────────────────────────────────────────────────────────── */

interface AnnouncementKpis {
    total: number;
    activeOrPinned: number;
    publishedThisMonth: number;
    drafts: number;
}

export async function getAnnouncementKpis(): Promise<AnnouncementKpis> {
    const empty: AnnouncementKpis = {
        total: 0,
        activeOrPinned: 0,
        publishedThisMonth: 0,
        drafts: 0,
    };
    const session = await getSession();
    if (!session?.user) return empty;
    const guard = await requirePermission('crm_announcement', 'view');
    if (!guard.ok) return empty;
    try {
        const res = await crmAnnouncementsApi.list({ limit: 500 });
        const items = res.items;
        const now = new Date();
        let activeOrPinned = 0;
        let publishedThisMonth = 0;
        let drafts = 0;
        for (const a of items) {
            if (a.status === 'published' || a.pinned) activeOrPinned += 1;
            if (a.status === 'draft') drafts += 1;
            if (a.status === 'published' && a.publishedAt) {
                const d = new Date(a.publishedAt);
                if (
                    d.getFullYear() === now.getFullYear() &&
                    d.getMonth() === now.getMonth()
                ) {
                    publishedThisMonth += 1;
                }
            }
        }
        return { total: items.length, activeOrPinned, publishedThisMonth, drafts };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({ entity: 'announcement', op: 'list', errorCode: code, status });
        console.error('[getAnnouncementKpis] failed:', msg);
        return empty;
    }
}

/* ─── Bulk actions ───────────────────────────────────────────────────── */

export async function bulkPublishAnnouncements(
    ids: string[],
): Promise<{ ok: number; fail: number }> {
    const session = await getSession();
    if (!session?.user) return { ok: 0, fail: ids.length };
    const guard = await requirePermission('crm_announcement', 'edit');
    if (!guard.ok) return { ok: 0, fail: ids.length };
    let ok = 0;
    let fail = 0;
    let publishedCount = 0;
    for (const id of ids) {
        try {
            await crmAnnouncementsApi.update(id, {
                status: 'published',
                publishAt: new Date().toISOString(),
            } as CrmAnnouncementUpdateInput);
            ok += 1;
            publishedCount += 1;
        } catch {
            fail += 1;
        }
    }
    
    if (publishedCount > 0) {
        void sendSlackNotification(`📢 *${publishedCount} Announcement(s) Published via Bulk Action*`);
    }

    revalidatePath(BASE_PATH);
    return { ok, fail };
}

export async function bulkArchiveAnnouncements(
    ids: string[],
): Promise<{ ok: number; fail: number }> {
    const session = await getSession();
    if (!session?.user) return { ok: 0, fail: ids.length };
    const guard = await requirePermission('crm_announcement', 'edit');
    if (!guard.ok) return { ok: 0, fail: ids.length };
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
        try {
            await crmAnnouncementsApi.update(id, {
                status: 'archived',
            } as CrmAnnouncementUpdateInput);
            ok += 1;
        } catch {
            fail += 1;
        }
    }
    revalidatePath(BASE_PATH);
    return { ok, fail };
}

export async function bulkDeleteAnnouncements(
    ids: string[],
): Promise<{ ok: number; fail: number }> {
    const session = await getSession();
    if (!session?.user) return { ok: 0, fail: ids.length };
    const guard = await requirePermission('crm_announcement', 'delete');
    if (!guard.ok) return { ok: 0, fail: ids.length };
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
        try {
            await crmAnnouncementsApi.delete(id);
            ok += 1;
        } catch {
            fail += 1;
        }
    }
    revalidatePath(BASE_PATH);
    return { ok, fail };
}

export async function deleteAnnouncement(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Announcement id is required.' };

    const guard = await requirePermission('crm_announcement', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmAnnouncementsApi.delete(id);
        revalidatePath(BASE_PATH);
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteAnnouncement] rust call failed:', msg);
        recordRustFallback({
            entity: 'announcement',
            op: 'delete',
            errorCode: code,
            status,
        });
        return {
            success: false,
            error: `Failed to delete announcement: ${msg}`,
        };
    }
}
