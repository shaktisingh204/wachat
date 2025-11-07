
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { handleSendMessage, findOrCreateContact } from '@/app/actions/whatsapp.actions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { connectToDatabase } from '@/lib/mongodb';
import type { Contact } from '@/lib/definitions';
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
            // User must own the project this contact belongs to.
            const contact = await db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId) });
             if (!contact) {
                 return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
            }
            const project = await db.collection('projects').findOne({ _id: contact.projectId, userId: user._id });
             if (!project) {
                 return NextResponse.json({ error: 'You do not have permission to access this contact.' }, { status: 403 });
            }

            finalContactId = contact._id.toString();
            finalProjectId = contact.projectId.toString();
            finalPhoneNumberId = contact.phoneNumberId;
            finalWaId = contact.waId;
        } else {
             if (!waId || !phoneNumberId || !projectId) {
                return NextResponse.json({ error: 'waId, phoneNumberId, and projectId are required if contactId is not provided.' }, { status: 400 });
            }
            const { db } = await connectToDatabase();
            const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId), userId: user._id });
            if (!project) {
                 return NextResponse.json({ error: 'You do not have permission to access this project.' }, { status: 403 });
            }
            const { contact, error } = await findOrCreateContact(projectId, phoneNumberId, waId);
            if (error || !contact) {
                return NextResponse.json({ error: `Could not find or create contact: ${error}` }, { status: 500 });
            }

            finalWaId = waId;
            finalPhoneNumberId = phoneNumberId;
            finalProjectId = projectId;
            finalContactId = contact._id.toString();
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
