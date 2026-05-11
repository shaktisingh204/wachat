'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';

export async function saveLoan(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Unauthorized.' };
  }

  try {
    const type = (formData.get('type') as string) || 'customer_loan';
    const borrowerName = (formData.get('borrowerName') as string) || '';
    const borrowerId = (formData.get('borrowerId') as string) || '';
    const principal = parseFloat((formData.get('principal') as string) || '0');
    const interestRate = parseFloat((formData.get('interestRate') as string) || '0');
    const tenureMonths = parseInt((formData.get('tenureMonths') as string) || '1', 10);
    const startDate = (formData.get('startDate') as string) || '';
    const notes = (formData.get('notes') as string) || '';

    if (!borrowerName.trim()) {
      return { error: 'Borrower name is required.' };
    }
    if (!principal || principal <= 0) {
      return { error: 'Principal amount must be greater than 0.' };
    }

    let emi: number;
    if (interestRate > 0) {
      const r = interestRate / 1200;
      const n = tenureMonths;
      emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    } else {
      emi = principal / tenureMonths;
    }
    emi = Math.round(emi * 100) / 100;

    const { db } = await connectToDatabase();

    const doc: Record<string, any> = {
      userId: new ObjectId(session.user._id as string),
      type,
      borrowerName,
      principal,
      interestRate,
      tenureMonths,
      emi,
      outstanding: principal,
      npa: false,
      startDate: startDate ? new Date(startDate) : new Date(),
      status: 'active',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (borrowerId && ObjectId.isValid(borrowerId)) {
      doc.borrowerId = new ObjectId(borrowerId);
    }

    const result = await db.collection('crm_loans').insertOne(doc);

    revalidatePath('/dashboard/crm/loans');

    return { message: 'Loan created.', id: result.insertedId.toString() };
  } catch (e: any) {
    console.error('saveLoan error:', e);
    return { error: e?.message || 'Failed to create loan.' };
  }
}
