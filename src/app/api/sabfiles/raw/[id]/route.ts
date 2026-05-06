/**
 * Stable URL for an authenticated user's SabFiles object.
 *
 * Used by the SabFilePicker as a fallback when `R2_PUBLIC_URL` isn't
 * configured: instead of embedding an opaque presigned URL (which
 * expires), callers store `/api/sabfiles/raw/<id>` in their data and
 * this route 302-redirects to a fresh presigned download URL on every
 * request.
 *
 * Auth: standard SabNode session — only the file's owner can resolve
 * its content. Public sharing has its own surface at `/share/[token]`.
 */
import { NextResponse } from 'next/server';

import { rustClient, RustApiError } from '@/lib/rust-client';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    try {
        const { url } = await rustClient.sabfiles.download(id);
        return NextResponse.redirect(url, 302);
    } catch (e) {
        if (e instanceof RustApiError) {
            return NextResponse.json(
                { ok: false, error: e.message },
                { status: e.status },
            );
        }
        return NextResponse.json(
            { ok: false, error: 'Internal error' },
            { status: 500 },
        );
    }
}
