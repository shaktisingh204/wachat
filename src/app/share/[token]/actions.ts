'use server';

import { rustClient, RustApiError } from '@/lib/rust-client';

export async function fetchPublicDownloadUrl(token: string, password?: string) {
    try {
        return await rustClient.sabfiles.publicShareDownload(token, password || undefined);
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        if (e instanceof Error) return { error: e.message };
        return { error: 'Unknown error' };
    }
}

export async function fetchPublicPreviewUrl(token: string, password?: string) {
    try {
        return await rustClient.sabfiles.publicSharePreview(token, password || undefined);
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        if (e instanceof Error) return { error: e.message };
        return { error: 'Unknown error' };
    }
}
