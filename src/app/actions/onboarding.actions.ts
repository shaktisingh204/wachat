
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

const API_VERSION = 'v23.0';
const LOG_PREFIX = '[ONBOARDING]';


export async function handleWabaOnboarding(data: {
    code: string;
    wabaId: string;
    phoneNumberId: string;
    includeCatalog: boolean;
    userId: string;
}): Promise<{ success: boolean; error?: string }> {
    const { code, wabaId, phoneNumberId, includeCatalog, userId } = data;
    
    console.log(`${LOG_PREFIX} Step 1: Finalizing onboarding for user ${userId} with WABA ${wabaId}.`);
    
    if (!userId || !ObjectId.isValid(userId)) {
        const errorMsg = `Invalid user ID provided: ${userId}`;
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

        // Step 4: Get WABA name and business ID
        const { data: wabaData } = await axios.get(`https://graph.facebook.com/${API_VERSION}/${wabaId}`, {
          params: {
            fields: 'name,business',
            access_token: accessToken,
          },
        });

        const wabaName = wabaData?.name || `WABA ${wabaId}`;
        const businessId = wabaData?.business?.id;
        console.log(`${LOG_PREFIX} Step 4: Fetched WABA details. Name: ${wabaName}, Business ID: ${businessId}`);
        
        let businessCaps: BusinessCapabilities | undefined;
        if (businessId && includeCatalog) {
             try {
                 const { data: capsData } = await axios.get(
                    `https://graph.facebook.com/${API_VERSION}/${businessId}`,
                    { params: { fields: 'business_capabilities', access_token: accessToken } }
                );
                businessCaps = capsData?.business_capabilities;
                console.log(`${LOG_PREFIX} Step 4.1: Fetched business capabilities.`);
             } catch(e) {
                 console.warn(`${LOG_PREFIX} Could not fetch business capabilities. Catalog management might be limited.`, getErrorMessage(e));
             }
        }

        // Step 5: Upsert the project into the database.
        console.log(`${LOG_PREFIX} Step 5: Upserting project into database.`);
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
            console.log(`${LOG_PREFIX} Step 6: Project upserted. Project ID: ${projectId}. Now syncing phone numbers and subscribing to webhooks.`);
            await handleSyncPhoneNumbers(projectId.toString());
            await handleSubscribeProjectWebhook(projectData.wabaId!, projectData.appId!, projectData.accessToken!);
        }
        
        console.log(`${LOG_PREFIX} Step 7: Finalization complete.`);
        return { success: true };
        
    } catch (e: any) {
        const errorMsg = getErrorMessage(e);
        console.error(`${LOG_PREFIX} FATAL: Failed to finalize signup. Error:`, errorMsg, e);
        return { success: false, error: errorMsg };
    }
}
