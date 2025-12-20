
'use server';

import axios from 'axios';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { User, Project, BusinessCapabilities } from '@/lib/definitions';
import { handleSubscribeProjectWebhook, handleSyncPhoneNumbers } from '@/app/actions/whatsapp.actions';
import { redirect } from 'next/navigation';

const API_VERSION = 'v23.0';
const LOG_PREFIX = '[ONBOARDING]';

export async function finalizeOnboarding(
  authCode: string,
  state: string,
) {
    console.log(`${LOG_PREFIX} Step 1: Finalizing onboarding with state ${state}.`);
    
    // State is expected to be in format "whatsapp-userId" or "facebook-userId"
    const [flowType, userId] = state.split('-');
    if (!userId || !ObjectId.isValid(userId)) {
        console.error(`${LOG_PREFIX} Invalid state received. Expected format '[type]-[userId]'. Got: ${state}`);
        return redirect('/dashboard/setup?error=invalid_state');
    }
    
    const { db } = await connectToDatabase();

    try {
        // Step 2: Exchange the short-lived auth code for a long-lived system user access token.
        console.log(`${LOG_PREFIX} Step 2: Exchanging auth code for access token for user ${userId}.`);
        const params = new URLSearchParams({
            client_id: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!,
            client_secret: process.env.META_ONBOARDING_APP_SECRET!,
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/facebook/callback`,
            code: authCode,
        });

        const tokenResponse = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/oauth/access_token`,
            params,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenResponse.data?.access_token;
        if (!accessToken) {
            throw new Error('Meta did not return an access token during token exchange.');
        }
        console.log(`${LOG_PREFIX} Step 3: Access token received successfully.`);

        // Step 4: Get associated WhatsApp Business Accounts (WABAs) for this system user token.
        const wabaResponse = await axios.get(`https://graph.facebook.com/${API_VERSION}/me/whatsapp_business_accounts`, {
            params: {
                fields: 'id,name,business',
                access_token: accessToken
            }
        });

        const wabas = wabaResponse.data?.data;
        if (!wabas || wabas.length === 0) {
            throw new Error("No WhatsApp Business Accounts found for the connected Meta account.");
        }

        // For simplicity, we'll use the first WABA returned.
        const waba = wabas[0];
        const wabaId = waba.id;
        const wabaName = waba.name || `WABA ${wabaId}`;
        const businessId = waba.business?.id;
        console.log(`${LOG_PREFIX} Step 4: Found WABA. Name: ${wabaName}, ID: ${wabaId}, Business ID: ${businessId}`);
        
        let businessCaps: BusinessCapabilities | undefined;
        if (businessId) {
             const { data: capsData } = await axios.get(
                `https://graph.facebook.com/${API_VERSION}/${businessId}`,
                { params: { fields: 'business_capabilities', access_token: accessToken } }
            );
            businessCaps = capsData?.business_capabilities;
            console.log(`${LOG_PREFIX} Step 4.1: Fetched business capabilities:`, businessCaps);
        }

        // Step 5: Upsert the project into the database.
        console.log(`${LOG_PREFIX} Step 5: Upserting project into database.`);
        const defaultPlan = await db.collection('plans').findOne({ isDefault: true });

        const project: Omit<Project, '_id'> = {
            userId: new ObjectId(userId),
            name: wabaName,
            wabaId: wabaId,
            businessId: businessId,
            accessToken: accessToken,
            appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!,
            messagesPerSecond: 80,
            phoneNumbers: [],
            createdAt: new Date(),
            planId: defaultPlan?._id,
            credits: defaultPlan?.signupCredits || 0,
            businessCapabilities: businessCaps,
            hasCatalogManagement: true,
        };
        
        const updateResult = await db.collection<Project>('projects').updateOne(
            { userId: project.userId, wabaId: project.wabaId },
            { $set: project },
            { upsert: true }
        );

        const findResult = await db.collection<Project>('projects').findOne({ userId: project.userId, wabaId: project.wabaId });
        const projectId = findResult?._id;
        
        if (projectId) {
            console.log(`${LOG_PREFIX} Step 6: Project upserted. Project ID: ${projectId}. Now syncing phone numbers and subscribing to webhooks.`);
            await handleSyncPhoneNumbers(projectId.toString());
            await handleSubscribeProjectWebhook(project.wabaId!, project.appId!, project.accessToken);
        }

        console.log(`${LOG_PREFIX} Step 7: Finalization complete. Redirecting to dashboard.`);
        
    } catch (e: any) {
        const errorMsg = getErrorMessage(e);
        console.error(`${LOG_PREFIX} FATAL: Failed to finalize signup. Error:`, errorMsg, e);
        return redirect(`/dashboard/setup?error=${encodeURIComponent(errorMsg)}`);
    }

    redirect('/dashboard');
}
