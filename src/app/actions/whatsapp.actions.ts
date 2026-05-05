

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById, getProjects } from './project.actions';
import type { Project, Template, CallingSettings, CreateTemplateState, Contact, Agent, PhoneNumber, MetaTemplatesResponse, MetaTemplate, PaymentConfiguration, BusinessCapabilities, FacebookPaymentRequest, Transaction, AnyMessage } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { premadeTemplates } from '@/lib/premade-templates';
import { handleSendTemplateMessage } from './send-template.actions';

const API_VERSION = 'v23.0';

export async function getPublicProjectById(projectId: string): Promise<WithId<Project> | null> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const project = await rustClient.wachatConfig.getPublicProject(projectId);
        return (project ?? null) as unknown as WithId<Project> | null;
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
        if (includeCatalog) {
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
            } catch (e) {
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
        if (existingProject) {
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

        const insertResult = await db.collection('projects').insertOne(newProject as any);

        // Sync phone numbers and register them immediately
        const projectId = insertResult.insertedId.toString();
        try {
            console.log(`[WABA Setup] Syncing phone numbers for project ${projectId}`);
            await handleSyncPhoneNumbers(projectId);

            const createdProject = await db.collection<Project>('projects').findOne({ _id: insertResult.insertedId });
            if (createdProject?.phoneNumbers && createdProject.phoneNumbers.length > 0) {
                console.log(`[WABA Setup] Registering ${createdProject.phoneNumbers.length} phone number(s)`);
                for (const phone of createdProject.phoneNumbers) {
                    try {
                        await axios.post(
                            `https://graph.facebook.com/${API_VERSION}/${phone.id}/register`,
                            { messaging_product: 'whatsapp', pin: '123456' },
                            { headers: { 'Authorization': `Bearer ${accessToken}` } }
                        );
                        console.log(`[WABA Setup] Registered ${phone.display_phone_number} (${phone.id})`);
                    } catch (regError: any) {
                        const errMsg = getErrorMessage(regError);
                        if (errMsg.includes('already registered') || errMsg.includes('already been registered')) {
                            console.log(`[WABA Setup] ${phone.display_phone_number} is already registered.`);
                        } else {
                            console.warn(`[WABA Setup] Could not register ${phone.display_phone_number}: ${errMsg}`);
                        }
                    }
                }
            }

            // Subscribe webhooks
            await handleSubscribeProjectWebhook(wabaId, appId, accessToken);
        } catch (syncError) {
            console.warn('[WABA Setup] Post-creation sync/register failed (non-fatal):', getErrorMessage(syncError));
        }

        revalidatePath('/wachat');

        return { message: `Project "${projectData.name}" created successfully!` };

    } catch (e: any) {
        console.error('Manual project creation failed:', e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}


export async function handleManualWachatSetup(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatConfig.manualSetup({
            name: (formData.get('name') as string) || 'WhatsApp Project',
            wabaId: formData.get('wabaId') as string,
            phoneNumberId: (formData.get('phoneNumberId') as string) || '',
            accessToken: formData.get('accessToken') as string,
            appId: (formData.get('appId') as string) || undefined,
            businessId: (formData.get('businessId') as string) || undefined,
        });
        revalidatePath('/wachat');
        return { message: `Project "${r.name}" connected successfully!` };
    } catch (e: any) {
        return { error: e?.message ?? 'Setup failed' };
    }
}

export { _createProjectFromWaba };

export async function handleSyncPhoneNumbers(projectId: string): Promise<{ message?: string, error?: string, count?: number }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatConfig.syncPhoneNumbers(projectId);
        revalidatePath('/wachat/numbers');
        return { message: `Synced ${r.fetched} phone numbers.`, count: r.fetched };
    } catch (e: any) {
        return { error: e?.message ?? 'Sync failed' };
    }
}

