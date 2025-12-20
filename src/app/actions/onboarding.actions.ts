'use server';

import axios from 'axios';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '.';
import { getErrorMessage } from '@/lib/utils';
import type { User, Project } from '@/lib/definitions';

const API_VERSION = 'v23.0';

/* ──────────────────────────────────────────────
   STEP 1: EXCHANGE CODE → SYSTEM USER TOKEN
────────────────────────────────────────────── */
export async function saveSystemToken(code: string) {
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };

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
      throw new Error('Meta did not return access token');
    }

    const { db } = await connectToDatabase();

    await db.collection('meta_tokens').updateOne(
      { userId: new ObjectId(session.user._id) },
      {
        $set: {
          userId: new ObjectId(session.user._id),
          systemToken: data.access_token,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return { success: true };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

/* ──────────────────────────────────────────────
   STEP 3: FINALIZE PROJECT AFTER WEBHOOK
────────────────────────────────────────────── */
export async function finalizeEmbeddedSignup(
  userId: string,
  wabaId: string
) {
  const { db } = await connectToDatabase();

  const tokenDoc = await db
    .collection('meta_tokens')
    .findOne({ userId: new ObjectId(userId) });

  if (!tokenDoc?.systemToken) {
    throw new Error('System token not found');
  }

  const accessToken = tokenDoc.systemToken;

  // ✅ Validate WABA directly
  const { data: waba } = await axios.get(
    `https://graph.facebook.com/${API_VERSION}/${wabaId}`,
    {
      params: { fields: 'id,name,timezone' },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const project: Project = {
    userId: new ObjectId(userId),
    name: waba.name || `WABA ${waba.id}`,
    wabaId: waba.id,
    accessToken,
    messagesPerSecond: 80,
    phoneNumbers: [],
    createdAt: new Date(),
  };

  await db.collection<Project>('projects').updateOne(
    { userId: project.userId, wabaId: project.wabaId },
    { $set: project },
    { upsert: true }
  );

  return { success: true };
}
