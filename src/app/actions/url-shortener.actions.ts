'use server';

/**
 * Server-action shim for the URL shortener.
 *
 * All Mongo work has moved to `rust/crates/url-shortener`. The bodies
 * here are thin marshallers: parse FormData / read the session, call
 * `rustClient.urlShortener.*`, and run the legacy `revalidatePath`
 * calls Next.js needs to know about. Wire shapes (`{ message, error,
 * shortUrlId, ... }`) are preserved exactly so existing `useFormState`
 * consumers and `<form action>` callers keep working.
 *
 * Bulk import: the uploaded file is forwarded as multipart to
 * `/v1/url-shortener/bulk-upload`. The Rust crate parses CSV via the
 * `csv` crate and XLSX via `calamine`. Nothing TS-side touches the
 * file contents.
 */
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { ObjectId, type WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { rustClient, RustApiError } from '@/lib/rust-client';
import type { ShortUrl, User, CustomDomain } from '@/lib/definitions';

function rustErr(e: unknown): string {
    if (e instanceof RustApiError) return e.message;
    if (e instanceof Error) return e.message;
    return 'An unexpected error occurred.';
}

// ---------------------------------------------------------------------------
// Create / bulk-create
// ---------------------------------------------------------------------------

export async function createShortUrl(
    _prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; shortUrlId?: string; shortCode?: string }> {
    try {
        const result = await rustClient.urlShortener.fromFormCreate(formData);
        revalidatePath('/dashboard/url-shortener');
        return result;
    } catch (e) {
        return { error: rustErr(e) };
    }
}

export async function handleBulkCreateShortUrls(
    _prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    // Forward the entire FormData. The Rust crate validates the file
    // is present, parses CSV (`csv` crate) or XLSX (`calamine`), and
    // bulk-inserts in one round trip.
    try {
        const result = await rustClient.urlShortener.bulkUpload(formData);
        revalidatePath('/dashboard/url-shortener');
        return result;
    } catch (e) {
        return { error: rustErr(e) };
    }
}

// ---------------------------------------------------------------------------
// List / get / delete
// ---------------------------------------------------------------------------

export async function getShortUrls(): Promise<{
    user: (Omit<User, 'password'> & { _id: string }) | null;
    urls: WithId<ShortUrl>[];
    domains: WithId<CustomDomain>[];
}> {
    const session = await getSession();
    if (!session?.user) return { user: null, urls: [], domains: [] };

    try {
        const result = await rustClient.urlShortener.list<WithId<ShortUrl>, WithId<CustomDomain>>();
        return {
            user: (result.user as Omit<User, 'password'> & { _id: string }) || null,
            urls: result.urls,
            domains: result.domains,
        };
    } catch (error) {
        console.error('Failed to fetch short URLs:', error);
        return { user: session.user as any, urls: [], domains: [] };
    }
}

export async function trackClickAndGetUrl(
    shortCode: string,
    hostname: string | null,
): Promise<{
    originalUrl: string | null;
    error?: string;
    passwordHash?: string | null;
    utmParams?: Record<string, string> | null;
    isExpired?: boolean | null;
}> {
    try {
        const headerList = await headers();
        const result = await rustClient.urlShortener.resolveRedirect({
            shortCode,
            hostname,
            userAgent: headerList.get('user-agent'),
            referrer: headerList.get('referer'),
            ip: headerList.get('x-forwarded-for') || headerList.get('x-real-ip'),
        });
        return {
            originalUrl: result.originalUrl ?? null,
            error: result.error,
            passwordHash: result.passwordHash,
            utmParams: result.utmParams as Record<string, string> | null,
            isExpired: result.isExpired,
        };
    } catch (e) {
        console.error('Error tracking click:', e);
        return { originalUrl: null, error: 'Database error.' };
    }
}

export async function deleteShortUrl(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid URL ID.' };

    try {
        const result = await rustClient.urlShortener.deleteOne(id);
        revalidatePath('/dashboard/url-shortener');
        revalidatePath(`/dashboard/url-shortener/${id}`);
        return result;
    } catch (e) {
        return { success: false, error: rustErr(e) };
    }
}

export async function deleteManyShortUrls(
    ids: string[],
): Promise<{ success: boolean; deleted?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const result = await rustClient.urlShortener.deleteMany({ ids });
        revalidatePath('/dashboard/url-shortener');
        return result;
    } catch (e) {
        return { success: false, error: rustErr(e) || 'Failed to delete links.' };
    }
}

