'use server';

/**
 * SabConnect — server actions for the unified Connect-equivalent surface.
 *
 * Wraps the six new Rust crates:
 *   - intranet-feed       → /v1/sabconnect/feed
 *   - intranet-groups     → /v1/sabconnect/groups
 *   - intranet-manuals    → /v1/sabconnect/manuals
 *   - intranet-reactions  → /v1/sabconnect/reactions
 *   - intranet-comments   → /v1/sabconnect/comments
 *   - intranet-custom-apps → /v1/sabconnect/custom-apps
 *
 * Auth is enforced via {@link getSession}; the Rust JWT minted in
 * `rustFetch` carries `userId` which scopes every document.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    sabconnectFeedApi,
    type SabConnectFeedCreateInput,
    type SabConnectFeedItemDoc,
    type SabConnectFeedListParams,
    type SabConnectFeedListResponse,
    type SabConnectFeedUpdateInput,
} from '@/lib/rust-client/sabconnect-feed';
import {
    sabconnectGroupsApi,
    type SabConnectGroupCreateInput,
    type SabConnectGroupDoc,
    type SabConnectGroupListParams,
    type SabConnectGroupListResponse,
    type SabConnectGroupUpdateInput,
} from '@/lib/rust-client/sabconnect-groups';
import {
    sabconnectManualsApi,
    type SabConnectManualCreateInput,
    type SabConnectManualDoc,
    type SabConnectManualListParams,
    type SabConnectManualListResponse,
    type SabConnectManualUpdateInput,
} from '@/lib/rust-client/sabconnect-manuals';
import {
    sabconnectReactionsApi,
    type SabConnectReactionListResponse,
    type SabConnectReactionToggleResponse,
} from '@/lib/rust-client/sabconnect-reactions';
import {
    sabconnectCommentsApi,
    type SabConnectCommentCreateInput,
    type SabConnectCommentDoc,
    type SabConnectCommentListParams,
    type SabConnectCommentListResponse,
    type SabConnectCommentUpdateInput,
} from '@/lib/rust-client/sabconnect-comments';
import {
    sabconnectCustomAppsApi,
    type SabConnectCustomAppCreateInput,
    type SabConnectCustomAppDoc,
    type SabConnectCustomAppListParams,
    type SabConnectCustomAppListResponse,
    type SabConnectCustomAppUpdateInput,
} from '@/lib/rust-client/sabconnect-custom-apps';

const BASE = '/dashboard/sabconnect';

export type ErrorResult = { error: string };

async function requireSessionUser() {
    const session = await getSession();
    if (!session?.user?._id) {
        throw new RustApiError(
            401,
            { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } },
            'Sign in required',
        );
    }
    return {
        id: String(session.user._id),
        name: (session.user as any).name as string | undefined,
        avatarUrl: (session.user as any).avatarUrl as string | undefined,
    };
}

function isErr(e: unknown): string {
    if (e instanceof RustApiError) return e.message;
    if (e instanceof Error) return e.message;
    return 'SabConnect request failed';
}

/* ─── Feed ─────────────────────────────────────────────────────────── */

export async function getSabConnectFeed(
    params?: SabConnectFeedListParams,
): Promise<SabConnectFeedListResponse> {
    await requireSessionUser();
    try {
        return await sabconnectFeedApi.list(params);
    } catch (e) {
        console.error('[sabconnect.getSabConnectFeed]', e);
        return { items: [], page: 0, limit: 0, hasMore: false };
    }
}

export async function getSabConnectFeedItem(id: string): Promise<SabConnectFeedItemDoc | null> {
    await requireSessionUser();
    try {
        return await sabconnectFeedApi.getById(id);
    } catch (e) {
        console.error('[sabconnect.getSabConnectFeedItem]', e);
        return null;
    }
}

