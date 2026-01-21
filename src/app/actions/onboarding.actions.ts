
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
const LOG_PREFIX_WABA = '[WABA ONBOARDING]';
const LOG_PREFIX_META = '[META SUITE ONBOARDING]';

export async function handleWabaOnboarding(data: {
  code: string;
  state: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { code, state } = data;

    if (!code) {
      return { success: false, error: 'Authorization code missing.' };
    }

    const cookieStore = await cookies();
    const stateCookieJSON = cookieStore.get('onboarding_state')?.value;

    if (!stateCookieJSON) {
      return {
        success: false,
        error: 'Onboarding session expired or invalid. Please try again.',
      };
    }
    
    const stateCookie = JSON.parse(stateCookieJSON);

    if (state !== stateCookie.state) {
        return { success: false, error: 'Invalid onboarding state. CSRF check failed.' };
    }

    cookieStore.delete('onboarding_state');

    const { userId, includeCatalog } = stateCookie;

    if (!userId || !ObjectId.isValid(userId)) {
      return {
        success: false,
        error: 'Invalid user session. Please log in again.',
      };
    }

    console.log(`${LOG_PREFIX_WABA} Step 1: User ${userId} validated`);

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

    const userAccessToken = tokenResponse.data?.access_token;

    if (!userAccessToken) {
      throw new Error('Meta did not return an access token.');
    }

    console.log(`${LOG_PREFIX_WABA} Step 3: Access token received`);

    const debugResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/debug_token`,
      {
        params: {
          input_token: userAccessToken,
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

    console.log(`${LOG_PREFIX_WABA} Step 4: WABA ID resolved → ${wabaId}`);

    const { data: wabaData } = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${wabaId}`,
      {
        params: {
          fields: 'name',
          access_token: userAccessToken,
        },
      }
    );

    const wabaName = wabaData?.name || `WABA ${wabaId}`;

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
                access_token: userAccessToken,
              },
            }
          );
          businessCaps = capsData?.business_capabilities;
        } catch (e) {
          console.warn(
            `${LOG_PREFIX_WABA} Could not fetch business capabilities`,
            getErrorMessage(e)
          );
        }
      }
    }

    const { db } = await connectToDatabase();
    const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });

    const projectData: Partial<Project> = {
      userId: new ObjectId(userId),
      name: wabaName,
      wabaId,
      businessId,
      appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!,
      accessToken: process.env.META_ADMIN_TOKEN!,
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

    const project = await db.collection<Project>('projects').findOne({ userId: projectData.userId, wabaId });

    if (project?._id) {
      console.log(`${LOG_PREFIX_WABA} Step 6: Syncing phone numbers`);
      await handleSyncPhoneNumbers(project._id.toString());

      const updatedProject = await db.collection<Project>('projects').findOne({ _id: project._id });

      if (updatedProject?.phoneNumbers?.length > 0) {
        console.log(`${LOG_PREFIX_WABA} Step 7: Registering verified phone numbers`);
        for (const phone of updatedProject.phoneNumbers) {
          if (phone.code_verification_status === 'VERIFIED') {
            try {
              await axios.post(
                `https://graph.facebook.com/${API_VERSION}/${phone.id}/register`,
                { messaging_product: 'whatsapp' },
                { headers: { Authorization: `Bearer ${userAccessToken}` } }
              );
              console.log(`${LOG_PREFIX_WABA} Successfully sent registration request for ${phone.display_phone_number} (${phone.id}).`);
            } catch (regError: any) {
              console.warn(`${LOG_PREFIX_WABA} Could not register phone number ${phone.id}. It may already be registered.`, getErrorMessage(regError));
            }
          }
        }
      }

      console.log(`${LOG_PREFIX_WABA} Step 8: Subscribing webhooks`);
      await handleSubscribeProjectWebhook(
        wabaId,
        projectData.appId!,
        userAccessToken
      );
    }

    console.log(`${LOG_PREFIX_WABA} Step 9: Onboarding complete`);
    return { success: true };
  } catch (e: any) {
    const errorMsg = getErrorMessage(e);
    console.error(`${LOG_PREFIX_WABA} FATAL`, errorMsg, e);
    return { success: false, error: errorMsg };
  }
}

export async function handleMetaSuiteOnboarding(data: {
  code: string;
  state: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { code, state } = data;

    if (!code) return { success: false, error: 'Authorization code missing.' };

    const cookieStore = await cookies();
    const stateCookieJSON = cookieStore.get('onboarding_state')?.value;
    if (!stateCookieJSON) return { success: false, error: 'Onboarding session expired.' };
    
    const stateCookie = JSON.parse(stateCookieJSON);
    if (state !== stateCookie.state) {
        return { success: false, error: 'Invalid onboarding state. CSRF check failed.' };
    }

    cookieStore.delete('onboarding_state');

    const { userId } = stateCookie;
    if (!userId || !ObjectId.isValid(userId)) return { success: false, error: 'Invalid user session.' };

    console.log(`${LOG_PREFIX_META} Step 1: Exchanging code for access token`);
    const tokenParams = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/facebook/callback`,
    });
    const tokenResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`, tokenParams);
    const userAccessToken = tokenResponse.data?.access_token;
    if (!userAccessToken) throw new Error('Meta did not return an access token.');
    
    console.log(`${LOG_PREFIX_META} Step 2: Getting user accounts (pages)`);
    const accountsResponse = await axios.get(`https://graph.facebook.com/${API_VERSION}/me/accounts`, {
        params: {
            fields: 'id,name,access_token,tasks',
            access_token: userAccessToken
        }
    });
    const pages = accountsResponse.data.data;
    if (!pages || pages.length === 0) throw new Error('No Facebook pages found for this user.');

    console.log(`${LOG_PREFIX_META} Step 3: Getting Ad Accounts`);
    const adAccountsResponse = await axios.get(`https://graph.facebook.com/${API_VERSION}/me/adaccounts`, {
        params: {
            fields: 'id,name,account_id',
            access_token: userAccessToken
        }
    });
    const adAccount = adAccountsResponse.data?.data?.[0]; // Use the first ad account found

    const { db } = await connectToDatabase();
    
    const bulkOps = pages.map((page: any) => {
      // Create a separate project for each Facebook Page
      const projectData = {
          name: page.name,
          userId: new ObjectId(userId),
          facebookPageId: page.id,
          accessToken: process.env.META_ADMIN_TOKEN!,
          adAccountId: adAccount?.account_id,
          appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!,
      };
      
      return {
          updateOne: {
              filter: { userId: projectData.userId, facebookPageId: projectData.facebookPageId },
              update: {
                  $set: projectData,
                  $setOnInsert: { createdAt: new Date() }
              },
              upsert: true
          }
      };
    });

    if (bulkOps.length > 0) {
        await db.collection('projects').bulkWrite(bulkOps);
    }
    
    console.log(`${LOG_PREFIX_META} Step 4: Finished upserting ${pages.length} page(s) as projects.`);

    return { success: true };
  } catch (e: any) {
    const errorMsg = getErrorMessage(e);
    console.error(`${LOG_PREFIX_META} FATAL`, errorMsg, e);
    return { success: false, error: errorMsg };
  }
}

    