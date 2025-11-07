

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { handleStartApiBroadcast } from '@/app/actions/broadcast.actions';

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
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${user._id.toString()}:broadcast-bulk`, 5, 60 * 1000); // 5 bulk broadcasts per minute
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { projectId, phoneNumberId, templateId, contacts, variableMappings } = body;

        if (!projectId || !phoneNumberId || !templateId || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
            return NextResponse.json({ error: 'projectId, phoneNumberId, templateId, and a non-empty contacts array are required.' }, { status: 400 });
        }

        const result = await handleStartApiBroadcast({
            projectId,
            phoneNumberId,
            templateId,
            contacts,
            variableMappings,
        });
        
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: result.message });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