export async function createSabConnectPost(input: {
    body: string;
    attachmentIds?: string[];
    groupId?: string;
    tags?: string[];
}): Promise<{ id: string } | ErrorResult> {
    const me = await requireSessionUser();
    try {
        const payload: SabConnectFeedCreateInput = {
            authorId: me.id,
            authorName: me.name,
            authorAvatarUrl: me.avatarUrl,
            kind: 'post',
            body: input.body,
            attachmentIds: input.attachmentIds,
            groupId: input.groupId,
            tags: input.tags,
        };
        const res = await sabconnectFeedApi.create(payload);
        revalidatePath(`${BASE}/feed`);
        if (input.groupId) revalidatePath(`${BASE}/groups/${input.groupId}`);
        return { id: res.id };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function updateSabConnectFeedItem(
    id: string,
    patch: SabConnectFeedUpdateInput,
): Promise<{ ok: boolean } | ErrorResult> {
    await requireSessionUser();
    try {
        await sabconnectFeedApi.update(id, patch);
        revalidatePath(`${BASE}/feed`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function deleteSabConnectFeedItem(
    id: string,
): Promise<{ ok: boolean } | ErrorResult> {
    await requireSessionUser();
    try {
        await sabconnectFeedApi.delete(id);
        revalidatePath(`${BASE}/feed`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

/* ─── Groups ───────────────────────────────────────────────────────── */

export async function getSabConnectGroups(
    params?: SabConnectGroupListParams,
): Promise<SabConnectGroupListResponse> {
    await requireSessionUser();
    try {
        return await sabconnectGroupsApi.list(params);
    } catch (e) {
        console.error('[sabconnect.getSabConnectGroups]', e);
        return { items: [], page: 0, limit: 0, hasMore: false };
    }
}

export async function getSabConnectGroup(id: string): Promise<SabConnectGroupDoc | null> {
    await requireSessionUser();
    try {
        return await sabconnectGroupsApi.getById(id);
    } catch (e) {
        console.error('[sabconnect.getSabConnectGroup]', e);
        return null;
    }
}

export async function createSabConnectGroup(
    input: SabConnectGroupCreateInput,
): Promise<{ id: string } | ErrorResult> {
    const me = await requireSessionUser();
    try {
        const res = await sabconnectGroupsApi.create({
            ...input,
            ownerId: input.ownerId ?? me.id,
            memberIds: input.memberIds ?? [me.id],
        });
        revalidatePath(`${BASE}/groups`);
        return { id: res.id };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function updateSabConnectGroup(
    id: string,
    patch: SabConnectGroupUpdateInput,
): Promise<{ ok: boolean } | ErrorResult> {
    await requireSessionUser();
    try {
        await sabconnectGroupsApi.update(id, patch);
        revalidatePath(`${BASE}/groups`);
        revalidatePath(`${BASE}/groups/${id}`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function deleteSabConnectGroup(id: string): Promise<{ ok: boolean } | ErrorResult> {
    await requireSessionUser();
    try {
        await sabconnectGroupsApi.delete(id);
        revalidatePath(`${BASE}/groups`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function joinSabConnectGroup(id: string): Promise<{ ok: boolean } | ErrorResult> {
    const me = await requireSessionUser();
    try {
        await sabconnectGroupsApi.join(id, me.id);
        revalidatePath(`${BASE}/groups/${id}`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function leaveSabConnectGroup(id: string): Promise<{ ok: boolean } | ErrorResult> {
    const me = await requireSessionUser();
    try {
        await sabconnectGroupsApi.leave(id, me.id);
        revalidatePath(`${BASE}/groups/${id}`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

/* ─── Manuals (wiki) ───────────────────────────────────────────────── */

export async function getSabConnectManuals(
    params?: SabConnectManualListParams,
): Promise<SabConnectManualListResponse> {
    await requireSessionUser();
    try {
        return await sabconnectManualsApi.list(params);
    } catch (e) {
        console.error('[sabconnect.getSabConnectManuals]', e);
        return { items: [], page: 0, limit: 0, hasMore: false };
    }
}

export async function getSabConnectManual(id: string): Promise<SabConnectManualDoc | null> {
    await requireSessionUser();
    try {
        return await sabconnectManualsApi.getById(id);
    } catch (e) {
        console.error('[sabconnect.getSabConnectManual]', e);
        return null;
    }
}

export async function createSabConnectManual(
    input: SabConnectManualCreateInput,
): Promise<{ id: string } | ErrorResult> {
    const me = await requireSessionUser();
    try {
        const res = await sabconnectManualsApi.create({
            ...input,
            authorId: input.authorId ?? me.id,
            authorName: input.authorName ?? me.name,
        });
        revalidatePath(`${BASE}/manuals`);
        return { id: res.id };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function updateSabConnectManual(
    id: string,
    patch: SabConnectManualUpdateInput,
): Promise<{ ok: boolean } | ErrorResult> {
    await requireSessionUser();
    try {
        await sabconnectManualsApi.update(id, patch);
        revalidatePath(`${BASE}/manuals`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function deleteSabConnectManual(id: string): Promise<{ ok: boolean } | ErrorResult> {
    await requireSessionUser();
    try {
        await sabconnectManualsApi.delete(id);
        revalidatePath(`${BASE}/manuals`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

/* ─── Reactions ────────────────────────────────────────────────────── */

export async function listSabConnectReactions(
    itemId: string,
): Promise<SabConnectReactionListResponse> {
    await requireSessionUser();
    try {
        return await sabconnectReactionsApi.list(itemId);
    } catch (e) {
        console.error('[sabconnect.listSabConnectReactions]', e);
        return { items: [], countByEmoji: {} };
    }
}

export async function toggleSabConnectReaction(
    itemId: string,
    emoji: string,
): Promise<SabConnectReactionToggleResponse | ErrorResult> {
    const me = await requireSessionUser();
    try {
        const res = await sabconnectReactionsApi.toggle({
            itemId,
            reactorId: me.id,
            reactorName: me.name,
            emoji,
        });
        revalidatePath(`${BASE}/feed`);
        return res;
    } catch (e) {
        return { error: isErr(e) };
    }
}

/* ─── Comments ─────────────────────────────────────────────────────── */

export async function listSabConnectComments(
    params: SabConnectCommentListParams,
): Promise<SabConnectCommentListResponse> {
    await requireSessionUser();
    try {
        return await sabconnectCommentsApi.list(params);
    } catch (e) {
        console.error('[sabconnect.listSabConnectComments]', e);
        return { items: [], page: 0, limit: 0, hasMore: false };
    }
}

export async function createSabConnectComment(input: {
    itemId: string;
    parentCommentId?: string;
    body: string;
    attachmentIds?: string[];
}): Promise<{ id: string; entity: SabConnectCommentDoc } | ErrorResult> {
    const me = await requireSessionUser();
    try {
        const payload: SabConnectCommentCreateInput = {
            ...input,
            authorId: me.id,
            authorName: me.name,
            authorAvatarUrl: me.avatarUrl,
        };
        const res = await sabconnectCommentsApi.create(payload);
        revalidatePath(`${BASE}/feed`);
        return res;
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function updateSabConnectComment(
    id: string,
    patch: SabConnectCommentUpdateInput,
): Promise<{ ok: boolean } | ErrorResult> {
    await requireSessionUser();
    try {
        await sabconnectCommentsApi.update(id, patch);
        revalidatePath(`${BASE}/feed`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function deleteSabConnectComment(id: string): Promise<{ ok: boolean } | ErrorResult> {
    await requireSessionUser();
    try {
        await sabconnectCommentsApi.delete(id);
        revalidatePath(`${BASE}/feed`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

/* ─── Custom Apps ──────────────────────────────────────────────────── */

export async function getSabConnectCustomApps(
    params?: SabConnectCustomAppListParams,
): Promise<SabConnectCustomAppListResponse> {
    await requireSessionUser();
    try {
        return await sabconnectCustomAppsApi.list(params);
    } catch (e) {
        console.error('[sabconnect.getSabConnectCustomApps]', e);
        return { items: [], page: 0, limit: 0, hasMore: false };
    }
}

export async function createSabConnectCustomApp(
    input: SabConnectCustomAppCreateInput,
): Promise<{ id: string } | ErrorResult> {
    await requireSessionUser();
    try {
        const res = await sabconnectCustomAppsApi.create(input);
        revalidatePath(`${BASE}/apps`);
        return { id: res.id };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function updateSabConnectCustomApp(
    id: string,
    patch: SabConnectCustomAppUpdateInput,
): Promise<{ ok: boolean } | ErrorResult> {
    await requireSessionUser();
    try {
        await sabconnectCustomAppsApi.update(id, patch);
        revalidatePath(`${BASE}/apps`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

export async function deleteSabConnectCustomApp(
    id: string,
): Promise<{ ok: boolean } | ErrorResult> {
    await requireSessionUser();
    try {
        await sabconnectCustomAppsApi.delete(id);
        revalidatePath(`${BASE}/apps`);
        return { ok: true };
    } catch (e) {
        return { error: isErr(e) };
    }
}

/* ─── People (employee directory) ──────────────────────────────────── */

export interface SabConnectPerson {
    _id: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    title?: string;
    department?: string;
    phone?: string;
}

/**
 * Read the tenant's people from the existing employees collection. We
 * deliberately keep this in Mongo (not Rust) because the HRM employee
 * directory is the source of truth.
 *
 * TODO: route through the future `crm-employees` Rust client once it
 * exposes a public listing endpoint.
 */
export async function getSabConnectPeople(q?: string): Promise<SabConnectPerson[]> {
    const me = await requireSessionUser();
    try {
        const { connectToDatabase } = await import('@/lib/mongodb');
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = { userId: me.id };
        if (q && q.trim()) {
            filter.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { title: { $regex: q, $options: 'i' } },
            ];
        }
        const rows = await db
            .collection('crm_employees')
            .find(filter, {
                projection: {
                    name: 1,
                    email: 1,
                    avatarUrl: 1,
                    title: 1,
                    department: 1,
                    phone: 1,
                },
            })
            .sort({ name: 1 })
            .limit(200)
            .toArray();
        return rows.map((r: any) => ({
            _id: String(r._id),
            name: r.name,
            email: r.email,
            avatarUrl: r.avatarUrl,
            title: r.title,
            department: r.department,
            phone: r.phone,
        }));
    } catch (e) {
        console.error('[sabconnect.getSabConnectPeople]', e);
        return [];
    }
}
