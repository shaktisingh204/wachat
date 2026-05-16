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

import { rustClient, RustApiError } from '@/lib/rust-client';
import { getSession } from '@/app/actions/user.actions';
import type {
    SabfilesNode,
    ListNodesQuery,
    LibraryQuery,
    PresignUploadBody,
    ConfirmUploadBody,
    CreateShareBody,
} from '@/lib/rust-client/sabfiles';

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
