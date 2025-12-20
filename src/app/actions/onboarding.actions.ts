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

/* --------------------------------------------------
   STEP 1: EXCHANGE AUTH CODE → ACCESS TOKEN
-------------------------------------------------- */
async function exchangeCodeForTokens(code: string) {
  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!;
  const appSecret = process.env.META_ONBOARDING_APP_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/facebook/callback`;

  try {
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

    if (!data.access_token) {
      throw new Error('Access token not returned by Meta');
    }

    return { accessToken: data.access_token };
  } catch (e: any) {
    return { error: getErrorMessage(e) };
  }
}

/* --------------------------------------------------
   STEP 2: VERIFY TOKEN SCOPES
-------------------------------------------------- */
async function verifyTokenScopes(accessToken: string) {
  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID!;
  const appSecret = process.env.META_ONBOARDING_APP_SECRET!;

  const { data } = await axios.get('https://graph.facebook.com/debug_token', {
    params: {
      input_token: accessToken,
      access_token: `${appId}|${appSecret}`,
    },
  });

  const scopes: string[] = data.data.scopes || [];

  const requiredScopes = [
    'business_management',
    'whatsapp_business_management',
    'whatsapp_business_messaging',
  ];

  const missing = requiredScopes.filter(s => !scopes.includes(s));

  if (missing.length) {
    throw new Error(
      `Missing Meta permissions: ${missing.join(', ')}. Please reconnect and approve access.`
    );
  }
}

/* --------------------------------------------------
   STEP 3: FETCH BUSINESSES + WABAs
-------------------------------------------------- */
async function getWabaDetails(accessToken: string) {
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/me/businesses`,
      { params: { access_token: accessToken } }
    );

    const businesses = data.data || [];
    if (!businesses.length) {
      throw new Error('No Meta Business accounts found');
    }

    const wabas: { id: string; name: string }[] = [];

    for (const business of businesses) {
      const res = await axios.get(
        `https://graph.facebook.com/${API_VERSION}/${business.id}/owned_whatsapp_business_accounts`,
        {
          params: {
            fields: 'id,name',
            access_token: accessToken,
          },
        }
      );

      if (res.data?.data?.length) {
        wabas.push(...res.data.data);
      }
    }

    if (!wabas.length) {
      throw new Error('No WhatsApp Business Accounts found');
    }

    return wabas;
  } catch (e: any) {
    throw new Error(e.response?.data?.error?.message || e.message);
  }
}

/* --------------------------------------------------
   STEP 4: MAIN ONBOARDING HANDLER
-------------------------------------------------- */
export async function handleWabaOnboarding(code?: string) {
  if (!code) return { error: 'Authorization code missing' };

  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };

  try {
    const tokenRes = await exchangeCodeForTokens(code);
    if (tokenRes.error || !tokenRes.accessToken) {
      throw new Error(tokenRes.error);
    }

    const accessToken = tokenRes.accessToken;

    // 🔐 Validate permissions
    await verifyTokenScopes(accessToken);

    // 📦 Fetch WABAs
    const wabas = await getWabaDetails(accessToken);

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

    await db.collection<Project>('projects').bulkWrite(ops);

    // 🔁 Post-setup
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

    return { success: true };
  } catch (e: any) {
    return { error: getErrorMessage(e) };
  }
}
