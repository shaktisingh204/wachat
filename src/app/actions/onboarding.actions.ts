
'use server';

import axios from 'axios';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { User, Project, BusinessCapabilities } from '@/lib/definitions';
import { handleSubscribeProjectWebhook, handleSyncPhoneNumbers } from '@/app/actions/whatsapp.actions';

const API_VERSION = 'v23.0';
const LOG_PREFIX = '[ONBOARDING]';

export async function saveOnboardingState(state: string, userId: string) {
    if (!userId) {
        console.error(`${LOG_PREFIX} saveOnboardingState failed: User ID is missing.`);
        return { error: "User not authenticated." };
    }
    
    const { db } = await connectToDatabase();
    const collection = db.collection('oauth_states');

    await collection.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 600 });
    
    await collection.insertOne({
        state,
        userId: new ObjectId(userId),
        createdAt: new Date(),
    });

    console.log(`${LOG_PREFIX} Saved onboarding state for user ${userId}`);
    return { success: true };
}

async function getWabaDetails(accessToken: string) {
    console.log(`${LOG_PREFIX} Step 4: Fetching WABA details via /me.`);

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/me`,
            {
                params: {
                    fields: 'whatsapp_business_accounts{id,name,business}',
                    access_token: accessToken,
                },
            }
        );

        console.log('[ONBOARDING] Step 4.1: /me response:', response.data);

        const wabas = response.data?.whatsapp_business_accounts?.data;

        if (!wabas || wabas.length === 0) {
            return { error: 'No WhatsApp Business Accounts found for this user.' };
        }

        return {
            wabas: wabas.map((w: any) => ({
                id: w.id,
                name: w.name,
                businessId: w.business?.id,
            })),
        };
    } catch (e: any) {
        console.error(
            '[ONBOARDING] getWabaDetails() failed:',
            e.response?.data || e.message
        );

        return {
            error: `Failed to retrieve WhatsApp account details: ${
                e.response?.data?.error?.message || e.message
            }`,
        };
    }
}


export async function handleWabaOnboarding(code: string, state: string) {
    console.log(`${LOG_PREFIX} Step 1: Received onboarding callback with authorization code.`);
    
    const { db } = await connectToDatabase();
    const stateDoc = await db.collection('oauth_states').findOneAndDelete({ state: state });

    if (!stateDoc) {
        console.error(`${LOG_PREFIX} Invalid or expired state received: ${state}`);
        throw new Error('Invalid or expired authentication state. Please try again.');
    }

    const userId = stateDoc.userId;

    console.log(`${LOG_PREFIX} Step 2: Starting token exchange with Meta for user ${userId}.`);

    try {
        const params = new URLSearchParams({
            client_id: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!,
            client_secret: process.env.META_ONBOARDING_APP_SECRET!,
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/facebook/callback`,
            code,
        });

        const { data } = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/oauth/access_token`,
            params,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        if (!data.access_token) {
            throw new Error('Meta did not return an access token.');
        }

        const accessToken = data.access_token;
        console.log(`${LOG_PREFIX} Step 3: Token exchange successful. Long-lived access token received.`);
        
        console.log(`${LOG_PREFIX} Step 4: Fetching WABA data with new access token.`);
        const wabaData = await getWabaDetails(accessToken);
        if (wabaData.error) {
             throw new Error(wabaData.error);
        }

        if (!wabaData.wabas || wabaData.wabas.length === 0) {
            throw new Error('No WhatsApp Business Accounts were found.');
        }
        
        const waba = wabaData.wabas[0]; // Process the first WABA found
        console.log(`${LOG_PREFIX} Step 5: Found WABA: ${waba.name} (${waba.id})`);

        await finalizeOnboarding(userId.toString(), waba, accessToken);
        
        console.log(`${LOG_PREFIX} Onboarding process completed successfully for user ${userId}.`);
        return { success: true };

    } catch (e: any) {
        const errorMsg = getErrorMessage(e);
        console.error(`${LOG_PREFIX} Onboarding process failed:`, errorMsg, e);
        throw new Error(errorMsg);
    }
}


export async function finalizeOnboarding(
  userId: string,
  waba: { id: string, name: string, businessId?: string },
  accessToken: string
) {
  console.log(`${LOG_PREFIX} Step 6: Finalizing onboarding for user ${userId} and WABA ${waba.id}.`);
  const { db } = await connectToDatabase();

  try {
    let businessCaps: BusinessCapabilities | undefined;

    if (waba.businessId) {
        console.log(`${LOG_PREFIX} Step 6.1: Fetching business capabilities for business ID ${waba.businessId}.`);
        const { data: capsData } = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${waba.businessId}`,
            {
                params: {
                    fields: 'business_capabilities',
                    access_token: accessToken
                }
            }
        );
        businessCaps = capsData?.business_capabilities;
        console.log(`${LOG_PREFIX} Step 6.2: Fetched business capabilities:`, businessCaps);
    }

    const defaultPlan = await db.collection('plans').findOne({ isDefault: true });
    if (defaultPlan) {
        console.log(`${LOG_PREFIX} Step 6.3: Found default plan "${defaultPlan.name}".`);
    }

    const project: Omit<Project, '_id'> = {
      userId: new ObjectId(userId),
      name: waba.name || `WABA ${waba.id}`,
      wabaId: waba.id,
      businessId: waba.businessId,
      accessToken,
      messagesPerSecond: 80,
      phoneNumbers: [],
      createdAt: new Date(),
      planId: defaultPlan?._id,
      credits: defaultPlan?.signupCredits || 0,
      businessCapabilities: businessCaps,
    };
    
    console.log(`${LOG_PREFIX} Step 6.4: Upserting project into database.`);
    const updateResult = await db.collection<Project>('projects').updateOne(
      { userId: project.userId, wabaId: project.wabaId },
      { $set: project },
      { upsert: true }
    );
    
    const findResult = await db.collection<Project>('projects').findOne({ userId: project.userId, wabaId: project.wabaId });
    const projectId = findResult?._id;
    
    if (projectId) {
        console.log(`${LOG_PREFIX} Step 6.5: Project upserted. Project ID: ${projectId}. Now syncing phone numbers and subscribing to webhooks.`);
        await handleSyncPhoneNumbers(projectId.toString());
        await handleSubscribeProjectWebhook(project.wabaId!, project.appId!, project.accessToken);
    }

    console.log(`${LOG_PREFIX} Step 7: Finalization complete.`);
    return { success: true };
  } catch (e: any) {
    const errorMsg = getErrorMessage(e);
    console.error(`${LOG_PREFIX} FATAL: Failed to finalize signup. Error:`, errorMsg, e);
    throw new Error(`Failed to finalize onboarding: ${errorMsg}`);
  }
}
