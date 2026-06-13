'use server';

/**
 * SabFiles server actions — thin wrappers over the Rust BFF
 * (`/v1/sabfiles/*`).
 *
 * Browser uploads happen in three phases:
 *   1. `presignUpload({ name, size, mime })` reserves a user-owned R2 key.
 *   2. The browser issues `PUT /api/sabfiles/upload?key=...`.
 *   3. After 200, the browser calls `confirmUpload({ key, name, size, mime })`
 *      to record the file in Mongo.
 *
 * The browser uploads to our own origin; the Next.js route forwards bytes to
 * the Rust BFF, which writes to R2. That keeps uploads independent of R2 bucket
 * CORS configuration.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { rustClient, RustApiError } from '@/lib/rust-client';
import { getSession } from '@/app/actions/user.actions';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import { connectToDatabase } from '@/lib/mongodb';
import { listCrmMembers } from '@/lib/sabcrm/members.server';
import { notifyTeamMember } from '@/lib/team-notifications';
import type {
    SabfilesNode,
    ListNodesQuery,
    LibraryQuery,
    PresignUploadBody,
    ConfirmUploadBody,
    CreateShareBody,
    SabfilesMemberRole,
} from '@/lib/rust-client/sabfiles';
import type {
    SabFileMember,
    SabFileRole,
    SabFolderRollupMap,
} from '@/components/sabfiles/views/types';

async function getActorId(): Promise<string | null> {
    const session = await getSession();
    if (!session?.user) return null;
    const u = session.user as { _id?: string | { toString(): string }; id?: string };
    const userId = u._id ?? u.id;
    if (!userId) return null;
    return typeof userId === 'string' ? userId : String(userId);
}

function pathFor(parentId: string | null | undefined): string {
    if (!parentId) return '/dashboard/sabfiles';
    return `/dashboard/sabfiles/folder/${parentId}`;
}

function asError(e: unknown): { error: string } {
    if (e instanceof RustApiError) return { error: e.message };
    if (e instanceof Error) return { error: e.message };
    return { error: 'Unknown error' };
}

export async function listNodes(query?: ListNodesQuery) {
    try {
        const { nodes } = await rustClient.sabfiles.list(query);
        return { nodes };
    } catch (e) {
        return { ...asError(e), nodes: [] as SabfilesNode[] };
    }
}

export async function getBreadcrumb(id: string | 'root') {
    try {
        const { crumbs } = await rustClient.sabfiles.breadcrumb(id);
        return { crumbs };
    } catch (e) {
        return { ...asError(e), crumbs: [{ id: null, name: 'My files' }] };
    }
}

export async function createFolder(parentId: string | null, name: string) {
    try {
        const { node } = await rustClient.sabfiles.createFolder({
            name,
            parent_id: parentId,
        });
        revalidatePath(pathFor(parentId));
        const actorId = await getActorId();
        if (actorId) {
            void recordFlowAction('sabfile.folder.created', {
                userId: actorId,
                target: (node as { id?: string } | undefined)?.id,
                metadata: { name, parentId },
            });
        }
        return { node };
    } catch (e) {
        return asError(e);
    }
}

export async function presignUpload(body: PresignUploadBody) {
    try {
        const presign = await rustClient.sabfiles.presignUpload(body);
        return {
            ...presign,
            upload_url: `/api/sabfiles/upload?key=${encodeURIComponent(presign.key)}`,
            method: 'PUT',
        };
    } catch (e) {
        return asError(e);
    }
}

export async function confirmUpload(body: ConfirmUploadBody) {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        const { node } = await rustClient.sabfiles.confirmUpload(body);
        revalidatePath(pathFor(body.parent_id));
        const u = session.user as { _id?: string | { toString(): string }; id?: string };
        const actorRaw = u._id ?? u.id;
        const actorId = actorRaw ? (typeof actorRaw === 'string' ? actorRaw : String(actorRaw)) : null;
        if (actorId) {
            void recordFlowAction('sabfile.uploaded', {
                userId: actorId,
                target: (node as { id?: string } | undefined)?.id,
                metadata: {
                    name: (body as { name?: string }).name,
                    size: (body as { size?: number }).size,
                    mime: (body as { mime?: string }).mime,
                    parentId: body.parent_id,
                },
            });
        }
        return { node };
    } catch (e) {
        return asError(e);
    }
}

export async function renameNode(id: string, name: string, parentId: string | null) {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        const { node } = await rustClient.sabfiles.rename(id, name);
        revalidatePath(pathFor(parentId));
        const u = session.user as { _id?: string | { toString(): string }; id?: string };
        const actorRaw = u._id ?? u.id;
        const actorId = actorRaw ? (typeof actorRaw === 'string' ? actorRaw : String(actorRaw)) : null;
        if (actorId) {
            void recordFlowAction('sabfile.renamed', {
                userId: actorId,
                target: id,
                metadata: { name, parentId },
            });
        }
        return { node };
    } catch (e) {
        return asError(e);
    }
}

export async function moveNodes(
    ids: string[],
    targetParentId: string | null,
    sourceParentId: string | null,
) {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        const res = await rustClient.sabfiles.move(ids, targetParentId);
        revalidatePath(pathFor(sourceParentId));
        revalidatePath(pathFor(targetParentId));
        return res;
    } catch (e) {
        return asError(e);
    }
}

export async function starNodes(ids: string[], starred: boolean, parentId: string | null) {
    try {
        const res = await rustClient.sabfiles.star(ids, starred);
        revalidatePath(pathFor(parentId));
        revalidatePath('/dashboard/sabfiles/starred');
        return res;
    } catch (e) {
        return asError(e);
    }
}

export async function trashNodes(ids: string[], parentId: string | null) {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        const res = await rustClient.sabfiles.trashMany(ids);
        revalidatePath(pathFor(parentId));
        revalidatePath('/dashboard/sabfiles/trash');
        const u = session.user as { _id?: string | { toString(): string }; id?: string };
        const actorRaw = u._id ?? u.id;
        const actorId = actorRaw ? (typeof actorRaw === 'string' ? actorRaw : String(actorRaw)) : null;
        if (actorId) {
            void recordFlowAction('sabfile.deleted', {
                userId: actorId,
                metadata: { ids, parentId, mode: 'trash' },
            });
        }
        return res;
    } catch (e) {
        return asError(e);
    }
}

export async function restoreNodes(ids: string[]) {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        const res = await rustClient.sabfiles.restore(ids);
        revalidatePath('/dashboard/sabfiles/trash');
        revalidatePath('/dashboard/sabfiles');
        return res;
    } catch (e) {
        return asError(e);
    }
}

export async function permanentDelete(ids: string[]) {
    try {
        const res = await rustClient.sabfiles.permanentDelete(ids);
        revalidatePath('/dashboard/sabfiles/trash');
        const actorId = await getActorId();
        if (actorId) {
            void recordFlowAction('sabfile.deleted', {
                userId: actorId,
                metadata: { ids, mode: 'permanent' },
            });
        }
        return res;
    } catch (e) {
        return asError(e);
    }
}

export async function emptyTrash() {
    try {
        const res = await rustClient.sabfiles.emptyTrash();
        revalidatePath('/dashboard/sabfiles/trash');
        return res;
    } catch (e) {
        return asError(e);
    }
}

export async function getDownloadUrl(id: string) {
    try {
        return await rustClient.sabfiles.download(id);
    } catch (e) {
        return asError(e);
    }
}

export async function createShare(id: string, body: CreateShareBody, parentId: string | null) {
    try {
        const res = await rustClient.sabfiles.createShare(id, body);
        revalidatePath(pathFor(parentId));
        revalidatePath('/dashboard/sabfiles/shared');
        const actorId = await getActorId();
        if (actorId) {
            void recordFlowAction('sabfile.shareLink.created', {
                userId: actorId,
                target: id,
                metadata: { parentId },
            });
        }
        return res;
    } catch (e) {
        return asError(e);
    }
}

export async function revokeShare(id: string, parentId: string | null) {
    try {
        const res = await rustClient.sabfiles.revokeShare(id);
        revalidatePath(pathFor(parentId));
        revalidatePath('/dashboard/sabfiles/shared');
        const actorId = await getActorId();
        if (actorId) {
            void recordFlowAction('sabfile.shareLink.revoked', {
                userId: actorId,
                target: id,
                metadata: { parentId },
            });
        }
        return res;
    } catch (e) {
        return asError(e);
    }
}

export async function getStarred() {
    try {
        return await rustClient.sabfiles.starred();
    } catch (e) {
        return { ...asError(e), nodes: [] as SabfilesNode[] };
    }
}

export async function getRecent() {
    try {
        return await rustClient.sabfiles.recent();
    } catch (e) {
        return { ...asError(e), nodes: [] as SabfilesNode[] };
    }
}

export async function getTrash() {
    try {
        return await rustClient.sabfiles.trash();
    } catch (e) {
        return { ...asError(e), nodes: [] as SabfilesNode[] };
    }
}

export async function getShared() {
    try {
        return await rustClient.sabfiles.shared();
    } catch (e) {
        return { ...asError(e), nodes: [] as SabfilesNode[] };
    }
}

export async function getStorageUsage() {
    try {
        return await rustClient.sabfiles.storage();
    } catch (e) {
        return { ...asError(e), used: 0, count: 0 };
    }
}

export async function getLibrary(q?: LibraryQuery) {
    try {
        return await rustClient.sabfiles.library(q);
    } catch (e) {
        return { ...asError(e), nodes: [] as SabfilesNode[] };
    }
}

export async function searchFiles(q: string) {
    try {
        return await rustClient.sabfiles.search(q);
    } catch (e) {
        return { ...asError(e), nodes: [] as SabfilesNode[] };
    }
}

// ───────────────────────────────────────────────────────────────────────
// Folder rollups (per-folder file count + size for the folder cards)
// ───────────────────────────────────────────────────────────────────────

export async function getFolderRollups(parentId: string | null): Promise<SabFolderRollupMap> {
    try {
        const { rollups } = await rustClient.sabfiles.folderRollups(parentId);
        const out: SabFolderRollupMap = {};
        for (const [id, r] of Object.entries(rollups)) {
            out[id] = { fileCount: r.file_count, totalBytes: r.total_bytes };
        }
        return out;
    } catch {
        // Rollups are decorative — never block the page on a failure.
        return {};
    }
}

// ───────────────────────────────────────────────────────────────────────
// Collaborators (share files/folders with other SabNode users)
// ───────────────────────────────────────────────────────────────────────

export type SabfilesUserProfile = {
    userId: string;
    name: string;
    email: string;
    image?: string;
};

/** Resolve a batch of user ids to display profiles (name/email/avatar). */
async function enrichProfiles(
    userIds: string[],
): Promise<Record<string, SabfilesUserProfile>> {
    const unique = Array.from(new Set(userIds.filter(Boolean)));
    if (unique.length === 0) return {};
    const oids: ObjectId[] = [];
    for (const id of unique) {
        try {
            oids.push(new ObjectId(id));
        } catch {
            // Skip non-ObjectId ids rather than failing the whole batch.
        }
    }
    if (oids.length === 0) return {};
    const { db } = await connectToDatabase();
    const docs = await db
        .collection('users')
        .find({ _id: { $in: oids } }, { projection: { name: 1, email: 1, image: 1 } })
        .toArray();
    const out: Record<string, SabfilesUserProfile> = {};
    for (const d of docs) {
        const id = String(d._id);
        out[id] = {
            userId: id,
            name: (d.name as string) || '',
            email: (d.email as string) || '',
            image: (d.image as string) || undefined,
        };
    }
    return out;
}