export async function handleUpdatePhoneNumberProfile(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;

    if (!projectId || !phoneNumberId) {
        return { error: 'Project and Phone Number IDs are required.' };
    }

    try {
        const profilePictureFile = formData.get('profilePicture') as File | null;
        let profilePicture: { content: string; name: string; type: string } | undefined;
        if (profilePictureFile && profilePictureFile.size > 0) {
            const buf = Buffer.from(await profilePictureFile.arrayBuffer());
            profilePicture = {
                content: buf.toString('base64'),
                name: profilePictureFile.name,
                type: profilePictureFile.type,
            };
        }

        const body: Record<string, any> = {};
        const fields: (keyof NonNullable<PhoneNumber['profile']>)[] = ['about', 'address', 'description', 'email', 'vertical'];
        fields.forEach(field => {
            const value = formData.get(field) as string | null;
            if (value !== null) {
                body[field] = value.trim();
            }
        });
        body.websites = (formData.getAll('websites') as string[]).map(w => w.trim()).filter(Boolean);
        if (profilePicture) body.profilePicture = profilePicture;

        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.wachatConfig.updatePhoneProfile(projectId, phoneNumberId, body);

        revalidatePath('/wachat/numbers');
        return { message: 'Phone number profile updated successfully!' };
    } catch (e: any) {
        return { error: e?.message ?? 'Update failed' };
    }
}

// --- WEBHOOK ACTIONS ---

export async function getWebhookSubscriptionStatus(wabaId: string, accessToken: string): Promise<{ isActive: boolean; error?: string }> {
    if (!wabaId || !accessToken) {
        return { isActive: false, error: 'WABA ID or Access Token not provided.' };
    }

    try {
        // Rust route: GET /projects/:id/webhook-subscription?waba_id=...
        // The TS legacy signature only takes waba_id + token; we don't have a
        // projectId here, so look it up by waba.
        const { connectToDatabase } = await import('@/lib/mongodb');
        const { db } = await connectToDatabase();
        const proj = await db.collection('projects').findOne({ wabaId });
        if (!proj?._id) return { isActive: false, error: 'Project not found' };
        void accessToken;
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatConfig.getWebhookSubscription(String(proj._id), wabaId);
        return { isActive: !!r.isActive };
    } catch (e: any) {
        return { isActive: false, error: e?.message ?? 'Status check failed' };
    }
}

export async function handleSubscribeAllProjects(): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatConfig.subscribeAllWebhooks();
        return {
            message: `Subscription attempted for ${r.attempted} projects. Success: ${r.succeeded}, Failed: ${r.failed.length}. Check server logs for details.`,
        };
    } catch (e: any) {
        return { error: e?.message ?? 'Subscribe-all failed' };
    }
}


export async function handleSubscribeProjectWebhook(wabaId: string, appId: string, userAccessToken: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Rust subscribeWebhook needs projectId; look it up from wabaId.
        const { connectToDatabase } = await import('@/lib/mongodb');
        const { db } = await connectToDatabase();
        const proj = await db.collection('projects').findOne({ wabaId });
        if (!proj?._id) return { success: false, error: 'Project not found' };
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatConfig.subscribeWebhook(String(proj._id), { appId, userAccessToken });
        return { success: !!r.isActive };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Subscribe failed' };
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
    // `projectFromAction` is intentionally unused — the Rust handler resolves
    // the project from `projectId` under the same auth scope as the TS server
    // action, and we never want to forward an unsigned access token.
    void projectFromAction;
    const fileData = mediaFile as { content: string; name: string; type: string } | undefined;
    const kind: 'text' | 'image' | 'video' | 'document' = fileData?.content
        ? (fileData.type.split('/')[0] === 'image'
            ? 'image'
            : fileData.type.split('/')[0] === 'video'
                ? 'video'
                : 'document')
        : 'text';
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.send({
            kind,
            projectId,
            contactId,
            phoneNumberId,
            waId,
            messageText: messageText || undefined,
            mediaFile: fileData,
        });
        revalidatePath('/wachat/chat');
        return { message: result.message || 'Message sent successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}


export async function findOrCreateContact(projectId: string, phoneNumberId: string, waId: string, projectFromAction?: WithId<Project>): Promise<{ contact?: WithId<Contact>; error?: string }> {
    if (!projectId || !phoneNumberId || !waId) {
        return { error: 'Missing required information.' };
    }
    void projectFromAction;
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.resolveContact({ projectId, phoneNumberId, waId });
        revalidatePath('/wachat/contacts');
        return { contact: (result.contact ?? result) as unknown as WithId<Contact> };
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function getInitialChatData(projectId: string, phoneNumberId?: string | null, contactId?: string | null, waId?: string | null) {
    if (!projectId) {
        return { project: null, contacts: [], conversation: [], templates: [], totalContacts: 0, selectedPhoneNumberId: '' };
    }
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.initialChatData({
            projectId,
            phoneNumberId,
            contactId,
            waId,
        });
        return result as unknown as {
            project: WithId<Project> | null;
            contacts: WithId<Contact>[];
            totalContacts: number;
            conversation: AnyMessage[];
            templates: any[];
            selectedContact?: WithId<Contact> | null;
            selectedPhoneNumberId: string;
        };
    } catch (e: any) {
        return { project: null, contacts: [], conversation: [], templates: [], totalContacts: 0, selectedPhoneNumberId: '' };
    }
}


export async function getConversation(contactId: string): Promise<AnyMessage[]> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.getConversation(contactId);
        return (result ?? []) as unknown as AnyMessage[];
    } catch (e) {
        return [];
    }
}

