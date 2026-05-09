import { NextRequest, NextResponse } from 'next/server';

import { rustClient, RustApiError } from '@/lib/rust-client';
import { getErrorMessage } from '@/lib/utils';

export async function PUT(req: NextRequest) {
    const key = req.nextUrl.searchParams.get('key');
    if (!key) {
        return NextResponse.json({ error: 'Upload key is required.' }, { status: 400 });
    }

    try {
        const contentType = req.headers.get('content-type') || undefined;
        const body = await req.arrayBuffer();
        await rustClient.sabfiles.proxyUpload(key, body, contentType);
        return NextResponse.json({ ok: true });
    } catch (error) {
        const status = error instanceof RustApiError ? error.status : 500;
        return NextResponse.json(
            { error: getErrorMessage(error) || 'Upload failed.' },
            { status },
        );
    }
}
