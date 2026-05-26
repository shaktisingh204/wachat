import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatTeam {
    _id: string;
    tenantId: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export const sabchatTeamsApi = {
    create: (body: { name: string; description?: string }) =>
        rustFetch<SabChatTeam>('/v1/sabchat/teams/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    list: () => rustFetch<{ items: SabChatTeam[] }>('/v1/sabchat/teams/'),

    get: (id: string) => rustFetch<SabChatTeam>(`/v1/sabchat/teams/${id}`),

    update: (id: string, body: Partial<{ name: string; description: string }>) =>
        rustFetch<SabChatTeam>(`/v1/sabchat/teams/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    delete: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/teams/${id}`, { method: 'DELETE' }),
};
