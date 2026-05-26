import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatBusinessHour {
    _id: string;
    tenantId: string;
    name: string;
    timezone: string;
    windows: { day: number; open: string; close: string }[];
    createdAt: string;
    updatedAt: string;
}

export const sabchatBusinessHoursApi = {
    create: (body: { name: string; timezone: string; windows: { day: number; open: string; close: string }[] }) =>
        rustFetch<SabChatBusinessHour>('/v1/sabchat/business-hours/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    list: () => rustFetch<{ items: SabChatBusinessHour[] }>('/v1/sabchat/business-hours/'),

    get: (id: string) => rustFetch<SabChatBusinessHour>(`/v1/sabchat/business-hours/${id}`),

    update: (id: string, body: Partial<{ name: string; timezone: string; windows: { day: number; open: string; close: string }[] }>) =>
        rustFetch<SabChatBusinessHour>(`/v1/sabchat/business-hours/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    delete: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/business-hours/${id}`, { method: 'DELETE' }),
};
