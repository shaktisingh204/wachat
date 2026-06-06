'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { getProjectById } from './project.actions';
import type { Project, Contact, PhoneNumber, PaymentConfiguration, FacebookPaymentRequest, Transaction, AnyMessage } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import { getSession } from './user.actions';

async function _wachatActorId(): Promise<string | null> {
    try {
        const session = await getSession();
        const u = (session as { user?: { _id?: unknown; id?: unknown } } | null)?.user;
        const raw = u?._id ?? u?.id;
        if (!raw) return null;
        return typeof raw === 'string' ? raw : String(raw);
    } catch {
        return null;
    }
}

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
export async function _createProjectFromWaba(data: {
    wabaId: string;
    appId: string;
    accessToken: string;
    includeCatalog?: boolean;
    userId: string;
}): Promise<{ message?: string; error?: string }> {
    // `userId` is no longer used directly here — the Rust handler resolves
    // the calling user from the auth token issued by `rustFetch` and
    // upserts on `(wabaId, userId)` server-side. Keeping the field in the
    // public signature so existing call sites
    // (`facebook.actions._createProjectFromWaba(...)`) keep compiling.
    const { wabaId, appId, accessToken, includeCatalog, userId } = data;
    void userId;

    if (!wabaId || !appId || !accessToken) {
        return { error: 'WABA ID, App ID, and Access Token are required.' };
    }

    try {
        let businessId: string | undefined = undefined;
        const { rustClient: _rustEarly, RustApiError: _RustErrEarly } = await import('@/lib/rust-client');
        if (includeCatalog) {
            try {
                const businessesResponse = await _rustEarly.wachatConfig.getMeBusinesses(accessToken);
                const businesses = businessesResponse.data;
                if (businesses && businesses.length > 0) {
                    businessId = businesses[0].id;
                } else {
                    console.warn("Could not find a Meta Business Account associated with this token to enable Catalog features.");
                }
            } catch (e) {
                console.warn("Could not retrieve business ID for catalog features:", getErrorMessage(e));
            }
        }

        let projectData: { name: string };
        try {
            projectData = await _rustEarly.wachatConfig.getWabaDetails(wabaId, accessToken);
        } catch (e: any) {
            if (e instanceof _RustErrEarly) {
                return { error: `Meta API Error (fetching project name): ${e.message}` };
            }
            return { error: `Meta API Error (fetching project name): ${getErrorMessage(e)}` };
        }

        // Upsert the project through the Rust BFF — `manualSetup` is keyed
        // by `(wabaId, userId)` and applies default-plan / `messagesPerSecond`
        // / `hasCatalogManagement` defaults on insert, so the legacy
        // "exists? insertOne : skip" logic collapses into a single hop.
        const rustClient = _rustEarly;
        const created = await rustClient.wachatConfig.manualSetup({
            name: projectData.name,
            wabaId,
            accessToken,
            appId,
            businessId,
            includeCatalog,
        });
        const projectId = created._id;

        // Sync phone numbers and register them immediately. The Rust
        // `manualSetup` returns the *current* project — for a brand-new
        // upsert it has zero phone numbers, so we sync to populate them
        // from Meta, then re-fetch to learn the real ids.
        try {
            console.log(`[WABA Setup] Syncing phone numbers for project ${projectId}`);
            await handleSyncPhoneNumbers(projectId);

            const synced = await rustClient.wachatConfig.getPublicProject(projectId);
            const phoneNumbers = synced?.phoneNumbers ?? [];
            if (phoneNumbers.length > 0) {
                console.log(`[WABA Setup] Registering ${phoneNumbers.length} phone number(s)`);
                for (const phone of phoneNumbers) {
                    try {
                        await rustClient.wachatConfig.registerPhone(projectId, phone.id, { pin: '123456' });
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
        const actor = await _wachatActorId();
        if (actor) {
            void recordFlowAction('wachat.number.connected', {
                userId: actor,
                target: (r as { _id?: string; id?: string }).id ?? (r as { _id?: string })._id,
                metadata: {
                    name: r.name,
                    wabaId: formData.get('wabaId') as string,
                    phoneNumberId: formData.get('phoneNumberId') as string,
                },
            });
        }
        return { message: `Project "${r.name}" connected successfully!` };
    } catch (e: any) {
        return { error: e?.message ?? 'Setup failed' };
    }
}

// _createProjectFromWaba is exported directly via its declaration below (line 34)

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
        // The Rust route is `GET /projects/:id/webhook-subscription?waba_id=...`
        // The TS legacy signature only takes (wabaId, accessToken), so we
        // resolve the projectId via the Rust `by-waba` lookup. The Rust
        // handler reads `accessToken` from the project doc itself, so we
        // never forward an unsigned token over the wire.
        void accessToken;
        const { rustClient } = await import('@/lib/rust-client');
        const { projectId } = await rustClient.wachatConfig.getProjectByWaba(wabaId);
        const r = await rustClient.wachatConfig.getWebhookSubscription(projectId, wabaId);
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
        // Rust `subscribeWebhook` is keyed by projectId — look it up via
        // the Rust `by-waba` lookup so this action no longer needs a
        // direct Mongo client.
        const { rustClient } = await import('@/lib/rust-client');
        const { projectId } = await rustClient.wachatConfig.getProjectByWaba(wabaId);
        const r = await rustClient.wachatConfig.subscribeWebhook(projectId, { appId, userAccessToken });
        if (r.isActive) {
            const actor = await _wachatActorId();
            if (actor) {
                void recordFlowAction('wachat.webhook.subscribed', {
                    userId: actor,
                    target: projectId,
                    metadata: { wabaId, appId },
                });
            }
        }
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatPay.listConfigurations(projectId);
            return { configurations: (result.configurations || []) as unknown as PaymentConfiguration[] };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { configurations: [], error: e.message };
            }
            throw e;
        }
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
    const body: {
        configurationName: string;
        purposeCode: string;
        merchantCategoryCode: string;
        providerName: string;
        merchantVpa?: string;
        redirectUrl?: string;
    } = {
        configurationName: (formData.get('configuration_name') as string) || '',
        purposeCode: (formData.get('purpose_code') as string) || '',
        merchantCategoryCode: (formData.get('merchant_category_code') as string) || '',
        providerName,
    };

    if (providerName === 'upi_vpa') {
        body.merchantVpa = (formData.get('merchant_vpa') as string) || undefined;
    } else {
        body.redirectUrl = (formData.get('redirect_url') as string) || undefined;
    }

    try {
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatPay.createConfiguration(projectId, body);

            if (result.oauthUrl) {
                return { message: result.message || "Configuration created! Complete the process by visiting the OAuth URL.", oauth_url: result.oauthUrl };
            }

            revalidatePath('/wachat/whatsapp-pay/settings');
            return { message: result.message || "UPI VPA configuration created successfully!" };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            await rustClient.wachatPay.updateDataEndpoint(projectId, configurationName, { dataEndpointUrl });

            revalidatePath('/wachat/whatsapp-pay/settings');
            return { message: "Data endpoint URL updated successfully!" };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatPay.regenerateOauth(projectId, configurationName, { redirectUrl });

            if (result.oauthUrl) {
                return { message: "New link generated! Complete the process by visiting the OAuth URL.", oauth_url: result.oauthUrl };
            }

            return { error: "Failed to generate OAuth link. No URL was returned." };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatPay.deleteConfiguration(projectId, configurationName);

            revalidatePath('/wachat/whatsapp-pay/settings');
            return { success: !!result?.success || true };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { success: false, error: e.message };
            }
            throw e;
        }
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatPay.getConfiguration(projectId, configurationName);
            return { configuration: (result.configuration ?? null) as unknown as PaymentConfiguration | null };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getTransactionsForProject(projectId: string): Promise<WithId<Transaction>[]> {
    if (!projectId || !ObjectId.isValid(projectId)) return [];

    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatPay.listTransactions(projectId);
        return (r.transactions ?? []) as unknown as WithId<Transaction>[];
    } catch (e) {
        console.error("Failed to fetch transactions:", e);
        return [];
    }
}