export async function markConversationAsRead(contactId: string): Promise<{ success: boolean }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.markConversationAsRead(contactId);
        revalidatePath('/wachat/chat');
        return { success: !!result?.success };
    } catch (e) {
        return { success: false };
    }
}

export async function markConversationAsUnread(contactId: string): Promise<{ success: boolean }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.markConversationAsUnread(contactId);
        revalidatePath('/wachat/chat');
        return { success: !!result?.success };
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

    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.sendPaymentRequest({
            contactId,
            amount,
            description,
            externalReference: externalReference || undefined,
        });
        revalidatePath('/wachat/chat');
        revalidatePath('/wachat/whatsapp-pay');
        return { message: result.message || 'WhatsApp Pay request sent successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPaymentRequestStatus(
    projectId: string,
    phoneNumberId: string,
    requestId: string
): Promise<{ status?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.getPaymentRequestStatus(requestId, {
            projectId,
            phoneNumberId,
        });
        return result as { status?: string; error?: string };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPaymentRequests(
    projectId: string,
    phoneNumberId: string
): Promise<{ requests?: FacebookPaymentRequest[]; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.listPaymentRequests({
            projectId,
            phoneNumberId,
        });
        return {
            requests: (result.requests ?? []) as unknown as FacebookPaymentRequest[],
            error: result.error,
        };
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
        provider_name: providerName,
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

        revalidatePath('/wachat/whatsapp-pay/settings');
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

        revalidatePath('/wachat/whatsapp-pay/settings');
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

        revalidatePath('/wachat/whatsapp-pay/settings');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getPaymentConfigurationByName(projectId: string, configurationName: string): Promise<{ configuration?: PaymentConfiguration | null, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { error: 'Project not found or is missing WABA ID or Access Token.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/payment_configuration`, {
            params: {
                configuration_name: configurationName,
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        return { configuration: response.data.data?.[0] || null };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getTransactionsForProject(projectId: string): Promise<WithId<Transaction>[]> {
    if (!projectId || !ObjectId.isValid(projectId)) return [];

    try {
        const { db } = await connectToDatabase();
        const transactions = await db.collection<Transaction>('transactions').find({ projectId: new ObjectId(projectId) }).sort({ createdAt: -1 }).toArray();
        return JSON.parse(JSON.stringify(transactions));
    } catch (e) {
        console.error("Failed to fetch transactions:", e);
        return [];
    }
}

export async function handleSendCatalogMessage(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const contactId = formData.get('contactId') as string;
    const projectId = formData.get('projectId') as string;
    const headerText = formData.get('headerText') as string;
    const bodyText = formData.get('bodyText') as string;
    const footerText = formData.get('footerText') as string;
    const productRetailerIds = (formData.get('productRetailerIds') as string).split(',');

    if (!contactId || !projectId || !bodyText || productRetailerIds.length === 0) {
        return { error: 'Missing required fields for catalog message.' };
    }

    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.sendCatalog({
            projectId,
            contactId,
            headerText: headerText || undefined,
            bodyText,
            footerText: footerText || undefined,
            productRetailerIds,
        });
        revalidatePath('/wachat/chat');
        return { message: result.message || 'Catalog message sent successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function registerPhoneNumber(projectId: string, phoneNumberId: string): Promise<{ success: boolean; message?: string, error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.wachatConfig.registerPhone(projectId, phoneNumberId, { pin: '123456' });
        return { success: true, message: 'Phone number registered with WhatsApp Cloud API.' };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Register failed' };
    }
}


// --- PHONE NUMBER VERIFICATION ---

export async function handleRequestVerificationCode(
    projectId: string,
    phoneNumberId: string,
    codeMethod: 'SMS' | 'VOICE'
): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.wachatConfig.requestVerificationCode(projectId, phoneNumberId, { method: codeMethod, language: 'en' });
        return { success: true, message: `Verification code sent via ${codeMethod}.` };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Request code failed' };
    }
}

export async function handleVerifyCode(
    projectId: string,
    phoneNumberId: string,
    code: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.wachatConfig.verifyCode(projectId, phoneNumberId, { code });
        return { success: true, message: 'Phone number verified successfully.' };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Verify code failed' };
    }
}

export async function deregisterPhoneNumber(
    projectId: string,
    phoneNumberId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.wachatConfig.deregisterPhone(projectId, phoneNumberId);
        return { success: true, message: 'Phone number deregistered from Cloud API.' };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Deregister failed' };
    }
}


// --- TWO-STEP VERIFICATION ---

export async function handleSetTwoStepVerificationPin(
    projectId: string,
    phoneNumberId: string,
    pin: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
        return { success: false, error: 'PIN must be a 6-digit number.' };
    }

    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.wachatConfig.setTwoStepPin(projectId, phoneNumberId, { pin });
        return { success: true, message: 'Two-step verification PIN set successfully.' };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Set 2FA PIN failed' };
    }
}


