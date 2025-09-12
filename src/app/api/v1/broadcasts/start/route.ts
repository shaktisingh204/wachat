
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { handleStartBroadcast } from '@/app/actions/broadcast.actions';
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
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${user._id.toString()}:broadcast`, 10, 60 * 1000); // 10 broadcasts per minute
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { projectId, phoneNumberId, templateId, tagIds, variableMappings } = body;

        if (!projectId || !phoneNumberId || !templateId || !tagIds || !Array.isArray(tagIds)) {
            return NextResponse.json({ error: 'projectId, phoneNumberId, templateId, and tagIds (array) are required.' }, { status: 400 });
        }
        
        // This is a simplified check. A more robust solution would check project ownership via getProjectById.
        // But since handleStartBroadcast already does that, we can rely on it for now.

        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('phoneNumberId', phoneNumberId);
        formData.append('templateId', templateId);
        formData.append('audienceType', 'tags');
        tagIds.forEach(id => formData.append('tagIds', id));
        formData.append('variableMappings', JSON.stringify(variableMappings || []));

        const result = await handleStartBroadcast(null, formData);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: result.message });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
