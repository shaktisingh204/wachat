
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { handleSendTemplateMessage } from '@/app/actions/whatsapp.actions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { connectToDatabase } from '@/lib/mongodb';
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
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${user._id.toString()}`, 60, 60 * 1000);
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { contactId, templateId, headerMediaUrl, variables } = body;

        if (!contactId || !templateId) {
            return NextResponse.json({ error: 'contactId and templateId are required.' }, { status: 400 });
        }
        
        // --- Permission Check ---
        const { db } = await connectToDatabase();
        const contact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
        if (!contact) {
            return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
        }
        const project = await db.collection('projects').findOne({ _id: contact.projectId, userId: user._id });
        if (!project) {
            return NextResponse.json({ error: 'You do not have permission to access this contact or project.' }, { status: 403 });
        }

        const formData = new FormData();
        formData.append('contactId', contactId);
        formData.append('templateId', templateId);
        if (headerMediaUrl) formData.append('headerMediaUrl', headerMediaUrl);
        if (variables) {
            Object.entries(variables).forEach(([key, value]) => {
                formData.append(`variable_${key}`, value as string);
            });
        }
        
        const result = await handleSendTemplateMessage(null, formData);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: result.message });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
