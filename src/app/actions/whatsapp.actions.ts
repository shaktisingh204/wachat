
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index';
import type { Project, Template, CallingSettings, CreateTemplateState, OutgoingMessage, Contact, Agent, PhoneNumber, MetaPhoneNumbersResponse, MetaTemplatesResponse, MetaTemplate, PaymentConfiguration } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { premadeTemplates } from '@/lib/premade-templates';
import FormData from 'form-data';

const API_VERSION = 'v23.0';

export async function getPublicProjectById(projectId: string): Promise<WithId<Project> | null> {
    try {
        if (!ObjectId.isValid(projectId)) {
            return null;
        }
        const { db } = await connectToDatabase();
        const project = await db.collection<Project>('projects').findOne({ _id: new ObjectId(projectId) });
        return project ? JSON.parse(JSON.stringify(project)) : null;
    } catch (error: any) {
        return null;
    }
}

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

export async function handleSyncTemplates(projectId: string): Promise<{ message?: string, error?: string, count?: number }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();
        
        const { wabaId, accessToken } = project;

        const allTemplates: MetaTemplate[] = [];
        let nextUrl: string | undefined = `https://graph.facebook.com/v23.0/${wabaId}/message_templates?access_token=${accessToken}&fields=name,components,language,status,category,id,quality_score&limit=100`;

        while(nextUrl) {
            const response = await fetch(nextUrl, { method: 'GET' });

            if (!response.ok) {
                let reason = 'Unknown API Error';
                try {
                    const errorData = await response.json();
                    reason = errorData?.error?.message || reason;
                } catch (e) {
                    reason = `Could not parse error response from Meta. Status: ${response.status} ${response.statusText}`;
                }
                return { error: `Failed to fetch templates from Meta: ${reason}` };
            }

            const templatesResponse: MetaTemplatesResponse = await response.json();
            
            if (templatesResponse.data && templatesResponse.data.length > 0) {
                allTemplates.push(...templatesResponse.data);
            }

            nextUrl = templatesResponse.paging?.next;
        }
        
        if (allTemplates.length === 0) {
            return { message: "No templates found in your WhatsApp Business Account to sync." }
        }

        const templatesToUpsert = allTemplates.map(t => {
            const bodyComponent = t.components.find(c => c.type === 'BODY');
            const headerComponent = t.components.find(c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format || ''));
            
            return {
                name: t.name,
                category: t.category,
                language: t.language,
                status: t.status,
                body: bodyComponent?.text || '',
                projectId: new ObjectId(projectId),
                metaId: t.id,
                components: t.components,
                qualityScore: t.quality_score?.score?.toUpperCase() || 'UNKNOWN',
                headerSampleUrl: headerComponent?.example?.header_handle?.[0] ? `https://graph.facebook.com/${headerComponent.example.header_handle[0]}` : undefined
            };
        });

        const bulkOps = templatesToUpsert.map(template => ({
            updateOne: {
                filter: { metaId: template.metaId, projectId: template.projectId },
                update: { $set: template },
                upsert: true,
            }
        }));

        const result = await db.collection('templates').bulkWrite(bulkOps);
        const syncedCount = result.upsertedCount + result.modifiedCount;
        
        revalidatePath('/dashboard/templates');
        
        return { message: `Successfully synced ${syncedCount} template(s).`, count: syncedCount };

    } catch (e: any) {
        console.error('Template sync failed:', e);
        return { error: e.message || 'An unexpected error occurred during template sync.' };
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
                { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
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
export async function handleSendMessage(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const contactId = formData.get('contactId') as string;
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const waId = formData.get('waId') as string;
    const messageText = formData.get('messageText') as string;
    const mediaFile = formData.get('mediaFile') as File;

    if (!contactId || !projectId || !waId || !phoneNumberId || (!messageText && (!mediaFile || mediaFile.size === 0))) {
        return { error: 'Required fields are missing to send message.' };
    }
    
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();
        let messagePayload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: waId,
        };
        let messageType: OutgoingMessage['type'] = 'text';

        if (mediaFile && mediaFile.size > 0) {
            const form = new FormData();
            form.append('file', Buffer.from(await mediaFile.arrayBuffer()), {
                filename: mediaFile.name,
                contentType: mediaFile.type,
            });
            form.append('messaging_product', 'whatsapp');

            const uploadResponse = await axios.post(
                `https://graph.facebook.com/v23.0/${phoneNumberId}/media`,
                form,
                { headers: { ...form.getHeaders(), 'Authorization': `Bearer ${project.accessToken}` } }
            );
            
            const mediaId = uploadResponse.data.id;
            if (!mediaId) {
                return { error: 'Failed to upload media to Meta. No ID returned.' };
            }

            const detectedMediaType = mediaFile.type.split('/')[0];

            if (detectedMediaType === 'image') {
                messageType = 'image';
                messagePayload.type = 'image';
                messagePayload.image = { id: mediaId };
                if (messageText) messagePayload.image.caption = messageText;
            } else if (detectedMediaType === 'video') {
                messageType = 'video';
                messagePayload.type = 'video';
                messagePayload.video = { id: mediaId };
                if (messageText) messagePayload.video.caption = messageText;
            } else {
                messageType = 'document';
                messagePayload.type = 'document';
                messagePayload.document = { id: mediaId, filename: mediaFile.name };
                 if (messageText) messagePayload.document.caption = messageText;
            }
        } else {
            messageType = 'text';
            messagePayload.type = 'text';
            messagePayload.text = { body: messageText, preview_url: true };
        }
        
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');
        
        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: new ObjectId(contactId), projectId: new ObjectId(projectId), wamid, messageTimestamp: now, type: messageType,
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });

        const lastMessage = messageType === 'text' ? messageText : `[${messageType}]`;
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: { lastMessage: lastMessage.substring(0, 50), lastMessageTimestamp: now, status: 'open' } });
        
        revalidatePath('/dashboard/chat');

        return { message: 'Message sent successfully.' };

    } catch (e: any) {
        console.error('Failed to send message:', getErrorMessage(e));
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}

