/**
 * Stable URL for an authenticated user's inline SabFiles preview.
 *
 * This mirrors `/api/sabfiles/raw/<id>`, but asks the Rust BFF for an inline
 * presigned URL so embeddable previews do not inherit download-only headers.
 */
import { NextResponse } from 'next/server';

import { rustClient, RustApiError } from '@/lib/rust-client';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    try {
        const { url } = await rustClient.sabfiles.preview(id);
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
