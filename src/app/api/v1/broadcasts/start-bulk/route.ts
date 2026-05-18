import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-platform/auth';
import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';
import { RustApiError } from '@/lib/rust-client';
import type {
    ApiBroadcastBody,
    MessageResponse,
} from '@/lib/rust-client/wachat-broadcast';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
    const ctx = await verifyApiKey(request);
    if (!ctx) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const userId = ctx.tenantId;
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${userId}:broadcast-bulk`, 5, 60 * 1000); // 5 bulk broadcasts per minute
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { projectId, phoneNumberId, templateId, contacts, variableMappings } = body;

        if (!projectId || !phoneNumberId || !templateId || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
            return NextResponse.json({ error: 'projectId, phoneNumberId, templateId, and a non-empty contacts array are required.' }, { status: 400 });
        }

        // Mirror handleStartApiBroadcast's contact-shape coercion: legacy
        // callers passed loose `Phone`/`PHONE` keys, and the variables
        // bag is the entire row.
        const apiBody: ApiBroadcastBody = {
            projectId,
            phoneNumberId,
            templateId,
            contacts: contacts.map((c: any) => ({
                phone: String(c.phone ?? c.Phone ?? c.PHONE ?? '').trim(),
                name: c.name ?? c.Name ?? 'Subscriber',
                variables: c,
            })),
            variableMappings,
        };

        const result = await rustFetchAsUser<MessageResponse>(
            userId,
            '/v1/wachat/broadcast/api-start',
            { method: 'POST', body: JSON.stringify(apiBody) },
        );

        return NextResponse.json({ success: true, message: result.message });
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return NextResponse.json({ error: e.message }, { status: e.status || 500 });
        }
        return NextResponse.json({ error: e?.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