// --- QR CODE MANAGEMENT ---

export async function getQrCodes(
    projectId: string,
    phoneNumberId: string
): Promise<{ qrCodes: any[]; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatConfig.listQrCodes(projectId, phoneNumberId);
        return { qrCodes: r.qrCodes ?? [] };
    } catch (e: any) {
        return { qrCodes: [], error: e?.message ?? 'List QR codes failed' };
    }
}

export async function handleCreateQrCode(
    projectId: string,
    phoneNumberId: string,
    prefilledMessage: string
): Promise<{ qrCode?: any; error?: string }> {
    if (!prefilledMessage?.trim()) {
        return { error: 'Prefilled message is required.' };
    }

    try {
        const { rustClient } = await import('@/lib/rust-client');
        const qrCode = await rustClient.wachatConfig.createQrCode(projectId, phoneNumberId, {
            prefilledMessage: prefilledMessage.trim(),
            generateQrImage: 'SVG',
        });
        return { qrCode };
    } catch (e: any) {
        return { error: e?.message ?? 'Create QR code failed' };
    }
}

export async function handleUpdateQrCode(
    projectId: string,
    phoneNumberId: string,
    code: string,
    prefilledMessage: string
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.wachatConfig.updateQrCode(projectId, phoneNumberId, code, {
            prefilledMessage: prefilledMessage.trim(),
        });
        return { message: 'QR code updated successfully.' };
    } catch (e: any) {
        return { error: e?.message ?? 'Update QR code failed' };
    }
}

export async function handleDeleteQrCode(
    projectId: string,
    phoneNumberId: string,
    code: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.wachatConfig.deleteQrCode(projectId, phoneNumberId, code);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Delete QR code failed' };
    }
}


// --- HEALTH STATUS ---

export async function getWabaHealthStatus(
    projectId: string
): Promise<{ healthStatus?: any; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { error: 'Project not found or WABA not configured.' };
    }

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${project.wabaId}`,
            { params: { fields: 'health_status', access_token: project.accessToken } }
        );
        return { healthStatus: response.data.health_status };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPhoneNumberHealthStatus(
    projectId: string,
    phoneNumberId: string
): Promise<{ healthStatus?: any; messagingLimitTier?: string; nameStatus?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token is missing.' };
    }

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`,
            { params: { fields: 'health_status,messaging_limit_tier,name_status,quality_rating', access_token: project.accessToken } }
        );
        return {
            healthStatus: response.data.health_status,
            messagingLimitTier: response.data.messaging_limit_tier,
            nameStatus: response.data.name_status,
        };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// --- CONVERSATIONAL AUTOMATION ---