export async function refundTransaction(projectId: string, transactionId: string, idempotencyKey?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!projectId || !transactionId) return { success: false, error: 'Missing parameters.' };
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatPay.refundTransaction(projectId, transactionId, idempotencyKey);
        revalidatePath('/wachat/whatsapp-pay');
        return { success: r.success, message: r.message, error: r.error };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
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
        const actor = await _wachatActorId();
        if (actor) {
            void recordFlowAction('wachat.number.disconnected', {
                userId: actor,
                target: phoneNumberId,
                metadata: { projectId },
            });
        }
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

// --- DISPLAY NAME CHANGE (Wave E) ---

/**
 * Result shapes mirror the Rust `wachat_config::display_name` DTOs
 * (`DisplayNameOutcome` / `DisplayNameStatus`). Every Graph-sourced field is
 * optional because the backend skips `None` values when serializing.
 *
 * Kept local (not exported) so this `'use server'` module exposes only async
 * action functions as its public surface — the page declares its own matching
 * structural type for the same shape.
 */
interface DisplayNameStatusResult {
    phoneNumberId: string;
    verifiedName?: string;
    nameStatus?: string;
    newNameStatus?: string;
    requestedName?: string;
}

/**
 * Submit a display-name change to Meta and persist a local `PENDING_REVIEW`
 * marker. The Rust handler degrades a missing access token into a typed
 * BadRequest (not a crash), so callers surface the error string as info/warning
 * rather than treating it as fatal.
 */
