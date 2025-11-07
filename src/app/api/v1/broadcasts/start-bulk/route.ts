
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { Project, Template } from '@/lib/definitions';
import { addBroadcastLog, processContactBatch } from '@/app/actions/broadcast.actions';
import { getProjectById } from '@/app/actions';


async function handleStartApiBroadcast(
  data: {
    projectId: string;
    phoneNumberId: string;
    templateId: string;
    contacts: any[]; // Using any to match incoming JSON
    variableMappings?: any[];
  }
): Promise<{ message?: string; error?: string }> {
  const { db } = await connectToDatabase();
  const { projectId, phoneNumberId, templateId, contacts, variableMappings } = data;
  let broadcastId: ObjectId | null = null;
  
  try {
    const project = await getProjectById(projectId);
    if (!project) {
      return { error: 'Project not found or you do not have access.' };
    }
    const accessToken = project.accessToken;

    if (!templateId || !ObjectId.isValid(templateId)) return { error: 'Invalid Template ID.' };
    const template = await db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId), projectId: new ObjectId(projectId) });
    if (!template) return { error: 'Selected template not found for this project.' };

    const broadcastJobData: any = {
        projectId: new ObjectId(projectId),
        broadcastType: 'template',
        templateId: new ObjectId(templateId),
        templateName: template.name,
        phoneNumberId,
        accessToken,
        status: 'DRAFT',
        createdAt: new Date(),
        contactCount: 0,
        fileName: 'API Request',
        components: template.components,
        language: template.language,
        category: template.category,
        variableMappings: variableMappings || []
    };
    
    const broadcastResult = await db.collection('broadcasts').insertOne(broadcastJobData);
    broadcastId = broadcastResult.insertedId;
    
    await addBroadcastLog(db, broadcastId, broadcastJobData.projectId, 'INFO', 'API broadcast job created in DRAFT state.');
    
    let contactCount = 0;
    if (contacts.length > 1000) { // Arbitrary batch size for API
      for (let i = 0; i < contacts.length; i += 1000) {
        const batch = contacts.slice(i, i + 1000);
        const { insertedCount } = await processContactBatch(db, broadcastId, batch, false);
        contactCount += insertedCount;
      }
    } else {
      const { insertedCount } = await processContactBatch(db, broadcastId, contacts, false);
      contactCount = insertedCount;
    }

    if (contactCount === 0) {
        await db.collection('broadcasts').deleteOne({ _id: broadcastId });
        await addBroadcastLog(db, broadcastId, broadcastJobData.projectId, 'ERROR', 'Broadcast creation failed: no valid contacts provided.', { finalContactCount: 0 });
        return { error: 'No valid contacts with phone numbers found to send to.' };
    }
    
    await db.collection('broadcasts').updateOne({ _id: broadcastId }, { $set: { contactCount, status: 'QUEUED' } });
    await addBroadcastLog(db, broadcastId, broadcastJobData.projectId, 'INFO', `Broadcast moved to QUEUED state with ${contactCount} contacts ready.`);

    return { message: `Broadcast successfully queued via API for ${contactCount} contacts. Sending will begin shortly.` };

  } catch (e: any) {
    if (broadcastId) {
      await db.collection('broadcasts').deleteOne({ _id: broadcastId });
      await db.collection('broadcast_contacts').deleteMany({ broadcastId });
      await addBroadcastLog(db, broadcastId, new ObjectId(projectId), 'ERROR', `Broadcast creation failed: ${getErrorMessage(e)}`);
    }
    return { error: getErrorMessage(e) };
  }
}

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
