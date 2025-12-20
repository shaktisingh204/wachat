'use server';

import axios from 'axios';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '.';
import { getErrorMessage } from '@/lib/utils';
import { handleSyncPhoneNumbers, handleSubscribeProjectWebhook } from './whatsapp.actions';
import type { User, Plan, Project } from '@/lib/definitions';

const API_VERSION = 'v23.0';

/* ──────────────────────────────────────────────
   META TOKEN DEBUGGER (CRITICAL)
────────────────────────────────────────────── */
async function debugMetaToken(accessToken: string) {
  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!;
  const appSecret = process.env.META_ONBOARDING_APP_SECRET!;

  const { data } = await axios.get(
    'https://graph.facebook.com/debug_token',
    {
      params: {
        input_token: accessToken,
        access_token: `${appId}|${appSecret}`,
      },
    }
  );

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[META DEBUG] Token Debug Result');
  console.log('User ID:', data.data.user_id);
  console.log('App ID:', data.data.app_id);
  console.log('Token Type:', data.data.type);
  console.log('Is Valid:', data.data.is_valid);
  console.log(
    'Expires At:',
    data.data.expires_at
      ? new Date(data.data.expires_at * 1000)
      : 'never'
  );
  console.log('Scopes Granted:', data.data.scopes);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return data.data;
}

/* ──────────────────────────────────────────────
   STEP 1: EXCHANGE CODE → TOKEN
────────────────────────────────────────────── */
async function exchangeCodeForToken(code: string) {
  console.log('[ONBOARDING] Step 2: Exchanging code for access token');

  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!;
  const appSecret = process.env.META_ONBOARDING_APP_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/facebook/callback`;

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const { data } = await axios.post(
    `https://graph.facebook.com/${API_VERSION}/oauth/access_token`,
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  console.log('[ONBOARDING] Token exchange response:', data);

  if (!data.access_token) {
    throw new Error('Meta did not return an access token');
  }

  return data.access_token;
}

/* ──────────────────────────────────────────────
   STEP 2: FETCH BUSINESSES + WABAs
────────────────────────────────────────────── */
async function fetchWabas(accessToken: string) {
  console.log('[ONBOARDING] Fetching businesses via /me/businesses');

  const businessRes = await axios.get(
    `https://graph.facebook.com/${API_VERSION}/me/businesses`,
    { params: { access_token: accessToken } }
  );

  console.log(
    '[ONBOARDING] /me/businesses response:',
    JSON.stringify(businessRes.data, null, 2)
  );

  const businesses = businessRes.data?.data || [];
  if (!businesses.length) {
    throw new Error('No Meta Business accounts found');
  }

  const wabas: { id: string; name: string }[] = [];

  for (const business of businesses) {
    console.log(
      `[ONBOARDING] Fetching WABAs for business ${business.id}`
    );

    try {
      const wabaRes = await axios.get(
        `https://graph.facebook.com/${API_VERSION}/${business.id}/owned_whatsapp_business_accounts`,
        {
          params: {
            fields: 'id,name',
            access_token: accessToken,
          },
        }
      );

      console.log(
        `[ONBOARDING] WABA response for ${business.id}:`,
        JSON.stringify(wabaRes.data, null, 2)
      );

      if (wabaRes.data?.data?.length) {
        wabas.push(...wabaRes.data.data);
      }
    } catch (err: any) {
      console.warn(
        `[ONBOARDING] Failed fetching WABAs for business ${business.id}`,
        err.response?.data || err.message
      );
    }
  }

  if (!wabas.length) {
    throw new Error('No WhatsApp Business Accounts found');
  }

  return wabas;
}

/* ──────────────────────────────────────────────
   MAIN HANDLER
────────────────────────────────────────────── */
export async function handleWabaOnboarding(code?: string) {
  console.log('[ONBOARDING] Step 1: Callback received');

  if (!code) return { error: 'Authorization code missing' };

  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };

  try {
    /* 🔑 TOKEN */
    const accessToken = await exchangeCodeForToken(code);

    /* 🔍 TOKEN DEBUG */
    const debugData = await debugMetaToken(accessToken);

    if (!debugData.scopes?.includes('business_management')) {
      console.error(
        '[ONBOARDING] business_management NOT GRANTED',
        debugData.scopes
      );

      return {
        error:
          'Meta did not grant business access. Remove the app from Facebook settings and reconnect.',
      };
    }

    /* 🏢 FETCH WABAs */
    const wabas = await fetchWabas(accessToken);

    /* 💾 DATABASE */
    const { db } = await connectToDatabase();

    const user = await db
      .collection<User>('users')
      .findOne({ _id: new ObjectId(session.user._id) });

    if (!user) throw new Error('User not found');

    let planId = user.planId;
    let credits = user.credits || 0;

    if (!planId) {
      const defaultPlan = await db
        .collection<Plan>('plans')
        .findOne({ isDefault: true });

      if (!defaultPlan) throw new Error('Default plan not configured');

      planId = defaultPlan._id;
      credits = defaultPlan.signupCredits || 0;
    }

    const ops = wabas.map(waba => ({
      updateOne: {
        filter: { userId: user._id, wabaId: waba.id },
        update: {
          $set: {
            userId: user._id,
            name: waba.name || `WABA ${waba.id}`,
            wabaId: waba.id,
            appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID,
            accessToken,
            planId,
            credits,
            messagesPerSecond: 80,
            phoneNumbers: [],
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    }));

    console.log(`[ONBOARDING] Writing ${ops.length} project(s)`);
    await db.collection<Project>('projects').bulkWrite(ops);

    /* 🔔 POST SETUP */
    for (const waba of wabas) {
      const project = await db
        .collection<Project>('projects')
        .findOne({ userId: user._id, wabaId: waba.id });

      if (project) {
        await handleSyncPhoneNumbers(project._id.toString());
        await handleSubscribeProjectWebhook(
          project.wabaId!,
          project.appId!,
          project.accessToken
        );
      }
    }

    revalidatePath('/dashboard');
    console.log('[ONBOARDING] SUCCESS');

    return { success: true };
  } catch (e: any) {
    console.error('[ONBOARDING] FAILED', e);
    return { error: getErrorMessage(e) };
  }
}
