import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-platform/auth';
import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';
import { RustApiError } from '@/lib/rust-client';
import type { SendOutcome } from '@/lib/rust-client/templates';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
    const ctx = await verifyApiKey(request);
    if (!ctx) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const userId = ctx.tenantId;
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${userId}:send-template`, 60, 60 * 1000);
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { contactId, templateId, headerMediaUrl, variables } = body;

        if (!contactId || !templateId) {
            return NextResponse.json({ error: 'contactId and templateId are required.' }, { status: 400 });
        }

        // The Rust send endpoint expects a recipient phone (not a Mongo
        // contactId), but the public TS contract historically accepted a
        // contactId. Forward `contactId` as `recipientPhone` — the Rust
        // handler accepts both shapes (legacy callers passed a hex
        // ObjectId in this slot and the resolver short-circuits when it
        // already maps to a contact). Variable values come through as
        // free-form named keys; positional callers can also send them
        // here under integer-string keys.
        const named: Record<string, string> = {};
        if (variables && typeof variables === 'object') {
            for (const [k, v] of Object.entries(variables)) {
                if (v !== null && v !== undefined) named[k] = String(v);
            }
        }
        if (headerMediaUrl) {
            named.headerMediaUrl = String(headerMediaUrl);
        }

        const result = await rustFetchAsUser<SendOutcome>(
            userId,
            `/v1/wachat/templates/${encodeURIComponent(templateId)}/send`,
            {
                method: 'POST',
                body: JSON.stringify({
                    recipientPhone: String(contactId),
                    variables: { named },
                }),
            },
        );

        return NextResponse.json({ success: true, message: result.message ?? 'Template sent successfully.' });
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return NextResponse.json({ error: e.message }, { status: e.status || 500 });
        }
        return NextResponse.json({ error: e?.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
