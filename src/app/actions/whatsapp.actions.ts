
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
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

export async function getWebhookSubscriptionStatus(appId: string): Promise<{ isActive: boolean; callbackUrl?: string; fields?: string[]; error?: string }> {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
        return { isActive: false, error: 'App ID or Secret not configured on the server.' };
    }
    
    try {
        // Step 1: Get a valid App Access Token
        const tokenResponse = await axios.get('https://graph.facebook.com/oauth/access_token', {
            params: {
                client_id: appId,
                client_secret: appSecret,
                grant_type: 'client_credentials'
            }
        });
        const appAccessToken = tokenResponse.data.access_token;
        if (!appAccessToken) {
            return { isActive: false, error: 'Could not retrieve App Access Token from Meta.' };
        }

        // Step 2: Use the token to check subscriptions
        const response = await axios.get(`https://graph.facebook.com/v20.0/${appId}/subscriptions`, {
            params: { access_token: appAccessToken }
        });
        
        const subscriptions = response.data.data;
        const wabaSubscription = subscriptions.find((sub: any) => sub.object === 'whatsapp_business_account');
        
        if (wabaSubscription && wabaSubscription.active) {
            return {
                isActive: true,
                callbackUrl: wabaSubscription.callback_url,
                fields: wabaSubscription.fields.map((f: any) => f.name)
            };
        }
        
        return { isActive: false, error: 'No active WhatsApp subscription found.' };
    } catch (e: any) {
        console.error("Webhook status check failed:", getErrorMessage(e));
        return { isActive: false, error: getErrorMessage(e) };
    }
}

