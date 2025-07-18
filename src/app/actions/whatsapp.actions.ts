
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index';
import type { Project, Template, CallingSettings, CreateTemplateState, OutgoingMessage, Contact, Agent, PhoneNumber } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { premadeTemplates } from '@/lib/premade-templates';
import FormData from 'form-data';

const API_VERSION = 'v23.0';

// --- TEMPLATE ACTIONS ---
export async function getTemplates(projectId: string): Promise<WithId<Template>[]> {
    if (!ObjectId.isValid(projectId)) {
        return [];
    }
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const projection = {
            name: 1,
            category: 1,
            components: 1,
            metaId: 1,
            language: 1,
            body: 1,
            status: 1,
            headerSampleUrl: 1,
            qualityScore: 1,
            type: 1,
        };
        const templates = await db.collection('templates')
            .find({ projectId: new ObjectId(projectId) })
            .project(projection)
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(templates));
    } catch (error) {
        console.error('Failed to fetch templates:', error);
        return [];
    }
}

export async function getLibraryTemplates() {
    try {
        const { db } = await connectToDatabase();
        const customTemplates = await db.collection('library_templates').find({}).sort({ name: 1 }).toArray();
        const allTemplates = [...premadeTemplates, ...customTemplates];
        return JSON.parse(JSON.stringify(allTemplates));
    } catch (e) {
        console.error("Failed to fetch library templates:", e);
        return premadeTemplates; 
    }
}


// --- WEBHOOK ACTIONS ---

export async function getWebhookSubscriptionStatus(wabaId: string, accessToken: string): Promise<{ isActive: boolean; error?: string }> {
    if (!wabaId || !accessToken) {
        return { isActive: false, error: 'WABA ID or Access Token not provided.' };
    }
    
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${wabaId}/subscribed_apps`, {
            params: { access_token: accessToken }
        });
        
        const subscriptions = response.data.data;
        if (subscriptions && subscriptions.length > 0) {
            return { isActive: true };
        }
        
        return { isActive: false, error: 'No active subscription found for this WABA.' };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error("Webhook status check failed:", errorMessage);
        return { isActive: false, error: errorMessage };
    }
}


export async function handleSubscribeProjectWebhook(wabaId: string, appId: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Attempt to subscribe to the app first
        const appSubscribeResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${appId}/subscriptions`, {
            object: 'whatsapp_business_account',
            callback_url: `${process.env.WEBHOOK_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meta`,
            fields: 'account_update,message_template_status_update,messages,phone_number_name_update,phone_number_quality_update,security,template_category_update,calls',
            verify_token: process.env.META_VERIFY_TOKEN,
            access_token: accessToken,
        });

        if (!appSubscribeResponse.data.success) {
            throw new Error("Failed to subscribe app to webhook object.");
        }

        const wabaSubscribeResponse = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${wabaId}/subscribed_apps`,
            {
                access_token: accessToken,
            }
        );
        
        return { success: true };

    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error(`Failed to subscribe project ${wabaId}:`, errorMessage);
        return { success: false, error: errorMessage };
    }
}

// --- CALLING ACTIONS ---

export async function savePhoneNumberCallingSettings(
  projectId: string,
  phoneNumberId: string,
  voiceEnabled: boolean,
  inboundCallControl: 'DISABLED' | 'CALLBACK_REQUEST'
): Promise<{ success: boolean; error?: string }> {
  const project = await getProjectById(projectId);
  if (!project) {
    return { success: false, error: 'Project not found or access denied.' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    voice_enabled: voiceEnabled,
    inbound_call_control: inboundCallControl,
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`,
      payload,
      { headers: { Authorization: `Bearer ${project.accessToken}` } }
    );

    if (response.data.error) throw new Error(getErrorMessage({ response }));

    revalidatePath(`/dashboard/numbers`);
    return { success: true };
  } catch (e: any) {
    const errorMessage = getErrorMessage(e);
    console.error('Failed to update basic calling settings:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function getMediaHandleForTemplate(file: File | null, url: string | null, accessToken: string, appId: string): Promise<{ handle: string | null; error?: string; }> {
    if (!file && !url) return { handle: null };

    try {
        let mediaData: Buffer;
        let fileType: string;
        let fileLength: number;

        if (file && file.size > 0) {
            mediaData = Buffer.from(await file.arrayBuffer());
            fileType = file.type;
            fileLength = file.size;
        } else if (url) {
            const mediaResponse = await axios.get(url, { responseType: 'arraybuffer' });
            mediaData = Buffer.from(mediaResponse.data);
            fileType = mediaResponse.headers['content-type'] || 'application/octet-stream';
            fileLength = mediaData.length;
        } else {
            return { handle: null };
        }

        const sessionUrl = `https://graph.facebook.com/v23.0/${appId}/uploads?file_length=${fileLength}&file_type=${fileType}&access_token=${accessToken}`;
        const sessionResponse = await axios.post(sessionUrl, {});
        const uploadSessionId = sessionResponse.data.id;

        const uploadUrl = `https://graph.facebook.com/v23.0/${uploadSessionId}`;
        const uploadResponse = await axios.post(uploadUrl, mediaData, { headers: { Authorization: `OAuth ${accessToken}` } });
        return { handle: uploadResponse.data.h };
    } catch (uploadError: any) {
        const errorMessage = getErrorMessage(uploadError);
        return { handle: null, error: `Media upload failed: ${errorMessage}` };
    }
}
  
export async function getContactsForProject(
    projectId: string,
    phoneNumberId: string,
    page: number,
    limit: number,
    query?: string,
): Promise<{
    contacts: WithId<Contact>[],
    total: number,
}> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess || !phoneNumberId) {
        return { contacts: [], total: 0 };
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Contact> = { projectId: new ObjectId(projectId), phoneNumberId };
        
        if (query && query.trim() !== '') {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const queryRegex = { $regex: escapedQuery, $options: 'i' };
            filter.$or = [
                { name: queryRegex },
                { waId: queryRegex }
            ];
        }
        
        const skip = (page - 1) * limit;

        const [contacts, total] = await Promise.all([
            db.collection<Contact>('contacts').find(filter).sort({ lastMessageTimestamp: -1 }).skip(skip).limit(limit).toArray(),
            db.collection<Contact>('contacts').countDocuments(filter)
        ]);
        
        return {
            contacts: JSON.parse(JSON.stringify(contacts)),
            total
        };
    } catch (e) {
        console.error("Failed to get contacts for project:", e);
        return { contacts: [], total: 0 };
    }
}

