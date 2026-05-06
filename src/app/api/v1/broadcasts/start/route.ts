

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-platform/auth';
import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';
import { RustApiError } from '@/lib/rust-client';
import type {
    StartBroadcastBody,
    MessageResponse,
} from '@/lib/rust-client/wachat-broadcast';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
    const ctx = await verifyApiKey(request);
    if (!ctx) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const userId = ctx.tenantId;
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${userId}:broadcast`, 10, 60 * 1000); // 10 broadcasts per minute
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { projectId, phoneNumberId, templateId, tagIds, variableMappings } = body;

        if (!projectId || !phoneNumberId || !templateId || !tagIds || !Array.isArray(tagIds)) {
            return NextResponse.json({ error: 'projectId, phoneNumberId, templateId, and tagIds (array) are required.' }, { status: 400 });
        }

        const startBody: StartBroadcastBody = {
            projectId,
            phoneNumberId,
            broadcastType: 'template',
            templateId,
            audienceType: 'tags',
            tagIds,
            fileName: 'api-broadcast',
            globalBodyVars: variableMappings ?? null,
        };

        const result = await rustFetchAsUser<MessageResponse>(
            userId,
            '/v1/wachat/broadcast/start',
            { method: 'POST', body: JSON.stringify(startBody) },
        );

        return NextResponse.json({ success: true, message: result.message });
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return NextResponse.json({ error: e.message }, { status: e.status || 500 });
        }
        return NextResponse.json({ error: e?.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
