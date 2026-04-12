'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmDebitNote } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

async function getNextDebitNoteNumber(db: Db, userId: ObjectId): Promise<string> {
    const lastNote = await db.collection<CrmDebitNote>('crm_debit_notes')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

    if (lastNote.length === 0) {
        return 'DN-00001';
    }

    const lastNumber = lastNote[0].noteNumber;
    const matches = lastNumber.match(/^(.*?)(\d+)$/);

    if (matches && matches.length === 3) {
        const prefix = matches[1];
        const numPart = parseInt(matches[2], 10);
        const newNum = numPart + 1;
        const paddedNum = String(newNum).padStart(matches[2].length, '0');
        return `${prefix}${paddedNum}`;
    }

    return `DN-${Date.now().toString().slice(-5)}`;
}


export async function getDebitNotes(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ notes: WithId<CrmDebitNote>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { notes: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };

        const skip = (page - 1) * limit;

        const [notes, total] = await Promise.all([
            db.collection('crm_debit_notes')
                .find(filter as any)
                .sort({ noteDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_debit_notes').countDocuments(filter as any)
        ]);

        return {
            notes: JSON.parse(JSON.stringify(notes)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM debit notes:", e);
        return { notes: [], total: 0 };
    }
}

export async function saveDebitNote(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        let noteNumber = formData.get('noteNumber') as string;
        if (!noteNumber) {
            noteNumber = await getNextDebitNoteNumber(db, userObjectId);
        }

        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const total = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const noteData: Omit<CrmDebitNote, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            vendorId: new ObjectId(formData.get('vendorId') as string),
            noteNumber: noteNumber,
            noteDate: new Date(formData.get('noteDate') as string),
            currency: formData.get('currency') as string,
            lineItems: lineItems,
            total,
            reason: formData.get('reason') as string,
            notes: formData.get('notes') as string,
            status: 'Draft',
        };

        if (!noteData.noteNumber || !noteData.vendorId) {
            return { error: 'Note number and vendor are required.' };
        }

        const existing = await db.collection('crm_debit_notes').findOne({ userId: userObjectId, noteNumber: noteData.noteNumber });
        if (existing) {
            noteData.noteNumber = await getNextDebitNoteNumber(db, userObjectId);
        }

        await db.collection('crm_debit_notes').insertOne({
            ...noteData,
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        revalidatePath('/dashboard/crm/purchases/debit-notes');
        return { message: 'Debit note saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}


export async function deleteDebitNote(noteId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(noteId)) return { success: false, error: 'Invalid ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_debit_notes').deleteOne({
            _id: new ObjectId(noteId),
            userId: new ObjectId(session.user._id)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Note not found or permission denied.' };
        }

        revalidatePath('/dashboard/crm/purchases/debit-notes');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
