
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { handleSendMessage } from '@/app/actions/whatsapp.actions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { connectToDatabase } from '@/lib/mongodb';
import type { Contact } from '@/lib/definitions';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized: Missing API key.' }, { status: 401 });
    }
    const apiKey = authHeader.split(' ')[1];

    const { success, user } = await authenticateApiKey(apiKey);
    if (!success || !user) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    // Rate limiting
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${user._id.toString()}`, 60, 60 * 1000); // 60 reqs/min
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { contactId, messageText, waId, phoneNumberId, projectId } = body;

        if (!messageText) {
            return NextResponse.json({ error: 'messageText is required.' }, { status: 400 });
        }
        
        let finalContactId, finalProjectId, finalPhoneNumberId, finalWaId;

        if (contactId) {
            const { db } = await connectToDatabase();
            const contact = await db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId), userId: user._id });
            if (!contact) {
                 return NextResponse.json({ error: 'Contact not found or you do not have permission.' }, { status: 404 });
            }
            finalContactId = contact._id.toString();
            finalProjectId = contact.projectId.toString();
            finalPhoneNumberId = contact.phoneNumberId;
            finalWaId = contact.waId;
        } else {
             if (!waId || !phoneNumberId || !projectId) {
                return NextResponse.json({ error: 'waId, phoneNumberId, and projectId are required if contactId is not provided.' }, { status: 400 });
            }
            finalWaId = waId;
            finalPhoneNumberId = phoneNumberId;
            finalProjectId = projectId;
            finalContactId = 'temp_api_contact'; // A placeholder
        }

        const formData = new FormData();
        formData.append('contactId', finalContactId);
        formData.append('projectId', finalProjectId);
        formData.append('phoneNumberId', finalPhoneNumberId);
        formData.append('waId', finalWaId);
        formData.append('messageText', messageText);

        const result = await handleSendMessage(null, formData);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: result.message });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
