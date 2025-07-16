

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { Project, Template } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { premadeTemplates } from '@/lib/premade-templates';

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
        const response = await axios.get(`https://graph.facebook.com/v19.0/${wabaId}/subscribed_apps`, {
            params: { access_token: accessToken }
        });
        
        const subscriptions = response.data.data;
        if (subscriptions && subscriptions.length > 0) {
            // A more robust solution might check the app ID if multiple apps are subscribed.
            // For now, we assume if anything is subscribed, it's our app.
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
    const apiVersion = 'v19.0';

    try {
        // Attempt to subscribe to the app first
        const appSubscribeResponse = await axios.post(`https://graph.facebook.com/${apiVersion}/${appId}/subscriptions`, {
            object: 'whatsapp_business_account',
            callback_url: `${process.env.WEBHOOK_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meta`,
            fields: 'account_update,message_template_status_update,messages,phone_number_name_update,phone_number_quality_update,security,template_category_update,calls',
            verify_token: process.env.META_VERIFY_TOKEN,
            access_token: accessToken,
        });

        if (!appSubscribeResponse.data.success) {
            throw new Error("Failed to subscribe app to webhook object.");
        }

        // Then subscribe the WABA to the app's webhooks
        const wabaSubscribeResponse = await axios.post(
            `https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`,
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

export async function updatePhoneNumberCallingSettings(
    projectId: string,
    phoneNumberId: string,
    isCallingEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) {
        return { success: false, error: 'Project not found or access denied.' };
    }

    try {
        // Enable or disable the calling feature itself
        await axios.post(
            `https://graph.facebook.com/v19.0/${phoneNumberId}`,
            {
                messaging_product: 'whatsapp',
                is_calling_enabled: isCallingEnabled,
            },
            {
                headers: { Authorization: `Bearer ${project.accessToken}` },
            }
        );
        
        // After successful API calls, sync the local DB
        revalidatePath('/dashboard/numbers');

        return { success: true };
    } catch (e: any) {
        console.error('Failed to update phone number calling settings:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}
