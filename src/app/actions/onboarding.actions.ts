
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


export async function handleWabaOnboarding(code: string, state: string) {
    console.log(`${LOG_PREFIX} Step 1: Received onboarding callback with authorization code.`);
    
    const { db } = await connectToDatabase();
    const stateDoc = await db.collection('oauth_states').findOne({ state: state });

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

        console.log(`${LOG_PREFIX} Step 3: Token exchange successful. Long-lived access token received.`);

        await db.collection('meta_tokens').updateOne(
            { userId: new ObjectId(userId) },
            {
                $set: {
                userId: new ObjectId(userId),
                systemToken: data.access_token,
                createdAt: new Date(),
                },
            },
            { upsert: true }
        );

        console.log(`${LOG_PREFIX} Step 4: System user token saved to database for user ${userId}. Waiting for webhook...`);

        return { success: true };
    } catch (e: any) {
        const errorMsg = getErrorMessage(e);
        console.error(`${LOG_PREFIX} Error during token exchange for user ${userId}:`, errorMsg, e);
        throw new Error(`Token exchange failed: ${errorMsg}`);
    }
}


export async function finalizeEmbeddedSignup(
  userId: string,
  wabaId: string
) {
  console.log(`${LOG_PREFIX} Step 5: Finalizing embedded signup for user ${userId} and WABA ${wabaId}.`);
  const { db } = await connectToDatabase();

  const tokenDoc = await db
    .collection('meta_tokens')
    .findOne({ userId: new ObjectId(userId) });

  if (!tokenDoc?.systemToken) {
    console.error(`${LOG_PREFIX} Error: System token not found for user ${userId}.`);
    throw new Error('System token not found');
  }
  console.log(`${LOG_PREFIX} Step 5.1: Found system token for user.`);

  const accessToken = tokenDoc.systemToken;

  try {
    console.log(`${LOG_PREFIX} Step 5.2: Fetching WABA details from Meta.`);
    const { data: waba } = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${wabaId}`,
      {
        params: { 
            fields: 'id,name,timezone,business',
            access_token: accessToken 
        },
      }
    );
     console.log(`${LOG_PREFIX} Step 5.3: Successfully fetched WABA details:`, waba);
     
    const businessId = waba.business?.id;
    let businessCaps: BusinessCapabilities | undefined;

    if (businessId) {
        console.log(`${LOG_PREFIX} Step 5.4: Fetching business capabilities for business ID ${businessId}.`);
        const { data: capsData } = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${businessId}`,
            {
                params: {
                    fields: 'business_capabilities',
                    access_token: accessToken
                }
            }
        );
        businessCaps = capsData?.business_capabilities;
        console.log(`${LOG_PREFIX} Step 5.5: Fetched business capabilities:`, businessCaps);
    }

    const defaultPlan = await db.collection('plans').findOne({ isDefault: true });
    if (defaultPlan) {
        console.log(`${LOG_PREFIX} Step 5.6: Found default plan "${defaultPlan.name}".`);
    }

    const project: Omit<Project, '_id'> = {
      userId: new ObjectId(userId),
      name: waba.name || `WABA ${waba.id}`,
      wabaId: waba.id,
      businessId: businessId,
      accessToken,
      messagesPerSecond: 80,
      phoneNumbers: [],
      createdAt: new Date(),
      planId: defaultPlan?._id,
      credits: defaultPlan?.signupCredits || 0,
      businessCapabilities: businessCaps,
    };
    
    console.log(`${LOG_PREFIX} Step 5.7: Upserting project into database.`);
    const updateResult = await db.collection<Project>('projects').updateOne(
      { userId: project.userId, wabaId: project.wabaId },
      { $set: project },
      { upsert: true }
    );
    
    const projectId = updateResult.upsertedId ? updateResult.upsertedId : (await db.collection('projects').findOne({ userId: project.userId, wabaId: project.wabaId }))?._id;
    
    if (projectId) {
        console.log(`${LOG_PREFIX} Step 5.8: Project upserted. Project ID: ${projectId}. Now syncing phone numbers and subscribing to webhooks.`);
        await handleSyncPhoneNumbers(projectId.toString());
        await handleSubscribeProjectWebhook(project.wabaId, project.appId!, project.accessToken);
    }


    console.log(`${LOG_PREFIX} Step 6: Onboarding finalized successfully.`);
    return { success: true };
  } catch (e: any) {
    const errorMsg = getErrorMessage(e);
    console.error(`${LOG_PREFIX} FATAL: Failed to finalize embedded signup. Error:`, errorMsg, e);
    throw new Error(`Failed to finalize onboarding: ${errorMsg}`);
  }
}
