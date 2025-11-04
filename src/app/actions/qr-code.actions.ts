
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { QrCode, ShortUrl, QrCodeWithShortUrl } from '@/lib/definitions';
import { nanoid } from 'nanoid';

export async function createQrCode(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const name = formData.get('name') as string;
    const dataType = formData.get('dataType') as QrCode['dataType'];
    const data = JSON.parse(formData.get('data') as string);
    const config = JSON.parse(formData.get('config') as string);
    const tagIds = (formData.get('tagIds') as string)?.split(',').filter(Boolean) || [];
    const isDynamic = formData.get('isDynamic') === 'on';

    if (!name || !dataType || !data) {
        return { error: 'Name and data are required.' };
    }
    
    let shortUrlId: ObjectId | undefined = undefined;

    try {
        const { db } = await connectToDatabase();

        if (isDynamic && dataType === 'url') {
            const shortCode = nanoid(7);
            const newShortUrl: Omit<ShortUrl, '_id'> = {
                userId: new ObjectId(session.user._id),
                originalUrl: data.url,
                shortCode,
                clickCount: 0,
                analytics: [],
                tagIds,
                createdAt: new Date(),
            };
            const result = await db.collection('short_urls').insertOne(newShortUrl as any);
            shortUrlId = result.insertedId;
        }

        const newQrCode: Omit<QrCode, '_id'> = {
            userId: new ObjectId(session.user._id),
            name,
            dataType,
            data,
            config,
            tagIds,
            ...(shortUrlId && { shortUrlId }),
            createdAt: new Date(),
        };
        
        await db.collection('qr_codes').insertOne(newQrCode as any);

        revalidatePath('/dashboard/qr-code-maker');
        return { message: 'QR Code saved successfully!' };
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred.' };
    }
}


export async function getQrCodes(): Promise<QrCodeWithShortUrl[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const qrCodes = await db.collection('qr_codes').aggregate([
            { $match: { userId: new ObjectId(session.user._id) } },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: 'short_urls',
                    localField: 'shortUrlId',
                    foreignField: '_id',
                    as: 'shortUrl'
                }
            },
            {
                $unwind: {
                    path: '$shortUrl',
                    preserveNullAndEmptyArrays: true
                }
            }
        ]).toArray();
        
        return JSON.parse(JSON.stringify(qrCodes));
    } catch (e) {
        return [];
    }
}

export async function deleteQrCode(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const qrCode = await db.collection('qr_codes').findOne({ _id: new ObjectId(id), userId: new ObjectId(session.user._id) });
        if (!qrCode) {
            return { success: false, error: 'QR Code not found or access denied.' };
        }

        // If it's a dynamic QR code, delete the associated short URL as well
        if (qrCode.shortUrlId) {
            await db.collection('short_urls').deleteOne({ _id: qrCode.shortUrlId });
        }
        
        await db.collection('qr_codes').deleteOne({ _id: new ObjectId(id) });
        
        revalidatePath('/dashboard/qr-code-maker');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to delete QR code.' };
    }
}
