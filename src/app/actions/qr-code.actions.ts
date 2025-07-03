
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { QrCode } from '@/lib/definitions';

export async function createQrCode(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        
        const newQrCode: Omit<QrCode, '_id'> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            dataType: formData.get('dataType') as QrCode['dataType'],
            data: JSON.parse(formData.get('data') as string),
            config: JSON.parse(formData.get('config') as string),
            scanCount: 0,
            tagIds: (formData.get('tagIds') as string)?.split(',').filter(Boolean) || [],
            createdAt: new Date(),
        };

        if (!newQrCode.name) {
            return { error: 'A name for the QR code is required.' };
        }

        await db.collection('qrcodes').insertOne(newQrCode as any);

        revalidatePath('/dashboard/qr-code-maker');
        return { message: 'QR Code saved successfully!' };

    } catch (e: any) {
        console.error("Error creating QR code:", e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function getQrCodes(): Promise<WithId<QrCode>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const codes = await db.collection('qrcodes')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(codes));
    } catch (error) {
        console.error('Failed to fetch QR codes:', error);
        return [];
    }
}

export async function deleteQrCode(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) {
      return { success: false, error: 'Invalid QR Code ID.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const codeToDelete = await db.collection('qrcodes').findOne({ _id: new ObjectId(id) });
        if (!codeToDelete || codeToDelete.userId.toString() !== session.user._id.toString()) {
            return { success: false, error: 'QR Code not found or access denied.' };
        }

        await db.collection('qrcodes').deleteOne({ _id: new ObjectId(id) });
        revalidatePath('/dashboard/qr-code-maker');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