export async function getShortUrlById(id: string): Promise<WithId<ShortUrl> | null> {
    if (!ObjectId.isValid(id)) return null;
    const session = await getSession();
    if (!session?.user) return null;

    try {
        return await rustClient.urlShortener.getOne<WithId<ShortUrl>>(id);
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Custom domains
// ---------------------------------------------------------------------------

export async function getCustomDomains(): Promise<WithId<CustomDomain>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        return await rustClient.urlShortener.listDomains<WithId<CustomDomain>>();
    } catch (error) {
        console.error('Failed to fetch custom domains:', error);
        return [];
    }
}

export async function addCustomDomain(
    _prevState: any,
    formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
    try {
        const result = await rustClient.urlShortener.fromFormAddDomain(formData);
        if (result.success) {
            revalidatePath('/dashboard/url-shortener/settings');
            revalidatePath('/dashboard/facebook/custom-ecommerce/settings');
        }
        return result.success ? { success: true } : { error: result.error };
    } catch (e) {
        return { error: rustErr(e) };
    }
}

export async function verifyCustomDomain(
    domainId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const result = await rustClient.urlShortener.verifyDomain(domainId);
        if (result.success) {
            revalidatePath('/dashboard/url-shortener/settings');
            revalidatePath('/dashboard/facebook/custom-ecommerce/settings');
        }
        return result;
    } catch (e) {
        return { success: false, error: 'Failed to verify domain: ' + rustErr(e) };
    }
}

export async function deleteCustomDomain(
    domainId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const result = await rustClient.urlShortener.deleteDomain(domainId);
        if (result.success) {
            revalidatePath('/dashboard/url-shortener/settings');
            revalidatePath('/dashboard/facebook/custom-ecommerce/settings');
        }
        return result;
    } catch (e) {
        return { success: false, error: 'Failed to delete domain.' };
    }
}

export async function updateShortUrl(
    id: string,
    body: import('@/lib/rust-client/url-shortener').UpdateShortUrlBody,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid ID.' };
    try {
        const result = await rustClient.urlShortener.updateOne(id, body);
        revalidatePath('/dashboard/url-shortener');
        revalidatePath(`/dashboard/url-shortener/${id}`);
        return result;
    } catch (e) {
        return { success: false, error: rustErr(e) };
    }
}

export async function getShortUrlAnalyticsTimeline(
    id: string, days = 30,
): Promise<{ date: string; count: number }[]> {
    if (!ObjectId.isValid(id)) return [];
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const r = await rustClient.urlShortener.getAnalyticsTimeline(id, days);
        return r.data;
    } catch { return []; }
}

export async function getShortUrlAnalyticsGeo(
    id: string,
): Promise<{ country: string; count: number }[]> {
    if (!ObjectId.isValid(id)) return [];
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const r = await rustClient.urlShortener.getAnalyticsGeo(id);
        return r.data;
    } catch { return []; }
}

export async function getShortUrlAnalyticsDevices(id: string) {
    if (!ObjectId.isValid(id)) return null;
    const session = await getSession();
    if (!session?.user) return null;
    try {
        return await rustClient.urlShortener.getAnalyticsDevices(id);
    } catch { return null; }
}

export async function getShortUrlAnalyticsReferrers(
    id: string,
): Promise<{ domain: string; count: number }[]> {
    if (!ObjectId.isValid(id)) return [];
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const r = await rustClient.urlShortener.getAnalyticsReferrers(id);
        return r.data;
    } catch { return []; }
}

export async function verifyLinkPassword(
    shortCode: string, password: string,
): Promise<{ valid: boolean; originalUrl?: string; error?: string }> {
    try {
        const result = await rustClient.urlShortener.verifyPassword({ shortCode, passwordHash: password });
        return result;
    } catch (e) {
        return { valid: false, error: rustErr(e) };
    }
}

export async function getShortUrlHistory(id: string): Promise<{ url: string; changedAt: string }[]> {
    if (!ObjectId.isValid(id)) return [];
    const session = await getSession();
    if (!session?.user) return [];
    try {
        return await rustClient.urlShortener.getHistory(id);
    } catch { return []; }
}

export async function rollbackShortUrl(
    id: string, url: string
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid ID.' };
    try {
        const result = await rustClient.urlShortener.rollback(id, { url });
        revalidatePath(`/dashboard/url-shortener/${id}`);
        return result;
    } catch (e) {
        return { success: false, error: rustErr(e) };
    }
}
