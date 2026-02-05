
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { sendTemplateSms } from '@/lib/sms/services/messaging.service';
import { checkRateLimit } from '@/lib/rate-limiter';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized: Missing API key.' }, { status: 401 });
    }
    const apiKey = authHeader.split(' ')[1];

    const authResult = await authenticateApiKey(apiKey);
    if (!authResult.success || !authResult.user) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const { user } = authResult;
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${user._id.toString()}:sms-template`, 60, 60 * 1000);
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { recipient, dltTemplateId, headerId, variables } = body;

        if (!recipient || !dltTemplateId) {
            return NextResponse.json({ error: 'recipient and dltTemplateId are required.' }, { status: 400 });
        }

        // Convert variables object to array if needed, or pass as is if service handles it.
        // The service I wrote expects string[].
        // If the body has "variables": { "0": "val", "1": "val" } or similar?
        // Let's assume the API consumer sends an object or array. 
        // Logic: Extract values from variables object or assume it's an array.

        let variableValues: string[] = [];
        if (Array.isArray(variables)) {
            variableValues = variables.map(String);
        } else if (typeof variables === 'object' && variables !== null) {
            variableValues = Object.values(variables).map(v => String(v));
        }

        const result = await sendTemplateSms({
            userId: user._id, // User from API key authn
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