/** Batch profile lookup for the file table / grid member avatars. */
export async function getUserProfiles(userIds: string[]) {
    try {
        return { profiles: await enrichProfiles(userIds) };
    } catch (e) {
        return { ...asError(e), profiles: {} as Record<string, SabfilesUserProfile> };
    }
}

/** The owner + collaborators on a node, enriched with profiles. */
export async function listFileMembers(
    nodeId: string,
): Promise<{ members: SabFileMember[]; error?: string }> {
    try {
        const { members } = await rustClient.sabfiles.listMembers(nodeId);
        const profiles = await enrichProfiles(members.map((m) => m.user_id));
        const enriched: SabFileMember[] = members.map((m) => {
            const p = profiles[m.user_id];
            return {
                userId: m.user_id,
                name: p?.name || p?.email || 'Unknown user',
                email: p?.email || '',
                image: p?.image,
                role: m.role as SabFileRole,
                isOwner: m.is_owner,
            };
        });
        return { members: enriched };
    } catch (e) {
        return { ...asError(e), members: [] };
    }
}

/** Workspace members the current user can share with (for the share dialog). */
export async function listShareablePeople(): Promise<{
    people: { userId: string; name: string; email: string; image?: string }[];
}> {
    try {
        const session = await getSession();
        const projectId = (session?.user as { activeProjectId?: string } | undefined)?.activeProjectId;
        if (!projectId) return { people: [] };
        const members = await listCrmMembers(projectId);
        return {
            people: members.map((m) => ({
                userId: m.userId,
                name: m.name || m.email,
                email: m.email,
                image: m.image,
            })),
        };
    } catch {
        return { people: [] };
    }
}

