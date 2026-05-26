import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatMacro {
    _id: string;
    tenantId: string;
    name: string;
    content: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export const sabchatMacrosApi = {
    create: (body: { name: string; content: string; active?: boolean }) =>
        rustFetch<SabChatMacro>('/v1/sabchat/macros/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    list: () => rustFetch<{ items: SabChatMacro[] }>('/v1/sabchat/macros/'),

    get: (id: string) => rustFetch<SabChatMacro>(`/v1/sabchat/macros/${id}`),

    update: (id: string, body: Partial<{ name: string; content: string; active: boolean }>) =>
        rustFetch<SabChatMacro>(`/v1/sabchat/macros/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    delete: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/macros/${id}`, { method: 'DELETE' }),
};