export async function getPaymentConfigurations(projectId: string): Promise<{ configurations: PaymentConfiguration[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { configurations: [], error: 'Project not found or is missing WABA ID or Access Token.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.wabaId}/payment_configurations`, {
            params: {
                access_token: project.accessToken,
            }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        return { configurations: response.data.data || [] };
    } catch (e: any) {
        return { configurations: [], error: getErrorMessage(e) };
    }
}

export async function handleSendTemplateMessage(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const contactId = formData.get('contactId') as string;
    const templateId = formData.get('templateId') as string;
    const mediaSource = formData.get('mediaSource') as 'url' | 'file';
    const headerMediaUrl = formData.get('headerMediaUrl') as string | null;
    const headerMediaFile = formData.get('headerMediaFile') as File;

    if (!ObjectId.isValid(contactId) || !ObjectId.isValid(templateId)) {
        return { error: 'Invalid ID provided.' };
    }

    const { db } = await connectToDatabase();
    
    const [contact, template] = await Promise.all([
        db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId) }),
        db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId) }),
    ]);
    
    if (!contact) return { error: 'Contact not found.' };
    const hasAccess = await getProjectById(contact.projectId.toString());
    if (!hasAccess) return { error: 'Access Denied.' };
    if (!template) return { error: 'Template not found.' };
    if (template.status !== 'APPROVED') return { error: 'Cannot send a template that is not approved.' };
    
    const phoneNumberId = contact.phoneNumberId;
    const waId = contact.waId;
    const { accessToken, appId } = hasAccess;
    if (!appId) return { error: 'Project App ID is not configured.' };

    try {
        const getVars = (text: string): number[] => {
            if (!text) return [];
            const variableMatches = text.match(/{{\s*(\d+)\s*}}/g);
            return variableMatches 
                ? [...new Set(variableMatches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] 
                : [];
        };

        const payloadComponents: any[] = [];
        
        const headerComponent = template.components?.find(c => c.type === 'HEADER');
        if (headerComponent) {
            let mediaId: string | null = null;

            if (mediaSource === 'file' && headerMediaFile && headerMediaFile.size > 0) {
                 const form = new FormData();
                form.append('file', Buffer.from(await headerMediaFile.arrayBuffer()), { filename: headerMediaFile.name, contentType: headerMediaFile.type });
                form.append('messaging_product', 'whatsapp');
                const uploadResponse = await axios.post(`https://graph.facebook.com/v23.0/${phoneNumberId}/media`, form, { headers: { ...form.getHeaders(), 'Authorization': `Bearer ${accessToken}` } });
                mediaId = uploadResponse.data.id;
            }

            const format = headerComponent.format?.toUpperCase();
            let parameter;
            if (mediaId) {
                if (format === 'IMAGE') parameter = { type: 'image', image: { id: mediaId } };
                else if (format === 'VIDEO') parameter = { type: 'video', video: { id: mediaId } };
                else if (format === 'DOCUMENT') parameter = { type: 'document', document: { id: mediaId } };
            } else if (headerMediaUrl) {
                if (format === 'IMAGE') parameter = { type: 'image', image: { link: headerMediaUrl } };
                else if (format === 'VIDEO') parameter = { type: 'video', video: { link: headerMediaUrl } };
                else if (format === 'DOCUMENT') parameter = { type: 'document', document: { link: headerMediaUrl } };
            }
            
            if (parameter) {
                payloadComponents.push({ type: 'header', parameters: [parameter] });
            }
        }
        
        const bodyComponent = template.components?.find(c => c.type === 'BODY');
        const bodyText = bodyComponent?.text || template.body;
        if (bodyText) {
            const bodyVars = getVars(bodyText);
            if (bodyVars.length > 0) {
                const parameters = bodyVars.sort((a,b) => a-b).map(varNum => {
                    const varValue = formData.get(`variable_${varNum}`) as string || '';
                    return { type: 'text', text: varValue };
                });
                payloadComponents.push({ type: 'body', parameters });
            }
        }

        const payload: any = {
            messaging_product: "whatsapp",
            to: waId,
            type: "template",
            template: {
                name: template.name,
                language: { code: template.language }
            }
        };

        if(payloadComponents.length > 0) {
            payload.template.components = payloadComponents;
        }

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: hasAccess._id, wamid, messageTimestamp: now, type: 'template',
            content: payload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        
        const lastMessage = `[Template]: ${template.name}`;
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: lastMessage.substring(0, 50), lastMessageTimestamp: now, status: 'open' } });

        revalidatePath('/dashboard/chat');
        return { message: `Template "${template.name}" sent successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) || 'An unexpected error occurred while sending the template.' };
    }
}
