
import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-platform/auth';
import { sendTemplateSms } from '@/lib/sms/services/messaging.service';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
    const ctx = await verifyApiKey(request);
    if (!ctx) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const userId = ctx.tenantId;
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${userId}:sms-template`, 60, 60 * 1000);
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { recipient, dltTemplateId, headerId, variables } = body;

        if (!recipient || !dltTemplateId) {
            return NextResponse.json({ error: 'recipient and dltTemplateId are required.' }, { status: 400 });
        }

        let variableValues: string[] = [];
        if (Array.isArray(variables)) {
            variableValues = variables.map(String);
        } else if (typeof variables === 'object' && variables !== null) {
            variableValues = Object.values(variables).map(v => String(v));
        }

        const result = await sendTemplateSms({
            userId, // hex tenant id resolved from API key — sendTemplateSms wraps it in `new ObjectId(...)`
            recipient,
            dltTemplateId,
            headerId,
            variableValues
        });

        return NextResponse.json({ success: true, message: result.message, messageId: result.messageId });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
