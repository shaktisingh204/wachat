
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

    // Create an index on `createdAt` to automatically expire documents after 10 minutes
    await collection.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 600 });
    
    await collection.insertOne({
        state,
        userId: new ObjectId(userId),
        createdAt: new Date(),
    });

    console.log(`${LOG_PREFIX} Saved onboarding state for user ${userId}`);
    return { success: true };
}

export async function handleWabaOnboardingTokenExchange(code: string, state: string) {
    console.log(`${LOG_PREFIX} Step 1: Received onboarding callback with authorization code.`);
    
    const { db } = await connectToDatabase();
    const stateDoc = await db.collection('oauth_states').findOne({ state: state });

    if (!stateDoc) {
        console.error(`${LOG_PREFIX} Invalid or expired state received: ${state}`);
        throw new Error('Invalid or expired authentication state. Please try again.');
    }
    
    // Mark state as used to prevent replay attacks
    await db.collection('oauth_states').deleteOne({ _id: stateDoc._id });
    
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
        console.log(`${LOG_PREFIX} Step 3: Token exchange successful. System user token received.`);
        
        // Store the system user token temporarily, associated with the user.
        await db.collection('meta_tokens').updateOne(
            { userId: userId },
            { $set: { systemToken: accessToken, updatedAt: new Date() } },
            { upsert: true }
        );

        console.log(`${LOG_PREFIX} Step 4: System user token saved to database for user ${userId}. Waiting for webhook...`);
        
        return { success: true };

    } catch (e: any) {
        const errorMsg = getErrorMessage(e);
        console.error(`${LOG_PREFIX} Onboarding process failed at token exchange:`, errorMsg, e);
        throw new Error(errorMsg);
    }
}


export async function finalizeOnboarding(
  userId: string,
  waba: { id: string, name: string, businessId?: string },
  accessToken: string
) {
  console.log(`${LOG_PREFIX} Step 5: Finalizing onboarding for user ${userId} and WABA ${waba.id}.`);
  const { db } = await connectToDatabase();

  try {
    let businessCaps: BusinessCapabilities | undefined;

    if (waba.businessId) {
        console.log(`${LOG_PREFIX} Step 5.1: Fetching business capabilities for business ID ${waba.businessId}.`);
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
        console.log(`${LOG_PREFIX} Step 5.2: Fetched business capabilities:`, businessCaps);
    }

    const defaultPlan = await db.collection('plans').findOne({ isDefault: true });
    if (defaultPlan) {
        console.log(`${LOG_PREFIX} Step 5.3: Found default plan "${defaultPlan.name}".`);
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
    
    console.log(`${LOG_PREFIX} Step 5.4: Upserting project into database.`);
    const updateResult = await db.collection<Project>('projects').updateOne(
      { userId: project.userId, wabaId: project.wabaId },
      { $set: project },
      { upsert: true }
    );
    
    const findResult = await db.collection<Project>('projects').findOne({ userId: project.userId, wabaId: project.wabaId });
    const projectId = findResult?._id;
    
    if (projectId) {
        console.log(`${LOG_PREFIX} Step 5.5: Project upserted. Project ID: ${projectId}. Now syncing phone numbers and subscribing to webhooks.`);
        await handleSyncPhoneNumbers(projectId.toString());
        await handleSubscribeProjectWebhook(project.wabaId!, project.appId!, project.accessToken);
    }

    console.log(`${LOG_PREFIX} Step 6: Finalization complete.`);
    return { success: true };
  } catch (e: any) {
    const errorMsg = getErrorMessage(e);
    console.error(`${LOG_PREFIX} FATAL: Failed to finalize signup. Error:`, errorMsg, e);
    throw new Error(`Failed to finalize onboarding: ${errorMsg}`);
  }
}
