

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-platform/auth';
import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';
import { RustApiError } from '@/lib/rust-client';
import type {
    SendMessageBody,
    SendMessageResult,
    SendAck,
    ResolveContactResult,
} from '@/lib/rust-client/whatsapp-send';
import { checkRateLimit } from '@/lib/rate-limiter';


export async function POST(request: NextRequest) {
    const ctx = await verifyApiKey(request);
    if (!ctx) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const userId = ctx.tenantId;

    // Rate limiting
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${userId}`, 60, 60 * 1000); // 60 reqs/min
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { contactId, messageText, waId, phoneNumberId, projectId } = body;

        if (!messageText) {
            return NextResponse.json({ error: 'messageText is required.' }, { status: 400 });
        }

        let finalContactId: string | undefined = contactId;
        let finalProjectId: string | undefined = projectId;
        let finalPhoneNumberId: string | undefined = phoneNumberId;
        let finalWaId: string | undefined = waId;

        if (!finalContactId) {
            if (!waId || !phoneNumberId || !projectId) {
                return NextResponse.json(
                    { error: 'waId, phoneNumberId, and projectId are required if contactId is not provided.' },
                    { status: 400 },
                );
            }
            // Resolve / create the contact via Rust — this enforces project ownership.
            const resolved = await rustFetchAsUser<ResolveContactResult>(
                userId,
                '/v1/wachat/contacts/resolve',
                {
                    method: 'POST',
                    body: JSON.stringify({ projectId, phoneNumberId, waId }),
                },
            );
            finalContactId = resolved.id;
            finalProjectId = resolved.projectId;
            finalPhoneNumberId = resolved.phoneNumberId;
            finalWaId = resolved.waId;
        }

        if (!finalContactId || !finalProjectId || !finalPhoneNumberId || !finalWaId) {
            return NextResponse.json(
                { error: 'Could not resolve contact for message send.' },
                { status: 400 },
            );
        }

        const sendBody: SendMessageBody = {
            kind: 'text',
            projectId: finalProjectId,
            contactId: finalContactId,
            phoneNumberId: finalPhoneNumberId,
            waId: finalWaId,
            messageText,
        };

        const result = await rustFetchAsUser<SendMessageResult & SendAck>(
            userId,
            '/v1/wachat/messages/send',
            { method: 'POST', body: JSON.stringify(sendBody) },
        );

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: result.message ?? 'Message sent successfully.' });
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return NextResponse.json({ error: e.message }, { status: e.status || 500 });
        }
        return NextResponse.json({ error: e?.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
