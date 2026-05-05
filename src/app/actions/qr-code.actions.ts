
'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import type { QrCode, QrCodeWithShortUrl } from '@/lib/definitions';
import { rustClient, RustApiError } from '@/lib/rust-client';

/**
 * Save a new QR code (and an accompanying short URL when `isDynamic` + URL).
 *
 * Migrated to the Rust BFF: the Mongo writes that used to live here now run
 * inside `qr-codes::store::create`. The TS body is just FormData → JSON
 * marshalling plus the legacy `revalidatePath` calls — preserved exactly so
 * call sites and the surrounding `useFormState` hook keep behaving the same.
 */
export async function createQrCode(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; qrCodeUrl?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const name = formData.get('name') as string;
    const dataType = formData.get('dataType') as QrCode['dataType'];
    const dataRaw = formData.get('data') as string;
    const configRaw = formData.get('config') as string;
    let data: Record<string, unknown>;
    let config: Record<string, unknown>;
    try {
        data = JSON.parse(dataRaw);
        config = JSON.parse(configRaw);
    } catch (e: any) {
        return { error: e.message || 'Invalid form data.' };
    }
    const tagIds = (formData.get('tagIds') as string)?.split(',').filter(Boolean) || [];
    const isDynamic = formData.get('isDynamic') === 'on';

    if (!name || !dataType || !data) {
        return { error: 'Name and data are required.' };
    }

    try {
        const result = await rustClient.qrCodes.create({
            name,
            dataType,
            data,
            config,
            tagIds,
            isDynamic,
        });
        revalidatePath('/dashboard/qr-code-maker');
        revalidatePath('/dashboard/qr-code-maker');
        return {
            message: result.message,
            error: result.error,
            qrCodeUrl: result.qrCodeUrl,
        };
    } catch (e: any) {
        const msg = e instanceof RustApiError ? e.message : (e?.message || 'An unexpected error occurred.');
        return { error: msg };
    }
}


/**
 * List the current user's saved QR codes joined with their short-URL rows.
 *
 * The Rust handler runs the same `$lookup` aggregation the legacy TS code
 * did, so the wire shape (`QrCodeWithShortUrl[]`) is unchanged. Returns an
 * empty array on any error to preserve the legacy "swallow and return []"
 * contract — UI components depend on it.
 */
export async function getQrCodes(): Promise<QrCodeWithShortUrl[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        return await rustClient.qrCodes.list<QrCodeWithShortUrl>();
    } catch {
        return [];
    }
}

/**
 * Bulk delete — also wipes any dependent short-URL rows on the Rust side.
 *
 * Returns `{ success, deleted?, error? }` exactly as the legacy action did.
 */
export async function deleteManyQrCodes(ids: string[]): Promise<{ success: boolean; deleted?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const result = await rustClient.qrCodes.deleteMany({ ids });
        revalidatePath('/dashboard/qr-code-maker');
        return result;
    } catch (e: any) {
        const msg = e instanceof RustApiError ? e.message : (e?.message || 'Failed to delete QR codes.');
        return { success: false, error: msg };
    }
}

/**
 * Delete a single QR code (and its dependent short-URL row when present).
 *
 * Mirrors the legacy contract — including the swallowed-error path: the
 * Rust handler always returns `{ success, error? }` so non-2xx HTTP errors
 * here are folded into `success: false`.
 */
export async function deleteQrCode(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const result = await rustClient.qrCodes.delete(id);
        revalidatePath('/dashboard/qr-code-maker');
        return result;
    } catch {
        return { success: false, error: 'Failed to delete QR code.' };
    }
}
