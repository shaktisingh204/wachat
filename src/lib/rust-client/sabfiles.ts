/**
 * SabFiles client — file manager backed by Cloudflare R2.
 *
 * Mirrors `rust/crates/sabfiles` 1:1. Every method here corresponds to
 * a route on `/v1/sabfiles/*` in the Rust BFF.
 */
import 'server-only';

import { rustFetch, rustPublicFetch } from './fetcher';

export type SabfilesNode = {
    _id: string;
    id: string;
    userId: string;
    parentId: string | null;
    type: 'file' | 'folder';
    name: string;
    size?: number;
    mime?: string;
    r2Key?: string;
    url?: string;
    starred?: boolean;
    trashed?: boolean;
    trashedAt?: string;
    shareToken?: string;
    shareExpiresAt?: string;
    shareDownloadEnabled?: boolean;
    sharePassword?: string;
    createdAt: string;
    updatedAt: string;
};

export type SabfilesNodesResponse = { nodes: SabfilesNode[] };
export type SabfilesNodeResponse = { node: SabfilesNode };
export type SabfilesBreadcrumbEntry = { id: string | null; name: string };
export type SabfilesBreadcrumbResponse = { crumbs: SabfilesBreadcrumbEntry[] };
export type SabfilesOk = { ok: boolean; affected?: number };
export type SabfilesStorage = { used: number; count: number; quota?: number };

export type PresignUploadBody = {
    name: string;
    size: number;
    mime?: string;
    parent_id?: string | null;
};

export type PresignUploadResponse = {
    upload_url: string;
    key: string;
    method: string;
    headers: Record<string, string>;
    expires_in: number;
};

export type ConfirmUploadBody = {
    key: string;
    name: string;
    size: number;
    mime?: string;
    parent_id?: string | null;
};

export type CreateFolderBody = {
    name: string;
    parent_id?: string | null;
};

export type CreateShareBody = {
    expires_at?: string | null;
    download_enabled?: boolean;
    password?: string | null;
};

export type ShareResponse = {
    token: string;
    url: string;
    expires_at?: string;
    download_enabled: boolean;
    password_protected: boolean;
};

export type PublicShareView = {
    name: string;
    type: 'file' | 'folder';
    size?: number;
    mime?: string;
    thumbnail_url?: string;
    download_enabled: boolean;
    password_protected: boolean;
};

export type ListNodesQuery = {
    parent?: string | null;
    sort?: 'name' | 'modified' | 'size';
    dir?: 'asc' | 'desc';
    query?: string;
};

function qs(params: Record<string, string | number | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        search.set(k, String(v));
    }
    const out = search.toString();
    return out ? `?${out}` : '';
}

export const sabfilesApi = {
    list: (q?: ListNodesQuery) =>
        rustFetch<SabfilesNodesResponse>(
            `/v1/sabfiles/nodes${qs({
                parent: q?.parent ?? undefined,
                sort: q?.sort,
                dir: q?.dir,
                query: q?.query,
            })}`,
        ),
    get: (id: string) => rustFetch<SabfilesNodeResponse>(`/v1/sabfiles/nodes/${id}`),
    breadcrumb: (id: string | 'root') =>
        rustFetch<SabfilesBreadcrumbResponse>(`/v1/sabfiles/breadcrumb/${id}`),
    search: (query: string, limit?: number) =>
        rustFetch<SabfilesNodesResponse>(
            `/v1/sabfiles/search${qs({ q: query, limit })}`,
        ),
    starred: () => rustFetch<SabfilesNodesResponse>(`/v1/sabfiles/starred`),
    recent: () => rustFetch<SabfilesNodesResponse>(`/v1/sabfiles/recent`),
    trash: () => rustFetch<SabfilesNodesResponse>(`/v1/sabfiles/trash`),
    shared: () => rustFetch<SabfilesNodesResponse>(`/v1/sabfiles/shared`),
    storage: () => rustFetch<SabfilesStorage>(`/v1/sabfiles/storage`),

    createFolder: (body: CreateFolderBody) =>
        rustFetch<SabfilesNodeResponse>(`/v1/sabfiles/folders`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    presignUpload: (body: PresignUploadBody) =>
        rustFetch<PresignUploadResponse>(`/v1/sabfiles/upload/presign`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    confirmUpload: (body: ConfirmUploadBody) =>
        rustFetch<SabfilesNodeResponse>(`/v1/sabfiles/upload/confirm`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    rename: (id: string, name: string) =>
        rustFetch<SabfilesNodeResponse>(`/v1/sabfiles/nodes/${id}/rename`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
        }),
    move: (ids: string[], targetParentId: string | null) =>
        rustFetch<SabfilesOk>(`/v1/sabfiles/nodes/move`, {
            method: 'POST',
            body: JSON.stringify({ ids, target_parent_id: targetParentId }),
        }),
    star: (ids: string[], starred: boolean) =>
        rustFetch<SabfilesOk>(`/v1/sabfiles/nodes/star`, {
            method: 'POST',
            body: JSON.stringify({ ids, starred }),
        }),
    trashMany: (ids: string[]) =>
        rustFetch<SabfilesOk>(`/v1/sabfiles/nodes/trash`, {
            method: 'POST',
            body: JSON.stringify({ ids }),
        }),
    restore: (ids: string[]) =>
        rustFetch<SabfilesOk>(`/v1/sabfiles/nodes/restore`, {
            method: 'POST',
            body: JSON.stringify({ ids }),
        }),
    permanentDelete: (ids: string[]) =>
        rustFetch<SabfilesOk>(`/v1/sabfiles/nodes`, {
            method: 'DELETE',
            body: JSON.stringify({ ids }),
        }),
    emptyTrash: () =>
        rustFetch<SabfilesOk>(`/v1/sabfiles/trash/empty`, { method: 'POST' }),
    download: (id: string) =>
        rustFetch<{ url: string }>(`/v1/sabfiles/nodes/${id}/download`),

    createShare: (id: string, body: CreateShareBody) =>
        rustFetch<ShareResponse>(`/v1/sabfiles/nodes/${id}/share`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    revokeShare: (id: string) =>
        rustFetch<SabfilesOk>(`/v1/sabfiles/nodes/${id}/share`, {
            method: 'DELETE',
        }),
    publicShareView: (token: string) =>
        rustPublicFetch<PublicShareView>(`/v1/sabfiles/share/${token}`),
    publicShareDownload: (token: string, password?: string) =>
        rustPublicFetch<{ url: string }>(
            `/v1/sabfiles/share/${token}/download${qs({ password })}`,
        ),
};

export type SabfilesApi = typeof sabfilesApi;
