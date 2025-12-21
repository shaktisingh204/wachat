'use server';

import axios from 'axios';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { Project, BusinessCapabilities } from '@/lib/definitions';
import {
  handleSubscribeProjectWebhook,
  handleSyncPhoneNumbers,
} from '@/app/actions/whatsapp.actions';

const API_VERSION = 'v24.0';
const LOG_PREFIX = '[ONBOARDING]';

export async function handleWabaOnboarding(data: {
  code: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { code } = data;

    if (!code) {
      return { success: false, error: 'Authorization code missing.' };
    }

    // ✅ FIX #1: cookies() IS ASYNC IN NEXT.JS 16
    const cookieStore = await cookies();

    const stateCookie = cookieStore.get('onboarding_state')?.value;

    if (!stateCookie) {
      return {
        success: false,
        error: 'Onboarding session expired or invalid. Please try again.',
      };
    }

    // Optional but recommended: prevent replay
    cookieStore.delete('onboarding_state');

    const { userId, includeCatalog } = JSON.parse(stateCookie);

    console.log(`${LOG_PREFIX} Step 1: Finalizing onboarding for user ${userId}.`);

    if (!userId || !ObjectId.isValid(userId)) {
      const errorMsg = `Invalid user ID provided from cookie: ${userId}`;
      console.error(`${LOG_PREFIX} ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const { db } = await connectToDatabase();

    /**
     * STEP 2: Exchange auth code for system user access token
     */
    console.log(`${LOG_PREFIX} Step 2: Exchanging auth code for access token.`);

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!,
      client_secret: process.env.META_ONBOARDING_APP_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/facebook/callback`,
    });

    const tokenResponse = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/oauth/access_token`,
      params
    );

    const accessToken = tokenResponse.data?.access_token;

    if (!accessToken) {
      throw new Error('Meta did not return an access token.');
    }

    console.log(`${LOG_PREFIX} Step 3: Access token received.`);

    /**
     * STEP 3: Find WABA via debug_token
     */
    const debugResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/debug_token`,
      {
        params: {
          input_token: accessToken,
          access_token: `${process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID}|${process.env.META_ONBOARDING_APP_SECRET}`,
        },
      }
    );

    const granularScopes = debugResponse.data?.data?.granular_scopes || [];
    const wabaId =
      granularScopes.find(
        (s: any) => s.scope === 'whatsapp_business_management'
      )?.target_ids?.[0];

    if (!wabaId) {
      throw new Error(
        'Could not find a WhatsApp Business Account associated with this token.'
      );
    }

    console.log(`${LOG_PREFIX} Step 4: Found WABA ID: ${wabaId}`);

    /**
     * STEP 4: Fetch WABA details
     */
    const { data: wabaData } = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${wabaId}`,
      {
        params: {
          fields: 'name,business',
          access_token: accessToken,
        },
      }
    );

    const wabaName = wabaData?.name || `WABA ${wabaId}`;
    const businessId = wabaData?.business?.id;

    console.log(
      `${LOG_PREFIX} Step 5: WABA name=${wabaName}, businessId=${businessId}`
    );

    /**
     * STEP 5.1: Fetch business capabilities (optional)
     */
    let businessCaps: BusinessCapabilities | undefined;

    if (businessId && includeCatalog) {
      try {
        const { data: capsData } = await axios.get(
          `https://graph.facebook.com/${API_VERSION}/${businessId}`,
          {
            params: {
              fields: 'business_capabilities',
              access_token: accessToken,
            },
          }
        );
        businessCaps = capsData?.business_capabilities;
        console.log(`${LOG_PREFIX} Step 5.1: Business capabilities fetched.`);
      } catch (e) {
        console.warn(
          `${LOG_PREFIX} Could not fetch business capabilities.`,
          getErrorMessage(e)
        );
      }
    }

    /**
     * STEP 6: Upsert project
     */
    console.log(`${LOG_PREFIX} Step 6: Upserting project.`);

    const defaultPlan = await db
      .collection('plans')
      .findOne({ isDefault: true });

    const projectData: Partial<Project> = {
      userId: new ObjectId(userId),
      name: wabaName,
      wabaId,
      businessId,
      accessToken,
      appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!,
      messagesPerSecond: 80,
      phoneNumbers: [],
      planId: defaultPlan?._id,
      credits: defaultPlan?.signupCredits || 0,
      businessCapabilities: businessCaps,
      hasCatalogManagement: includeCatalog && !!businessId,
    };

    await db.collection<Project>('projects').updateOne(
      { userId: projectData.userId, wabaId: projectData.wabaId },
      { $set: projectData, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    const project = await db
      .collection<Project>('projects')
      .findOne({ userId: projectData.userId, wabaId: projectData.wabaId });

    if (project?._id) {
      console.log(
        `${LOG_PREFIX} Step 7: Syncing phone numbers & subscribing webhook.`
      );
      await handleSyncPhoneNumbers(project._id.toString());
      await handleSubscribeProjectWebhook(
        projectData.wabaId!,
        projectData.appId!,
        projectData.accessToken!
      );
    }

    console.log(`${LOG_PREFIX} Step 8: Onboarding complete.`);

    return { success: true };
  } catch (e) {
    const errorMsg = getErrorMessage(e);
    console.error(`${LOG_PREFIX} FATAL ERROR`, errorMsg, e);
    return { success: false, error: errorMsg };
  }
}
