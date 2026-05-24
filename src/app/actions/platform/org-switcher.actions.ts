'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Organization } from '@/types/platform';
import { revalidatePath } from 'next/cache';

const collectionName = 'platform_organizations';

const orgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  role: z.enum(['owner', 'admin', 'member']),
  active: z.boolean(),
});

export async function getOrganizations(): Promise<Organization[]> {
  const { db } = await connectToDatabase();
  const docs = await db.collection(collectionName).find({}).sort({ name: 1 }).toArray();
  return docs.map(doc => ({
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    role: doc.role,
    active: doc.active,
  }));
}

export async function createOrganization(data: any): Promise<Organization> {
  const parsed = orgSchema.parse(data);
  const { db } = await connectToDatabase();
  const res = await db.collection(collectionName).insertOne(parsed);
  revalidatePath('/dashboard/platform/org-switcher');
  return {
    id: res.insertedId.toString(),
    ...parsed,
  };
}

export async function deleteOrganization(id: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const res = await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
  revalidatePath('/dashboard/platform/org-switcher');
  return res.deletedCount === 1;
}