/** Add (or update the role of) a collaborator on a node, by email. */
export async function addFileMember(
    nodeId: string,
    email: string,
    role: SabFileRole,
    parentId: string | null,
) {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    const normalized = email.trim().toLowerCase();
    if (!normalized) return { error: 'Email is required' };
    try {
        const { db } = await connectToDatabase();
        const target = await db
            .collection('users')
            .findOne({ email: normalized }, { projection: { name: 1, email: 1, image: 1 } });
        if (!target) return { error: 'No SabNode account uses that email.' };
        const targetId = String(target._id);
        const nextRole: SabfilesMemberRole = role === 'editor' ? 'editor' : 'viewer';
        await rustClient.sabfiles.addMember(nodeId, targetId, nextRole);
        revalidatePath(pathFor(parentId));
        revalidatePath('/dashboard/sabfiles/shared-with-me');
        const sharer = session.user as { name?: string; email?: string };
        const sharerName = sharer.name || sharer.email || 'Someone';
        void notifyTeamMember({
            recipientUserId: targetId,
            message: `${sharerName} shared a file with you`,
            link: '/dashboard/sabfiles/shared-with-me',
            eventType: 'FILE_SHARED',
        });
        const actorId = await getActorId();
        if (actorId) {
            void recordFlowAction('sabfile.member.added', {
                userId: actorId,
                target: nodeId,
                metadata: { targetId, role: nextRole },
            });
        }
        const member: SabFileMember = {
            userId: targetId,
            name: (target.name as string) || (target.email as string) || normalized,
            email: (target.email as string) || normalized,
            image: (target.image as string) || undefined,
            role: nextRole,
            isOwner: false,
        };
        return { ok: true, member };
    } catch (e) {
        return asError(e);
    }
}

/** Remove a collaborator from a node. */
export async function removeFileMember(
    nodeId: string,
    userId: string,
    parentId: string | null,
) {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        const res = await rustClient.sabfiles.removeMember(nodeId, userId);
        revalidatePath(pathFor(parentId));
        revalidatePath('/dashboard/sabfiles/shared-with-me');
        return res;
    } catch (e) {
        return asError(e);
    }
}

export async function getSharedWithMe() {
    try {
        return await rustClient.sabfiles.sharedWithMe();
    } catch (e) {
        return { ...asError(e), nodes: [] as SabfilesNode[] };
    }
}
