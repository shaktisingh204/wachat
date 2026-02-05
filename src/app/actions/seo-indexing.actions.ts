'use server';

import { IndexNowClient } from '@/lib/seo/indexnow-client';

export async function submitUrlsToIndexNow(host: string, urls: string[]) {
    try {
        const res = await IndexNowClient.submitToIndexNow(host, urls);
        return { ...res };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getIndexNowKey() {
    return IndexNowClient.getKey();
}
