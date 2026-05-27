/** TS client for `/v1/sabcatalyst/records/*` — Datastore records. */
import 'server-only';
import { rustFetch } from './fetcher';

export interface SabcatalystRecord {
    _id: string;
    tableId: string;
    projectId: string;
    userId: string;
    dataJson: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface ListRecordsResponse { items: SabcatalystRecord[]; nextCursor?: string }

function qs(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabcatalystRecordsApi = {
    list: (params: { tableId: string; limit?: number; cursor?: string }) =>
        rustFetch<ListRecordsResponse>(`/v1/sabcatalyst/records/${qs(params)}`),
    get: (id: string) => rustFetch<SabcatalystRecord>(`/v1/sabcatalyst/records/${id}`),
    create: (body: { tableId: string; projectId: string; dataJson: Record<string, unknown> }) =>
        rustFetch<SabcatalystRecord>('/v1/sabcatalyst/records/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    update: (id: string, dataJson: Record<string, unknown>) =>
        rustFetch<SabcatalystRecord>(`/v1/sabcatalyst/records/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ dataJson }),
        }),
    delete: (id: string) => rustFetch<void>(`/v1/sabcatalyst/records/${id}`, { method: 'DELETE' }),
};
