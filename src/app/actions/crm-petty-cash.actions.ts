'use server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';

export async function savePettyCashFloat(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Access denied.' };
  }

  const branchName = (formData.get('branchName') as string | null) ?? '';
  const custodianName = (formData.get('custodianName') as string | null) ?? '';
  const openingBalance = parseFloat((formData.get('openingBalance') as string | null) ?? '0') || 0;
  const notes = (formData.get('notes') as string | null) ?? '';

  if (!branchName.trim()) {
    return { error: 'Branch name is required.' };
  }

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_petty_cash_floats').insertOne({
      userId: new ObjectId(session.user._id as string),
      branchName,
      custodianName,
      openingBalance,
      totalTopUps: 0,
      totalSpent: 0,
      balance: openingBalance,
      status: 'active',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/dashboard/crm/petty-cash');
    return { message: 'Petty cash float created.', id: result.insertedId.toString() };
  } catch (e) {
    console.error('savePettyCashFloat error:', e);
    return { error: 'Failed to create petty cash float. Please try again.' };
  }
}
