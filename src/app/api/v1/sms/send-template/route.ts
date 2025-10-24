
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { sendSmsTemplate } from '@/app/actions/sms.actions';
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
        const { projectId, recipient, dltTemplateId, headerId, variables } = body;

        if (!projectId || !recipient || !dltTemplateId || !headerId) {
            return NextResponse.json({ error: 'projectId, recipient, dltTemplateId, and headerId are required.' }, { status: 400 });
        }

        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('recipient', recipient);
        formData.append('dltTemplateId', dltTemplateId);
        formData.append('headerId', headerId);
        if (variables) {
            Object.entries(variables).forEach(([key, value]) => {
                formData.append(key, value as string);
            });
        }
        
        const result = await sendSmsTemplate(null, formData);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: result.message });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
