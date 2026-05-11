'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';

export async function saveSla(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();

    const name = (formData.get('name') as string | null)?.trim() || '';
    if (!name) return { error: 'SLA name is required.' };

    const firstResponseMinutesRaw = formData.get('firstResponseMinutes') as string | null;
    const resolutionMinutesRaw = formData.get('resolutionMinutes') as string | null;

    const firstResponseMinutes = firstResponseMinutesRaw ? parseInt(firstResponseMinutesRaw, 10) : NaN;
    const resolutionMinutes = resolutionMinutesRaw ? parseInt(resolutionMinutesRaw, 10) : NaN;

    if (isNaN(firstResponseMinutes) || firstResponseMinutes < 1) {
      return { error: 'First response target (minutes) is required.' };
    }
    if (isNaN(resolutionMinutes) || resolutionMinutes < 1) {
      return { error: 'Resolution target (minutes) is required.' };
    }

    const description = (formData.get('description') as string | null)?.trim() || undefined;
    const businessHoursOnly = formData.get('businessHoursOnly') === 'on';
    const priority = (formData.get('priority') as string | null) || 'medium';
    const notes = (formData.get('notes') as string | null)?.trim() || undefined;
    const escalateAfterRaw = formData.get('escalateAfterMinutes') as string | null;
    const escalateAfterMinutes = escalateAfterRaw ? parseInt(escalateAfterRaw, 10) : undefined;
    const escalateTo = (formData.get('escalateTo') as string | null)?.trim() || undefined;

    const doc: Record<string, any> = {
      userId: new ObjectId(session.user._id as string),
      name,
      priority,
      firstResponseMinutes,
      resolutionMinutes,
      businessHoursOnly,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (description) doc.description = description;
    if (notes) doc.notes = notes;
    if (escalateAfterMinutes && !isNaN(escalateAfterMinutes) && escalateAfterMinutes > 0) {
      doc.escalateAfterMinutes = escalateAfterMinutes;
    }
    if (escalateTo) doc.escalateTo = escalateTo;

    const { insertedId } = await db.collection('crm_slas').insertOne(doc);

    revalidatePath('/dashboard/crm/tickets/sla');
    return { message: 'SLA policy created.', id: insertedId.toString() };
  } catch (e: any) {
    console.error('saveSla error:', e);
    return { error: e?.message || 'An unexpected error occurred.' };
  }
}
