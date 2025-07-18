
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index';
import type { Project, Template, CallingSettings, CreateTemplateState, OutgoingMessage, Contact, Agent, PhoneNumber, MetaPhoneNumbersResponse } from '@/lib/definitions';
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

export async function handleUpdatePhoneNumberProfile(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    
    if (!projectId || !phoneNumberId) {
        return { error: 'Project and Phone Number IDs are required.' };
    }

    const project = await getProjectById(projectId);
    if (!project) return { error: "Access denied." };

    const { accessToken, appId } = project;
    if (!appId) {
        return { error: 'App ID is not configured for this project.' };
    }
    
    try {
        const profilePictureFile = formData.get('profilePicture') as File;
        if (profilePictureFile && profilePictureFile.size > 0) {
            const sessionFormData = new FormData();
            sessionFormData.append('file_length', profilePictureFile.size.toString());
            sessionFormData.append('file_type', profilePictureFile.type);
            sessionFormData.append('access_token', accessToken);

            const sessionResponse = await axios.post(`https://graph.facebook.com/v23.0/${appId}/uploads`, sessionFormData);
            const uploadSessionId = sessionResponse.data.id;
            
            const fileData = await profilePictureFile.arrayBuffer();
            const uploadResponse = await axios.post(`https://graph.facebook.com/v23.0/${uploadSessionId}`, Buffer.from(fileData), {
                headers: { 'Authorization': `OAuth ${accessToken}`, 'Content-Type': profilePictureFile.type },
                maxContentLength: Infinity, maxBodyLength: Infinity,
            });
            const handle = uploadResponse.data.h;

            await axios.post(
                `https://graph.facebook.com/v23.0/${phoneNumberId}/whatsapp_business_profile`,
                { messaging_product: "whatsapp", profile_picture_handle: handle },
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
        }

        const profilePayload: any = { messaging_product: 'whatsapp' };
        const fields: (keyof NonNullable<PhoneNumber['profile']>)[] = ['about', 'address', 'description', 'email', 'vertical'];
        let hasTextFields = false;

        fields.forEach(field => {
            const value = formData.get(field) as string | null;
            if (value && value.trim() !== '') {
                profilePayload[field] = value.trim();
                hasTextFields = true;
            }
        });
        
        const websites = (formData.getAll('websites') as string[]).map(w => w.trim()).filter(Boolean);
        if (websites.length > 0) {
            profilePayload.websites = websites;
            hasTextFields = true;
        }

        if (hasTextFields) {
            await axios.post(
                `https://graph.facebook.com/v23.0/${phoneNumberId}/whatsapp_business_profile`,
                profilePayload,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
        }
        
        await handleSyncPhoneNumbers(projectId); 
        revalidatePath('/dashboard/numbers');
        return { message: 'Phone number profile updated successfully!' };

    } catch (e: any) {
        console.error("Failed to update phone number profile:", e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}

export async function handleSyncPhoneNumbers(projectId: string): Promise<{ message?: string, error?: string, count?: number }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();

        const { wabaId, accessToken } = project;
        const fields = 'verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput,whatsapp_business_profile{about,address,description,email,profile_picture_url,websites,vertical}';
        
        const allPhoneNumbers: MetaPhoneNumber[] = [];
        let nextUrl: string | undefined = `https://graph.facebook.com/v23.0/${wabaId}/phone_numbers?access_token=${accessToken}&fields=${fields}&limit=100`;

        while (nextUrl) {
            const response = await fetch(nextUrl, { method: 'GET' });
            
            const responseText = await response.text();
            const responseData: MetaPhoneNumbersResponse = responseText ? JSON.parse(responseText) : {};
            
            if (!response.ok) {
                const errorMessage = (responseData as any)?.error?.message || 'Unknown error syncing phone numbers.';
                return { error: `API Error: ${errorMessage}. Status: ${response.status} ${response.statusText}` };
            }

            if (responseData.data && responseData.data.length > 0) {
                allPhoneNumbers.push(...responseData.data);
            }
            
            nextUrl = responseData.paging?.next;
        }

        if (allPhoneNumbers.length === 0) {
            await db.collection('projects').updateOne(
                { _id: new ObjectId(projectId) },
                { $set: { phoneNumbers: [] } }
            );
            return { message: "No phone numbers found in your WhatsApp Business Account to sync." };
        }

        const phoneNumbers: PhoneNumber[] = allPhoneNumbers.map((num: MetaPhoneNumber) => ({
            id: num.id,
            display_phone_number: num.display_phone_number,
            verified_name: num.verified_name,
            code_verification_status: num.code_verification_status,
            quality_rating: num.quality_rating,
            platform_type: num.platform_type,
            throughput: num.throughput,
            profile: num.whatsapp_business_profile,
        }));
        
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { phoneNumbers: phoneNumbers } }
        );
        
        revalidatePath('/dashboard/numbers');

        return { message: `Successfully synced ${phoneNumbers.length} phone number(s).`, count: phoneNumbers.length };

    } catch (e: any) {
        console.error('Phone number sync failed:', e);
        return { error: e.message || 'An unexpected error occurred during phone number sync.' };
    }
}
