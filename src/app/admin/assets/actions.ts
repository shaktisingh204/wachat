'use server';

import { rustAdminFetch } from '@/lib/rust-client/fetcher';

export async function getAdminBuilderAssets() {
    try {
        const res = await rustAdminFetch<{ items?: any[] }>('/v1/builder/assets');
        return res.items || [];
    } catch (error) {
        console.error('Failed to fetch admin builder assets:', error);
        return [];
    }
}
