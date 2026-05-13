'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';

export async function getLoanById(id: string): Promise<any | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;
  if (!ObjectId.isValid(id)) return null;

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_loans').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    console.error('Failed to fetch loan by id:', e);
    return null;
  }
}

export async function updateLoan(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Unauthorized.' };
  }

  const id = (formData.get('id') as string) || '';
  if (!id || !ObjectId.isValid(id)) {
    return { error: 'Invalid loan ID.' };
  }

  try {
    const type = (formData.get('type') as string) || 'customer_loan';
    const borrowerName = (formData.get('borrowerName') as string) || '';
    const principal = parseFloat((formData.get('principal') as string) || '0');
    const interestRate = parseFloat((formData.get('interestRate') as string) || '0');
    const tenureMonths = parseInt((formData.get('tenureMonths') as string) || '1', 10);
    const startDate = (formData.get('startDate') as string) || '';
    const notes = (formData.get('notes') as string) || '';
    const status = (formData.get('status') as string) || 'active';

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
    const result = await db.collection('crm_loans').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          type,
          borrowerName,
          principal,
          interestRate,
          tenureMonths,
          emi,
          startDate: startDate ? new Date(startDate) : new Date(),
          status,
          notes,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return { error: 'Loan not found or permission denied.' };
    }

    revalidatePath('/dashboard/crm/loans');
    revalidatePath(`/dashboard/crm/loans/${id}`);
    return { message: 'Loan updated.', id };
  } catch (e: any) {
    console.error('updateLoan error:', e);
    return { error: e?.message || 'Failed to update loan.' };
  }
}

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
