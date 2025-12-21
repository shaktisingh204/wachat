'use server';

import axios from 'axios';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { Project, BusinessCapabilities, Plan } from '@/lib/definitions';
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

    /**
     * STEP 0: Read & clear onboarding state cookie
     */
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get('onboarding_state')?.value;

    if (!stateCookie) {
      return {
        success: false,
        error: 'Onboarding session expired or invalid. Please try again.',
      };
    }

    cookieStore.delete('onboarding_state');

    const { userId, includeCatalog } = JSON.parse(stateCookie);

    if (!userId || !ObjectId.isValid(userId)) {
      return {
        success: false,
        error: 'Invalid user session. Please log in again.',
      };
    }

    console.log(`${LOG_PREFIX} Step 1: User ${userId} validated`);

    /**
     * STEP 1: Exchange auth code for system-user access token
     */
    console.log(`${LOG_PREFIX} Step 2: Exchanging code for access token`);

    const tokenParams = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!,
      client_secret: process.env.META_ONBOARDING_APP_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/facebook/callback`,
    });

    const tokenResponse = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/oauth/access_token`,
      tokenParams
    );

    const accessToken = tokenResponse.data?.access_token;

    if (!accessToken) {
      throw new Error('Meta did not return an access token.');
    }

    console.log(`${LOG_PREFIX} Step 3: Access token received`);

    /**
     * STEP 2: Resolve WABA ID using debug_token
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

    const granularScopes =
      debugResponse.data?.data?.granular_scopes || [];

    const wabaId =
      granularScopes.find(
        (s: any) => s.scope === 'whatsapp_business_management'
      )?.target_ids?.[0];

    if (!wabaId) {
      throw new Error(
        'No WhatsApp Business Account found for this Meta account.'
      );
    }

    console.log(`${LOG_PREFIX} Step 4: WABA ID resolved → ${wabaId}`);

    /**
     * STEP 3: Fetch WABA name (business field REMOVED by Meta)
     */
    const { data: wabaData } = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${wabaId}`,
      {
        params: {
          fields: 'name',
          access_token: accessToken,
        },
      }
    );

    const wabaName = wabaData?.name || `WABA ${wabaId}`;

    /**
     * STEP 4: Resolve Business ID (ONLY if catalog requested)
     */
    let businessId: string | undefined;
    let businessCaps: BusinessCapabilities | undefined;

    if (includeCatalog) {
      businessId =
        granularScopes.find(
          (s: any) => s.scope === 'whatsapp_business_management'
        )?.target_ids?.[0];

      if (businessId) {
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
        } catch (e) {
          console.warn(
            `${LOG_PREFIX} Could not fetch business capabilities`,
            getErrorMessage(e)
          );
        }
      }
    }

    /**
     * STEP 5: Database upsert
     */
    const { db } = await connectToDatabase();

    const defaultPlan = await db
      .collection<Plan>('plans')
      .findOne({ isDefault: true });

    const projectData: Partial<Project> = {
      userId: new ObjectId(userId),
      name: wabaName,
      wabaId,
      businessId,
      appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!,
      accessToken,
      phoneNumbers: [],
      messagesPerSecond: 80,
      planId: defaultPlan?._id,
      credits: defaultPlan?.signupCredits || 0,
      businessCapabilities: businessCaps,
      hasCatalogManagement: includeCatalog && !!businessId,
    };

    await db.collection<Project>('projects').updateOne(
      { userId: projectData.userId, wabaId: projectData.wabaId },
      {
        $set: projectData,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    const project = await db
      .collection<Project>('projects')
      .findOne({ userId: projectData.userId, wabaId });

    /**
     * STEP 6: Post-creation actions
     */
    if (project?._id) {
      console.log(`${LOG_PREFIX} Step 6: Syncing phone numbers`);
      await handleSyncPhoneNumbers(project._id.toString());

      console.log(`${LOG_PREFIX} Step 7: Subscribing webhooks`);
      await handleSubscribeProjectWebhook(
        wabaId,
        projectData.appId!,
        accessToken
      );
    }

    console.log(`${LOG_PREFIX} Step 8: Onboarding complete`);

    return { success: true };
  } catch (e: any) {
    const errorMsg = getErrorMessage(e);
    console.error(`${LOG_PREFIX} FATAL`, errorMsg, e);
    return { success: false, error: errorMsg };
  }
}
