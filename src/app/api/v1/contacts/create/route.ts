

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { handleAddNewContact } from '@/app/actions/contact.actions';
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
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${user._id.toString()}:contacts`, 120, 60 * 1000); // 120 contacts per minute
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { projectId, phoneNumberId, name, waId } = body;

        if (!projectId || !phoneNumberId || !name || !waId) {
            return NextResponse.json({ error: 'projectId, phoneNumberId, name, and waId are required.' }, { status: 400 });
        }

        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('phoneNumberId', phoneNumberId);
        formData.append('name', name);
        formData.append('waId', waId);
        
        const result = await handleAddNewContact(null, formData, authResult.user);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: result.message, contactId: result.contactId });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
