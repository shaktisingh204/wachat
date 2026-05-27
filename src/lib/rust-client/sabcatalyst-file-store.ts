/** TS client for `/v1/sabcatalyst/file-store/*`. */
import 'server-only';
import { rustFetch } from './fetcher';

export interface SabcatalystFileStoreEntry {
    _id: string;
    projectId: string;
    userId: string;
    key: string;
    sabfilesFileId: string;
    sizeBytes: number;
    contentType: string;
    public: boolean;
    uploadedAt: string;
}

export interface ListEntriesResponse { items: SabcatalystFileStoreEntry[]; nextCursor?: string }

function qs(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabcatalystFileStoreApi = {
    list: (params: { projectId: string; keyPrefix?: string; limit?: number; cursor?: string }) =>
        rustFetch<ListEntriesResponse>(`/v1/sabcatalyst/file-store/${qs(params)}`),
    create: (body: {
        projectId: string;
        key: string;
        sabfilesFileId: string;
        sizeBytes: number;
        contentType: string;
        public?: boolean;
    }) =>
        rustFetch<SabcatalystFileStoreEntry>('/v1/sabcatalyst/file-store/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    delete: (id: string) =>
        rustFetch<void>(`/v1/sabcatalyst/file-store/${id}`, { method: 'DELETE' }),
};
