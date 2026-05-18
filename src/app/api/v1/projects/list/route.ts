import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-platform/auth';
import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';
import { RustApiError } from '@/lib/rust-client';
import type { RustProjectListResponse } from '@/lib/rust-client/projects';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
    const ctx = await verifyApiKey(request);
    if (!ctx) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const userId = ctx.tenantId;
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${userId}:projects`, 60, 60 * 1000);
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const result = await rustFetchAsUser<RustProjectListResponse>(
            userId,
            '/v1/projects?type=whatsapp',
        );
        return NextResponse.json({ success: true, data: result.projects ?? [] });
    } catch (e: any) {
        if (e instanceof RustApiError && e.status === 401) {
            return NextResponse.json({ success: true, data: [] });
        }
        if (e instanceof RustApiError) {
            return NextResponse.json({ error: e.message }, { status: e.status || 500 });
        }
        return NextResponse.json({ error: e?.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
