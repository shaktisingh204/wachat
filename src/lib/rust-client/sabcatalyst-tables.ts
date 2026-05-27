/** TS client for `/v1/sabcatalyst/tables/*` — Datastore table schemas. */
import 'server-only';
import { rustFetch } from './fetcher';

export interface TableField {
    name: string;
    type: string;
    nullable?: boolean;
    indexed?: boolean;
}
export interface TableSchema { fields: TableField[] }

export interface SabcatalystTable {
    _id: string;
    projectId: string;
    userId: string;
    name: string;
    schemaJson: TableSchema;
    recordsCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface ListTablesResponse { items: SabcatalystTable[]; nextCursor?: string }

function qs(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabcatalystTablesApi = {
    list: (params: { projectId: string; limit?: number; cursor?: string }) =>
        rustFetch<ListTablesResponse>(`/v1/sabcatalyst/tables/${qs(params)}`),
    get: (id: string) => rustFetch<SabcatalystTable>(`/v1/sabcatalyst/tables/${id}`),
    create: (body: { projectId: string; name: string; schemaJson: TableSchema }) =>
        rustFetch<SabcatalystTable>('/v1/sabcatalyst/tables/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    update: (id: string, body: { name?: string; schemaJson?: TableSchema }) =>
        rustFetch<SabcatalystTable>(`/v1/sabcatalyst/tables/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    delete: (id: string) => rustFetch<void>(`/v1/sabcatalyst/tables/${id}`, { method: 'DELETE' }),
};