export async function getContactsPageData(
    projectId: string, 
    phoneNumberId: string, 
    page: number, 
    limit: number,
    query?: string,
    tags?: string[],
): Promise<{
    project: WithId<Project> | null,
    contacts: WithId<Contact>[],
    total: number,
    selectedPhoneNumberId: string
}> {
    const projectData = await getProjectById(projectId);
    if (!projectData) return { project: null, contacts: [], total: 0, selectedPhoneNumberId: '' };

    let selectedPhoneId = phoneNumberId || projectData.phoneNumbers?.[0]?.id || '';
    
    if (!selectedPhoneId) return { project: projectData, contacts: [], total: 0, selectedPhoneNumberId: '' };

    const { db } = await connectToDatabase();
    const filter: Filter<Contact> = { projectId: new ObjectId(projectId), phoneNumberId: selectedPhoneId };
    
    if (query) {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const queryRegex = { $regex: escapedQuery, $options: 'i' };
        filter.$or = [
            { name: queryRegex },
            { waId: queryRegex },
        ];
    }

    if (tags && tags.length > 0) {
        filter.tagIds = { $in: tags };
    }
    
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
        db.collection('contacts').find(filter).sort({ lastMessageTimestamp: -1 }).skip(skip).limit(limit).toArray(),
        db.collection('contacts').countDocuments(filter)
    ]);
    
    return {
        project: JSON.parse(JSON.stringify(projectData)),
        contacts: JSON.parse(JSON.stringify(contacts)),
        total,
        selectedPhoneNumberId: selectedPhoneId
    };
}
