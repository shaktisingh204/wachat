
'use server';

import axios from 'axios';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { Project, BusinessCapabilities } from '@/lib/definitions';
import { handleSubscribeProjectWebhook, handleSyncPhoneNumbers } from '@/app/actions/whatsapp.actions';
import { getSession } from './user.actions';

const API_VERSION = 'v24.0';
const LOG_PREFIX = '[ONBOARDING]';


export async function handleWabaOnboarding(data: {
    code: string;
}): Promise<{ success: boolean; error?: string }> {
    const { code } = data;
    const cookieStore = cookies();
    const stateCookie = cookieStore.get('onboarding_state')?.value;

    if (!stateCookie) {
        return { success: false, error: 'Onboarding session expired or invalid. Please try again.' };
    }

    const { userId, includeCatalog } = JSON.parse(stateCookie);
    
    console.log(`${LOG_PREFIX} Step 1: Finalizing onboarding for user ${userId}.`);
    
    if (!userId || !ObjectId.isValid(userId)) {
        const errorMsg = `Invalid user ID provided from cookie: ${userId}`;
        console.error(`${LOG_PREFIX} ${errorMsg}`);
        return { success: false, error: errorMsg };
    }
    
    const { db } = await connectToDatabase();

    try {
        // Step 2: Exchange the short-lived auth code for a long-lived system user access token.
        console.log(`${LOG_PREFIX} Step 2: Exchanging auth code for access token.`);
        const params = new URLSearchParams({
            client_id: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!,
            client_secret: process.env.META_ONBOARDING_APP_SECRET!,
            code: code,
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/facebook/callback`,
        });
        
        const tokenResponse = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/oauth/access_token`,
            params
        );
        const accessToken = tokenResponse.data?.access_token;
        if (!accessToken) {
            throw new Error('Meta did not return an access token during token exchange.');
        }
        console.log(`${LOG_PREFIX} Step 3: Access token received successfully.`);

        // Step 4: Use the System User Token to get the associated WABAs
        const wabasResponse = await axios.get(`https://graph.facebook.com/${API_VERSION}/debug_token`, {
            params: {
                input_token: accessToken,
                access_token: `${process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID}|${process.env.META_ONBOARDING_APP_SECRET}`
            }
        });

        const granularScopes = wabasResponse.data.data?.granular_scopes || [];
        const wabaId = granularScopes.find((s: any) => s.scope === 'whatsapp_business_management')?.target_ids?.[0];

        if (!wabaId) {
            throw new Error("Could not find a WhatsApp Business Account ID associated with the provided token.");
        }
        console.log(`${LOG_PREFIX} Step 4: Found WABA ID: ${wabaId}`);
        

        // Step 5: Get WABA name and business ID
        const { data: wabaData } = await axios.get(`https://graph.facebook.com/${API_VERSION}/${wabaId}`, {
          params: {
            fields: 'name,business',
            access_token: accessToken,
          },
        });

        const wabaName = wabaData?.name || `WABA ${wabaId}`;
        const businessId = wabaData?.business?.id;
        console.log(`${LOG_PREFIX} Step 5: Fetched WABA details. Name: ${wabaName}, Business ID: ${businessId}`);
        
        let businessCaps: BusinessCapabilities | undefined;
        if (businessId && includeCatalog) {
             try {
                 const { data: capsData } = await axios.get(
                    `https://graph.facebook.com/${API_VERSION}/${businessId}`,
                    { params: { fields: 'business_capabilities', access_token: accessToken } }
                );
                businessCaps = capsData?.business_capabilities;
                console.log(`${LOG_PREFIX} Step 5.1: Fetched business capabilities.`);
             } catch(e) {
                 console.warn(`${LOG_PREFIX} Could not fetch business capabilities. Catalog management might be limited.`, getErrorMessage(e));
             }
        }

        // Step 6: Upsert the project into the database.
        console.log(`${LOG_PREFIX} Step 6: Upserting project into database.`);
        const defaultPlan = await db.collection('plans').findOne({ isDefault: true });

        const projectData: Partial<Project> = {
            userId: new ObjectId(userId),
            name: wabaName,
            wabaId: wabaId,
            businessId: businessId,
            accessToken: accessToken,
            appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!,
            messagesPerSecond: 80,
            phoneNumbers: [],
            planId: defaultPlan?._id,
            credits: defaultPlan?.signupCredits || 0,
            businessCapabilities: businessCaps,
            hasCatalogManagement: includeCatalog && !!businessId,
        };
        
        const updateResult = await db.collection<Project>('projects').updateOne(
            { userId: projectData.userId, wabaId: projectData.wabaId },
            { $set: projectData, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
        );
        
        const findResult = await db.collection<Project>('projects').findOne({ userId: projectData.userId, wabaId: projectData.wabaId });
        const projectId = findResult?._id;
        
        if (projectId) {
            console.log(`${LOG_PREFIX} Step 7: Project upserted. Project ID: ${projectId}. Now syncing phone numbers and subscribing to webhooks.`);
            await handleSyncPhoneNumbers(projectId.toString());
            await handleSubscribeProjectWebhook(projectData.wabaId!, projectData.appId!, projectData.accessToken!);
        }
        
        console.log(`${LOG_PREFIX} Step 8: Finalization complete.`);
        
        return { success: true };
        
    } catch (e: any) {
        const errorMsg = getErrorMessage(e);
        console.error(`${LOG_PREFIX} FATAL: Failed to finalize signup. Error:`, errorMsg, e);
        return { success: false, error: errorMsg };
    }
}
