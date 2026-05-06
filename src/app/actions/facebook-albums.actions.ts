'use server';

/**
 * Server-action wrappers around the `wachat-facebook-content` Rust
 * crate's photo & album endpoints. Used by /dashboard/facebook/albums.
 */

import { rustClient, RustApiError } from '@/lib/rust-client';

export async function getFacebookAlbumsAction(
    projectId: string,
): Promise<{ data?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPageAlbums(projectId);
        return { data: res.data ?? [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        return { error: String(e) };
    }
}

export async function getFacebookAlbumPhotosAction(
    projectId: string,
    albumId: string,
): Promise<{ data?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getAlbumPhotos(projectId, albumId);
        return { data: res.data ?? [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        return { error: String(e) };
    }
}
