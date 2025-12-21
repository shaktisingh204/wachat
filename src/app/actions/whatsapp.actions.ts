
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/lib/actions/user.actions';
import type { Project, Template, CallingSettings, CreateTemplateState, OutgoingMessage, Contact, Agent, PhoneNumber, MetaPhoneNumbersResponse, MetaTemplatesResponse, MetaTemplate, PaymentConfiguration, BusinessCapabilities, FacebookPaymentRequest, Transaction, Plan, AnyMessage } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { premadeTemplates } from '@/lib/premade-templates';
import FormData from 'form-data';
import { getSession } from './user.actions';
import { handleSendTemplateMessage } from './send-template.actions';

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

// Internal helper function to avoid formData issues
async function _createProjectFromWaba(data: {
    wabaId: string;
    appId: string;
    accessToken: string;
    includeCatalog?: boolean;
    userId: string;
}): Promise<{ message?: string; error?: string }> {
    const { wabaId, appId, accessToken, includeCatalog, userId } = data;

    if (!wabaId || !appId || !accessToken) {
        return { error: 'WABA ID, App ID, and Access Token are required.' };
    }

    try {
        let businessId: string | undefined = undefined;
        if(includeCatalog) {
            try {
                const businessesResponse = await axios.get(`https://graph.facebook.com/v23.0/me/businesses`, {
                    params: { access_token: accessToken }
                });
                const businesses = businessesResponse.data.data;
                if (businesses && businesses.length > 0) {
                    businessId = businesses[0].id;
                } else {
                    console.warn("Could not find a Meta Business Account associated with this token to enable Catalog features.");
                }
            } catch(e) {
                console.warn("Could not retrieve business ID for catalog features:", getErrorMessage(e));
            }
        }
        
        const projectDetailsResponse = await fetch(`https://graph.facebook.com/v23.0/${wabaId}?fields=name&access_token=${accessToken}`);
        const projectData = await projectDetailsResponse.json();

        if (projectData.error) {
            return { error: `Meta API Error (fetching project name): ${projectData.error.message}` };
        }

        const { db } = await connectToDatabase();
        
        const existingProject = await db.collection('projects').findOne({ wabaId: wabaId, userId: new ObjectId(userId) });
        if(existingProject) {
            console.log(`Project with WABA ID ${wabaId} already exists for this user. Skipping creation.`);
            return { message: `Project "${projectData.name}" is already connected.` };
        }

        const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });
        
        const newProject: Omit<Project, '_id'> = {
            userId: new ObjectId(userId),
            name: projectData.name,
            wabaId: wabaId,
            appId: appId,
            businessId: businessId,
            accessToken: accessToken,
            phoneNumbers: [],
            createdAt: new Date(),
            messagesPerSecond: 80,
            planId: defaultPlan?._id,
            credits: defaultPlan?.signupCredits || 0,
            hasCatalogManagement: includeCatalog,
        };

        await db.collection('projects').insertOne(newProject as any);
        
        revalidatePath('/dashboard');
        
        return { message: `Project "${projectData.name}" created successfully!` };

    } catch (e: any) {
        console.error('Manual project creation failed:', e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}


export async function handleManualWachatSetup(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to create a project.' };
    }
    
    return await _createProjectFromWaba({
        wabaId: formData.get('wabaId') as string,
        appId: formData.get('appId') as string,
        accessToken: formData.get('accessToken') as string,
        includeCatalog: formData.get('includeCatalog') === 'on',
        userId: session.user._id.toString(),
    });
}

export { _createProjectFromWaba };

