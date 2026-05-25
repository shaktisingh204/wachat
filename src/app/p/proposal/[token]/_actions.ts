'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';

const COL = {
  tokens: 'crm_public_tokens',
  proposals: 'crm_proposals',
};

async function getUserIdAndProposalId(token: string) {
  const { db } = await connectToDatabase();
  const doc = await db.collection(COL.tokens).findOne({ token, resource_type: 'proposal' });
  if (!doc) return null;
  
  // ensure revoked is not true, and not expired
  if (doc.revoked) return null;
  if (doc.expires_at && new Date(doc.expires_at).getTime() < Date.now()) return null;

  const userId = typeof doc.userId === 'string' ? new ObjectId(doc.userId) : doc.userId;
  const resourceId = typeof doc.resource_id === 'string' ? new ObjectId(doc.resource_id) : doc.resource_id;

  return { userId, resourceId };
}

export async function addProposalComment(token: string, text: string) {
  const ctx = await getUserIdAndProposalId(token);
  if (!ctx) return { success: false, error: 'Invalid token' };
  
  const { db } = await connectToDatabase();
  await db.collection(COL.proposals).updateOne(
    { _id: ctx.resourceId, userId: ctx.userId },
    { 
      $push: { 
        comments: { 
           id: new ObjectId().toString(),
           text, 
           createdAt: new Date(),
           author: 'Client'
        } 
      } as any 
    }
  );
  revalidatePath(`/p/proposal/${token}`);
  return { success: true };
}

export async function declineProposal(token: string, reason: string) {
  const ctx = await getUserIdAndProposalId(token);
  if (!ctx) return { success: false, error: 'Invalid token' };

  const { db } = await connectToDatabase();
  await db.collection(COL.proposals).updateOne(
    { _id: ctx.resourceId, userId: ctx.userId },
    { $set: { status: 'declined', decline_reason: reason, updatedAt: new Date() } }
  );
  revalidatePath(`/p/proposal/${token}`);
  return { success: true };
}
