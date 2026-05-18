import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-platform/auth';
import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';
import { RustApiError } from '@/lib/rust-client';
import type {
    AddContactBody,
    AddContactResponse,
} from '@/lib/rust-client/wachat-contacts';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
    const ctx = await verifyApiKey(request);
    if (!ctx) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const userId = ctx.tenantId;
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${userId}:contacts`, 120, 60 * 1000); // 120 contacts per minute
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { projectId, phoneNumberId, name, waId, countryCode, phone } = body;

        if (!projectId || !phoneNumberId || !name || (!waId && !phone)) {
            return NextResponse.json({ error: 'projectId, phoneNumberId, name, and waId are required.' }, { status: 400 });
        }

        // Preserve the legacy contract: callers send a single `waId`
        // (full E.164 number). Forward it as `phone` with an empty
        // `countryCode` — the Rust handler strips non-digit characters
        // and concatenates, so this round-trips correctly.
        const addBody: AddContactBody = {
            projectId,
            phoneNumberId,
            name,
            countryCode: countryCode ?? '',
            phone: phone ?? waId,
        };

        const result = await rustFetchAsUser<AddContactResponse>(
            userId,
            '/v1/contacts/',
            { method: 'POST', body: JSON.stringify(addBody) },
        );

        return NextResponse.json({
            success: true,
            message: result.message ?? `Contact "${name}" added successfully.`,
            contactId: result.contactId,
        });
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return NextResponse.json({ error: e.message }, { status: e.status || 500 });
        }
        return NextResponse.json({ error: e?.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