export async function getConversationalAutomation(
    projectId: string,
    phoneNumberId: string
): Promise<{ automation?: any; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token is missing.' };
    }

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/conversational_automation`,
            { params: { access_token: project.accessToken } }
        );
        return { automation: response.data.data || response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleUpdateConversationalAutomation(
    projectId: string,
    phoneNumberId: string,
    settings: {
        enable_welcome_message?: boolean;
        prompts?: string[];
        commands?: Array<{ command_name: string; command_description: string }>;
    }
): Promise<{ message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token is missing.' };
    }

    try {
        const payload: any = {};

        if (settings.enable_welcome_message !== undefined) {
            payload.enable_welcome_message = settings.enable_welcome_message;
        }

        if (settings.prompts) {
            payload.prompts = settings.prompts;
        }

        if (settings.commands) {
            payload.commands = settings.commands;
        }

        await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/conversational_automation`,
            payload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        return { message: 'Conversational automation settings updated successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleDeleteConversationalAutomation(
    projectId: string,
    phoneNumberId: string,
    fields: string[]
): Promise<{ message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token is missing.' };
    }

    try {
        await axios.delete(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/conversational_automation`,
            {
                headers: { 'Authorization': `Bearer ${project.accessToken}` },
                data: { fields },
            }
        );
        return { message: 'Conversational automation settings removed.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// --- COMMERCE SETTINGS ---

export async function getCommerceSettings(
    projectId: string,
    phoneNumberId: string
): Promise<{ settings?: any; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token is missing.' };
    }

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/whatsapp_commerce_settings`,
            { params: { access_token: project.accessToken } }
        );
        return { settings: response.data.data?.[0] || response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleUpdateCommerceSettings(
    projectId: string,
    phoneNumberId: string,
    settings: {
        is_cart_enabled?: boolean;
        is_catalog_visible?: boolean;
    }
): Promise<{ message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token is missing.' };
    }

    try {
        await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/whatsapp_commerce_settings`,
            settings,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );
        return { message: 'Commerce settings updated successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// --- INTERACTIVE MESSAGE TYPES ---

export async function handleSendCtaUrlMessage(
    projectId: string,
    contactId: string,
    phoneNumberId: string,
    waId: string,
    data: { displayText: string; url: string; headerText?: string; bodyText: string; footerText?: string }
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.sendCtaUrl({
            projectId,
            contactId,
            phoneNumberId,
            waId,
            displayText: data.displayText,
            url: data.url,
            headerText: data.headerText,
            bodyText: data.bodyText,
            footerText: data.footerText,
        });
        revalidatePath('/wachat/chat');
        return { message: result.message || 'CTA URL message sent successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleSendLocationRequestMessage(
    projectId: string,
    contactId: string,
    phoneNumberId: string,
    waId: string,
    bodyText: string
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.sendLocationRequest({
            projectId,
            contactId,
            phoneNumberId,
            waId,
            bodyText,
        });
        revalidatePath('/wachat/chat');
        return { message: result.message || 'Location request sent successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleSendAddressMessage(
    projectId: string,
    contactId: string,
    phoneNumberId: string,
    waId: string,
    data: {
        bodyText: string;
        country: string;
        values?: Record<string, string>;
        savedAddressId?: string;
    }
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.sendAddress({
            projectId,
            contactId,
            phoneNumberId,
            waId,
            bodyText: data.bodyText,
            country: data.country,
            values: data.values,
            savedAddressId: data.savedAddressId,
        });
        revalidatePath('/wachat/chat');
        return { message: result.message || 'Address message sent successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleSendOrderDetailsMessage(
    projectId: string,
    contactId: string,
    phoneNumberId: string,
    waId: string,
    data: {
        referenceId: string;
        type: 'digital-goods' | 'physical-goods';
        paymentType: string;
        paymentLink?: string;
        totalAmount: number;
        currency: string;
        order: {
            status: string;
            catalog_id?: string;
            items: Array<{
                retailer_id: string;
                name: string;
                amount: { value: number; offset?: number };
                quantity: number;
                sale_amount?: { value: number; offset?: number };
            }>;
            subtotal?: { value: number; offset?: number };
            tax?: { value: number; offset?: number; description?: string };
            shipping?: { value: number; offset?: number; description?: string };
            discount?: { value: number; offset?: number; description?: string; discount_program_name?: string };
        };
    }
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.sendOrderDetails({
            projectId,
            contactId,
            phoneNumberId,
            waId,
            referenceId: data.referenceId,
            type: data.type,
            paymentType: data.paymentType,
            paymentLink: data.paymentLink,
            totalAmount: data.totalAmount,
            currency: data.currency,
            order: data.order,
        });
        revalidatePath('/wachat/chat');
        return { message: result.message || 'Order details message sent successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleSendOrderStatusMessage(
    projectId: string,
    contactId: string,
    phoneNumberId: string,
    waId: string,
    data: {
        referenceId: string;
        status: 'payment_request' | 'accepted' | 'pending' | 'completed' | 'canceled' | 'shipped' | 'delivered';
        description?: string;
    }
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.whatsappSend.sendOrderStatus({
            projectId,
            contactId,
            phoneNumberId,
            waId,
            referenceId: data.referenceId,
            status: data.status,
            description: data.description,
        });
        revalidatePath('/wachat/chat');
        return { message: result.message || 'Order status message sent successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}
