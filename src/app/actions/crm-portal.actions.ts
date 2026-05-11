'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export async function savePortalUser(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Unauthorized.' };
  }

  try {
    const name = (formData.get('name') as string || '').trim();
    const email = (formData.get('email') as string || '').trim();
    const portalType = (formData.get('portalType') as string || 'customer').trim();
    const capabilitiesRaw = (formData.get('capabilities') as string || '').trim();
    const linkedEntityId = (formData.get('linkedEntityId') as string || '').trim();
    const notes = (formData.get('notes') as string || '').trim();

    if (!name) {
      return { error: 'Full name is required.' };
    }
    if (!email || !email.includes('@')) {
      return { error: 'A valid email address is required.' };
    }

    let capabilities: string[] = ['view_invoices', 'raise_tickets', 'view_documents'];
    if (capabilitiesRaw) {
      try {
        const parsed = JSON.parse(capabilitiesRaw);
        if (Array.isArray(parsed)) {
          capabilities = parsed;
        }
      } catch {
        // fallback to defaults
      }
    }

    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);

    const doc: Record<string, any> = {
      userId: userObjectId,
      name,
      email,
      portalType,
      capabilities,
      notes,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (linkedEntityId && ObjectId.isValid(linkedEntityId)) {
      doc.linkedEntityId = new ObjectId(linkedEntityId);
    }

    const result = await db.collection('crm_portal_users').insertOne(doc);

    revalidatePath('/dashboard/crm/portal');
    return { message: 'Portal user created successfully.', id: result.insertedId.toString() };
  } catch (e: any) {
    console.error('Failed to save portal user:', e);
    return { error: e?.message ?? 'An unexpected error occurred.' };
  }
}

export async function getPortalUserById(id: string): Promise<any | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;
  if (!ObjectId.isValid(id)) return null;

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_portal_users').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    console.error('Failed to fetch portal user by id:', e);
    return null;
  }
}
