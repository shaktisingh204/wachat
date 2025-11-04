
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import { nanoid } from 'nanoid';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import { ApiKey, User } from '@/lib/definitions';
import { hashPassword, comparePassword } from '@/lib/auth';

const API_KEY_PREFIX = 'sn_';

export async function generateApiKey(name: string): Promise<{ success: boolean, apiKey?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };

    if (!name) return { success: false, error: 'API key name is required.' };

    try {
        const { db } = await connectToDatabase();
        
        const plainTextKey = `${API_KEY_PREFIX}${nanoid(32)}`;
        const hashedKey = await hashPassword(plainTextKey);

        const newApiKey: ApiKey = {
            _id: new ObjectId(),
            name,
            key: hashedKey,
            requestCount: 0,
            createdAt: new Date(),
            revoked: false,
        };

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $push: { apiKeys: newApiKey } }
        );

        revalidatePath('/dashboard/api');
        
        // Return the plain text key to the user ONCE.
        return { success: true, apiKey: plainTextKey };
        
    } catch (e: any) {
        return { success: false, error: 'Failed to generate API key.' };
    }
}

export async function getApiKeysForUser(): Promise<Omit<ApiKey, 'key'>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });
        
        if (!user || !user.apiKeys) {
            return [];
        }

        // Never expose the hashed key to the client
        return JSON.parse(JSON.stringify(user.apiKeys.map(({ key, ...rest }) => rest)));

    } catch (e) {
        return [];
    }
}

export async function revokeApiKey(keyId: string): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };
    
    if (!ObjectId.isValid(keyId)) return { success: false, error: 'Invalid key ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id), 'apiKeys._id': new ObjectId(keyId) },
            { $set: { 'apiKeys.$.revoked': true } }
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'API key not found or you do not have permission.' };
        }
        
        revalidatePath('/dashboard/api');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: 'Failed to revoke API key.' };
    }
}

export async function authenticateApiKey(apiKey: string): Promise<{ success: boolean; user?: WithId<User> }> {
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return { success: false };
  }

  try {
    const { db } = await connectToDatabase();
    const users = await db.collection<User>('users').find({ 'apiKeys.revoked': false }).toArray();
    
    for (const user of users) {
      for (const storedKey of user.apiKeys || []) {
        if (!storedKey.revoked && await comparePassword(apiKey, storedKey.key)) {
          // It's a match, update usage stats
          await db.collection('users').updateOne(
            { _id: user._id, 'apiKeys._id': storedKey._id },
            { $set: { 'apiKeys.$.lastUsed': new Date() }, $inc: { 'apiKeys.$.requestCount': 1 } }
          );
          return { success: true, user: JSON.parse(JSON.stringify(user)) };
        }
      }
    }

    return { success: false };
  } catch (error) {
    console.error('API key authentication error:', error);
    return { success: false };
  }
}
