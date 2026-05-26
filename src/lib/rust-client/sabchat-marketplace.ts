import 'server-only';

import { rustFetch } from './fetcher';

export interface SabchatApp {
    id: string;
    name: string;
    description: string;
    iconUrl?: string;
    installed: boolean;
    provider: string;
}

export const sabchatMarketplaceApi = {
    list: () => rustFetch<{ items: SabchatApp[] }>('/v1/sabchat/marketplace/apps'),
    install: (appId: string) =>
        rustFetch<{ success: boolean }>(`/v1/sabchat/marketplace/apps/${appId}/install`, {
            method: 'POST',
        }),
    uninstall: (appId: string) =>
        rustFetch<{ success: boolean }>(`/v1/sabchat/marketplace/apps/${appId}/uninstall`, {
            method: 'POST',
        }),
};
