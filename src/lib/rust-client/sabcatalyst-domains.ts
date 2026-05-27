/** TS client for `/v1/sabcatalyst/domains/*`. */
import 'server-only';
import { rustFetch } from './fetcher';

export type SslStatus = 'pending' | 'issued' | 'failed';

export interface SabcatalystDomain {
    _id: string;
    projectId: string;
    userId: string;
    hostname: string;
    verified: boolean;
    sslStatus: SslStatus;
    createdAt: string;
    updatedAt: string;
}

export interface ListDomainsResponse { items: SabcatalystDomain[] }

export const sabcatalystDomainsApi = {
    list: (projectId: string) =>
        rustFetch<ListDomainsResponse>(
            `/v1/sabcatalyst/domains/?projectId=${encodeURIComponent(projectId)}`,
        ),
    create: (body: { projectId: string; hostname: string }) =>
        rustFetch<SabcatalystDomain>('/v1/sabcatalyst/domains/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    update: (id: string, body: { verified?: boolean; sslStatus?: SslStatus }) =>
        rustFetch<SabcatalystDomain>(`/v1/sabcatalyst/domains/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    delete: (id: string) =>
        rustFetch<void>(`/v1/sabcatalyst/domains/${id}`, { method: 'DELETE' }),
};
