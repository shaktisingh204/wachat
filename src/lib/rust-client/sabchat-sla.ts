import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatSla {
    _id: string;
    tenantId: string;
    name: string;
    firstResponseMinutes?: number;
    resolutionMinutes?: number;
    createdAt: string;
    updatedAt: string;
}

export const sabchatSlaApi = {
    create: (body: { name: string; firstResponseMinutes?: number; resolutionMinutes?: number }) =>
        rustFetch<SabChatSla>('/v1/sabchat/sla/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    list: () => rustFetch<{ items: SabChatSla[] }>('/v1/sabchat/sla/'),

    get: (id: string) => rustFetch<SabChatSla>(`/v1/sabchat/sla/${id}`),

    update: (id: string, body: Partial<{ name: string; firstResponseMinutes: number; resolutionMinutes: number }>) =>
        rustFetch<SabChatSla>(`/v1/sabchat/sla/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    delete: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/sla/${id}`, { method: 'DELETE' }),
};