export async function handleSetDisplayName(
    projectId: string,
    phoneNumberId: string,
    displayName: string,
): Promise<{ success: boolean; status?: string; requestedName?: string; message?: string; error?: string }> {
    const trimmed = displayName?.trim();
    if (!trimmed) {
        return { success: false, error: 'Display name must not be empty.' };
    }

    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatConfig.setDisplayName(projectId, phoneNumberId, { displayName: trimmed });
        const actor = await _wachatActorId();
        if (actor) {
            void recordFlowAction('wachat.number.display_name_requested', {
                userId: actor,
                target: phoneNumberId,
                metadata: { projectId, requestedName: r.requestedName },
            });
        }
        return {
            success: true,
            status: r.status,
            requestedName: r.requestedName,
            message: `"${r.requestedName}" submitted for review.`,
        };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Read the live display-name review status from Meta (current + pending review
 * states). Returns `{ status: null }` on a graceful backend error so the page
 * can show an info/warning panel instead of crashing.
 */
export async function getDisplayNameStatus(
    projectId: string,
    phoneNumberId: string,
): Promise<{ status: DisplayNameStatusResult | null; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatConfig.getDisplayNameStatus(projectId, phoneNumberId);
        return { status: r };
    } catch (e: any) {
        return { status: null, error: getErrorMessage(e) };
    }
}

// --- FLOWS ENCRYPTION KEYS (Wave E) ---

/**
 * Generate an RSA-2048 keypair for WhatsApp Flows data-exchange encryption.
 * The private half is stored on the project doc; only the SPKI public-key PEM
 * is returned. Status starts at `NOT_UPLOADED`.
 */
export async function handleGenerateFlowsEncryption(
    projectId: string,
    phoneNumberId: string,
): Promise<{ success: boolean; publicKey?: string; metaStatus?: string; message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatConfig.generateFlowsEncryption(projectId, phoneNumberId);
        return {
            success: true,
            publicKey: r.publicKey,
            metaStatus: r.metaStatus,
            message: 'Encryption keypair generated.',
        };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Upload the previously-generated public key to Meta
 * (`whatsapp_business_encryption`). Requires `handleGenerateFlowsEncryption`
 * to have run first; a missing key or absent creds surfaces as a typed error.
 */
export async function handleUploadFlowsEncryption(
    projectId: string,
    phoneNumberId: string,
): Promise<{ success: boolean; metaStatus?: string; message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatConfig.uploadFlowsEncryption(projectId, phoneNumberId);
        return {
            success: true,
            metaStatus: r.metaStatus,
            message: 'Public key uploaded to Meta.',
        };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatFeatures.getWabaHealth(project.wabaId);
            return { healthStatus: result.healthStatus };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatFeatures.getPhoneNumberHealth(phoneNumberId);
            return {
                healthStatus: result.healthStatus,
                messagingLimitTier: (result.messagingLimitTier ?? undefined) as string | undefined,
                nameStatus: (result.nameStatus ?? undefined) as string | undefined,
            };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatFeatures.getConversationalAutomation(phoneNumberId);
            return { automation: result.automation };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
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
        const payload: {
            enable_welcome_message?: boolean;
            prompts?: string[];
            commands?: Array<{ command_name: string; command_description: string }>;
        } = {};

        if (settings.enable_welcome_message !== undefined) {
            payload.enable_welcome_message = settings.enable_welcome_message;
        }

        if (settings.prompts) {
            payload.prompts = settings.prompts;
        }

        if (settings.commands) {
            payload.commands = settings.commands;
        }

        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatFeatures.updateConversationalAutomation(phoneNumberId, payload);
            return { message: result.message || 'Conversational automation settings updated successfully.' };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatFeatures.deleteConversationalAutomation(phoneNumberId, fields);
            return { message: result.message || 'Conversational automation settings removed.' };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatFeatures.getCommerceSettings(phoneNumberId);
            return { settings: result.settings };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
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
        const { rustClient, RustApiError } = await import('@/lib/rust-client');
        try {
            const result = await rustClient.wachatFeatures.updateCommerceSettings(phoneNumberId, settings);
            return { message: result.message || 'Commerce settings updated successfully.' };
        } catch (e: any) {
            if (e instanceof RustApiError) {
                return { error: e.message };
            }
            throw e;
        }
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