export async function handleSyncPhoneNumbers(projectId: string): Promise<{ message?: string, error?: string, count?: number }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();

        const { wabaId, accessToken } = project;
        const fields = 'verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput,whatsapp_business_profile{about,address,description,email,profile_picture_url,websites,vertical}';
        
        const allPhoneNumbers: MetaPhoneNumbersResponse['data'] = [];
        let nextUrl: string | undefined = `https://graph.facebook.com/${API_VERSION}/${wabaId}/phone_numbers?access_token=${accessToken}&fields=${fields}&limit=100`;

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

        const phoneNumbers: PhoneNumber[] = allPhoneNumbers.map((num) => ({
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

            const sessionResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${appId}/uploads`, sessionFormData);
            const uploadSessionId = sessionResponse.data.id;
            
            const fileData = await profilePictureFile.arrayBuffer();
            const uploadResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${uploadSessionId}`, Buffer.from(fileData), {
                headers: { 'Authorization': `OAuth ${accessToken}`, 'Content-Type': profilePictureFile.type },
                maxContentLength: Infinity, maxBodyLength: Infinity,
            });
            const handle = uploadResponse.data.h;

            await axios.post(
                `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/whatsapp_business_profile`,
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
                `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/whatsapp_business_profile`,
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

export async function handleSubscribeAllProjects(): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    
    const { projects } = await getProjects();
    const results = await Promise.all(
        projects.map(p => handleSubscribeProjectWebhook(p.wabaId!, p.appId!, p.accessToken))
    );
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;
    
    return {
        message: `Subscription attempted for ${results.length} projects. Success: ${successCount}, Failed: ${errorCount}. Check server logs for details.`
    };
}


export async function handleSubscribeProjectWebhook(wabaId: string, appId: string, userAccessToken: string): Promise<{ success: boolean; error?: string }> {
    const appSecret = process.env.META_ONBOARDING_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
        return { success: false, error: "App Secret not configured on the server." };
    }
    
    try {
        // Subscribe the specific WABA to the app. This requires a User/System User Access Token.
        await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${wabaId}/subscribed_apps`,
            { access_token: userAccessToken }
        );
        
        return { success: true };

    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error(`Failed to subscribe project ${wabaId}:`, errorMessage);
        return { success: false, error: errorMessage };
    }
}

// --- MESSAGE ACTIONS ---

export async function handleSendMessage(
    prevState: any, 
    data: { [key: string]: any }, 
    projectFromAction?: WithId<Project>
): Promise<{ message?: string; error?: string }> {
    const { contactId, projectId, phoneNumberId, waId, messageText, mediaFile } = data;

    if (!contactId || !projectId || !waId || !phoneNumberId || (!messageText && !mediaFile)) {
        return { error: 'Required fields are missing to send message.' };
    }
    
    const project = projectFromAction || await getProjectById(projectId, null);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();
        let messagePayload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: waId,
        };
        let messageType: OutgoingMessage['type'] = 'text';

        const fileData = mediaFile as { content: string, name: string, type: string };
        if (fileData?.content) {
            const form = new FormData();
            const buffer = Buffer.from(fileData.content, 'base64');
            form.append('file', buffer, { filename: fileData.name, contentType: fileData.type });
            form.append('messaging_product', 'whatsapp');

            const uploadResponse = await axios.post(
                `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`,
                form,
                { headers: { ...form.getHeaders(), 'Authorization': `Bearer ${project.accessToken}` } }
            );
            
            const mediaId = uploadResponse.data.id;
            if (!mediaId) {
                return { error: 'Failed to upload media to Meta. No ID returned.' };
            }

            const detectedMediaType = fileData.type.split('/')[0];

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
                messagePayload.document = { id: mediaId, filename: fileData.name };
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
        } as OutgoingMessage);

        const lastMessage = messageType === 'text' ? messageText : `[${messageType}]`;
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: { lastMessage: lastMessage.substring(0, 50), lastMessageTimestamp: now, status: 'open' } });
        
        revalidatePath('/dashboard/chat');

        return { message: 'Message sent successfully.' };

    } catch (e: any) {
        console.error('Failed to send message:', getErrorMessage(e));
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}


export async function findOrCreateContact(projectId: string, phoneNumberId: string, waId: string, projectFromAction?: WithId<Project>): Promise<{ contact?: WithId<Contact>; error?: string }> {
    if (!projectId || !phoneNumberId || !waId) {
        return { error: 'Missing required information.' };
    }

    const hasAccess = projectFromAction || await getProjectById(projectId, null);
    if (!hasAccess) return { error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        const contactResult = await db.collection<Contact>('contacts').findOneAndUpdate(
            { waId, projectId: new ObjectId(projectId) },
            { 
                $set: { phoneNumberId }, 
                $setOnInsert: {
                    waId,
                    projectId: new ObjectId(projectId),
                    userId: hasAccess.userId,
                    name: `User (${waId.slice(-4)})`,
                    createdAt: new Date(),
                    status: 'new',
                    tagIds: [],
                }
            },
            { upsert: true, returnDocument: 'after' }
        );
        
        if (contactResult) {
            revalidatePath('/dashboard/chat');
            revalidatePath('/dashboard/contacts');
            return { contact: JSON.parse(JSON.stringify(contactResult)) };
        } else {
            return { error: 'Failed to find or create contact.' };
        }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function getInitialChatData(projectId: string, phoneNumberId?: string | null, contactId?: string | null, waId?: string | null) {
    if (!projectId) {
        return { project: null, contacts: [], conversation: [], templates: [], totalContacts: 0, selectedPhoneNumberId: '' };
    }
    const { db } = await connectToDatabase();

    const project = await getProjectById(projectId);
    if (!project) return { project: null, contacts: [], conversation: [], templates: [], totalContacts: 0, selectedPhoneNumberId: '' };
    
    let selectedPhoneId = phoneNumberId || project.phoneNumbers?.[0]?.id || '';
    
    const contactFilter: Filter<Contact> = { projectId: new ObjectId(projectId), phoneNumberId: selectedPhoneId };
    if (waId) {
        contactFilter.waId = waId;
    }
    
    const contacts = await db.collection('contacts').find(contactFilter).sort({ lastMessageTimestamp: -1 }).limit(30).toArray();
    const totalContacts = await db.collection('contacts').countDocuments(contactFilter);
    const templates = await db.collection('templates').find({ projectId: new ObjectId(projectId), status: 'APPROVED' }).toArray();
    
    let selectedContact: WithId<Contact> | null = null;
    let conversation: AnyMessage[] = [];

    if (contactId) {
        selectedContact = contacts.find(c => c._id.toString() === contactId) || null;
        if (!selectedContact) {
            selectedContact = await db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId), projectId: new ObjectId(projectId) });
        }
    } else if (waId) {
        selectedContact = contacts.find(c => c.waId === waId) || null;
    }

    if (selectedContact) {
        conversation = (await getConversation(selectedContact._id.toString())) || [];
    }

    return { 
        project: JSON.parse(JSON.stringify(project)),
        contacts: JSON.parse(JSON.stringify(contacts)),
        totalContacts,
        conversation: JSON.parse(JSON.stringify(conversation)),
        templates: JSON.parse(JSON.stringify(templates)),
        selectedContact: JSON.parse(JSON.stringify(selectedContact)),
        selectedPhoneNumberId: selectedPhoneId,
    };
}


export async function getConversation(contactId: string): Promise<AnyMessage[]> {
    if (!contactId || !ObjectId.isValid(contactId)) return [];

    const { db } = await connectToDatabase();
    const contactObjectId = new ObjectId(contactId);

    const [incoming, outgoing] = await Promise.all([
        db.collection('incoming_messages').find({ contactId: contactObjectId }).sort({ messageTimestamp: 1 }).toArray(),
        db.collection('outgoing_messages').find({ contactId: contactObjectId }).sort({ messageTimestamp: 1 }).toArray(),
    ]);

    const conversation: AnyMessage[] = [...incoming, ...outgoing];
    conversation.sort((a, b) => new Date(a.messageTimestamp).getTime() - new Date(b.messageTimestamp).getTime());
    
    return JSON.parse(JSON.stringify(conversation));
}

export async function markConversationAsRead(contactId: string): Promise<{ success: boolean }> {
    if (!contactId || !ObjectId.isValid(contactId)) return { success: false };
    try {
        const { db } = await connectToDatabase();
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: { unreadCount: 0 } });
        await db.collection('incoming_messages').updateMany({ contactId: new ObjectId(contactId), isRead: false }, { $set: { isRead: true } });
        revalidatePath('/dashboard/chat');
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}


// --- PAYMENT ACTIONS ---

export async function handleRequestWhatsAppPayment(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const contactId = formData.get('contactId') as string;
    const amount = formData.get('amount') as string;
    const description = formData.get('description') as string;
    const externalReference = formData.get('externalReference') as string;

    if (!contactId || !amount || !description) {
        return { error: 'Missing required fields.' };
    }

    const { db } = await connectToDatabase();
    const contact = await db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId) });
    if (!contact) {
        return { error: 'Contact not found.' };
    }

    const project = await getProjectById(contact.projectId.toString());
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token missing.' };
    }

    const phoneNumberId = contact.phoneNumberId;

    try {
        const payload = {
            amount: {
                currency: "INR",
                value: amount,
            },
            receiver: {
                wa_id: contact.waId,
            },
            description,
            ...(externalReference && { external_reference: externalReference }),
        };

        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/payment_requests`,
            payload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        const requestId = response.data.id;
        
        await db.collection('outgoing_messages').insertOne({
            direction: 'out',
            contactId: contact._id,
            projectId: project._id,
            wamid: requestId,
            messageTimestamp: new Date(),
            type: 'payment_request' as any, // This is a custom type for logging
            content: payload,
            status: 'sent',
            statusTimestamps: { sent: new Date() },
            createdAt: new Date(),
        });

        revalidatePath('/dashboard/chat');
        return { message: 'WhatsApp Pay request sent successfully.' };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPaymentRequestStatus(
    projectId: string,
    phoneNumberId: string,
    requestId: string
): Promise<{ status?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token missing.' };
    }

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/payment_requests/${requestId}`,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        return { status: response.data.status };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPaymentRequests(
    projectId: string,
    phoneNumberId: string
): Promise<{ requests?: FacebookPaymentRequest[]; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token missing.' };
    }

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/payment_requests`,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        return { requests: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPaymentConfigurations(projectId: string): Promise<{ configurations: PaymentConfiguration[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { configurations: [], error: 'Project not found or is missing WABA ID or Access Token.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/payment_configurations`, {
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
    
export async function handleCreatePaymentConfiguration(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; oauth_url?: string }> {
    const projectId = formData.get('projectId') as string;
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { error: 'Project not found or is missing WABA ID or Access Token.' };
    }

    const providerName = formData.get('provider_name') as string;
    let payload: any = {
        configuration_name: formData.get('configuration_name'),
        purpose_code: formData.get('purpose_code'),
        merchant_category_code: formData.get('merchant_category_code'),
        provider_name,
    };

    if (providerName === 'upi_vpa') {
        payload.merchant_vpa = formData.get('merchant_vpa');
    } else {
        payload.redirect_url = formData.get('redirect_url');
    }

    try {
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${project.wabaId}/payment_configurations`,
            payload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        if (response.data.oauth_url) {
            return { message: "Configuration created! Complete the process by visiting the OAuth URL.", oauth_url: response.data.oauth_url };
        }

        revalidatePath('/dashboard/whatsapp-pay/settings');
        return { message: "UPI VPA configuration created successfully!" };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleUpdateDataEndpoint(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const configurationName = formData.get('configurationName') as string;
    const dataEndpointUrl = formData.get('dataEndpointUrl') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { error: 'Project not found or is missing WABA ID or Access Token.' };
    }

    if (!configurationName || !dataEndpointUrl) {
        return { error: 'Configuration name and endpoint URL are required.' };
    }
    
    try {
        const payload = { data_endpoint_url: dataEndpointUrl };
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${project.wabaId}/payment_configuration/${configurationName}`,
            payload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        revalidatePath('/dashboard/whatsapp-pay/settings');
        return { message: "Data endpoint URL updated successfully!" };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleRegenerateOauthLink(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; oauth_url?: string }> {
    const projectId = formData.get('projectId') as string;
    const configurationName = formData.get('configuration_name') as string;
    const redirectUrl = formData.get('redirect_url') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { error: 'Project not found or is missing WABA ID or Access Token.' };
    }

    if (!configurationName || !redirectUrl) {
        return { error: 'Configuration name and redirect URL are required.' };
    }

    try {
        const payload = {
            configuration_name: configurationName,
            redirect_url: redirectUrl,
        };
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${project.wabaId}/generate_payment_configuration_oauth_link`,
            payload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        if (response.data.oauth_url) {
            return { message: "New link generated! Complete the process by visiting the OAuth URL.", oauth_url: response.data.oauth_url };
        }

        return { error: "Failed to generate OAuth link. No URL was returned." };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleDeletePaymentConfiguration(
    projectId: string, 
    configurationName: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { success: false, error: 'Project not found or is missing WABA ID or Access Token.' };
    }

    try {
        const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/payment_configuration`, {
            headers: { 'Authorization': `Bearer ${project.accessToken}`, 'Content-Type': 'application/json' },
            data: { configuration_name: configurationName }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        revalidatePath('/dashboard/whatsapp-pay/settings');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
