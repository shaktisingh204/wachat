

'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import { createShortUrl } from './url-shortener.actions';
import type { QrCode, QrCodeWithShortUrl } from '@/lib/definitions';


export async function createQrCode(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        
        const isDynamic = formData.get('isDynamic') === 'on';
        const dataType = formData.get('dataType') as QrCode['dataType'];
        const tagIds = (formData.get('tagIds') as string)?.split(',').filter(Boolean) || [];

        let shortUrlId: ObjectId | undefined = undefined;

        if (isDynamic && dataType === 'url') {
            const urlData = JSON.parse(formData.get('data') as string);
            
            const shortUrlFormData = new FormData();
            shortUrlFormData.append('originalUrl', urlData.url);
            shortUrlFormData.append('tagIds', tagIds.join(','));
            
            const shortUrlResult = await createShortUrl({ message: null, error: null, shortUrlId: null }, shortUrlFormData);
            
            if (shortUrlResult.error || !shortUrlResult.shortUrlId) {
                return { error: `Failed to create dynamic link: ${shortUrlResult.error || 'Unknown error'}` };
            }
            shortUrlId = new ObjectId(shortUrlResult.shortUrlId);
        }

        let logoDataUri: string | undefined = undefined;
        const logoFile = formData.get('logoFile') as File;
        if (logoFile && logoFile.size > 0) {
            if (logoFile.size > 100 * 1024) { // 100KB limit
                return { error: 'Logo image must be under 100KB.' };
            }
            const buffer = Buffer.from(await logoFile.arrayBuffer());
            logoDataUri = `data:${logoFile.type};base64,${buffer.toString('base64')}`;
        }

        const newQrCode: Omit<QrCode, '_id'> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            dataType,
            data: JSON.parse(formData.get('data') as string),
            config: JSON.parse(formData.get('config') as string),
            tagIds,
            ...(shortUrlId && { shortUrlId }),
            ...(logoDataUri && { logoDataUri }),
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

export async function getQrCodes(): Promise<WithId<QrCodeWithShortUrl>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const codes = await db.collection('qrcodes').aggregate([
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
        const codeToDelete = await db.collection<QrCode>('qrcodes').findOne({ _id: new ObjectId(id) });
        
        if (!codeToDelete || codeToDelete.userId.toString() !== session.user._id.toString()) {
            return { success: false, error: 'QR Code not found or access denied.' };
        }
        
        // If it's a dynamic QR code, delete the associated short URL
        if (codeToDelete.shortUrlId) {
            await db.collection('short_urls').deleteOne({ _id: codeToDelete.shortUrlId });
        }

        await db.collection('qrcodes').deleteOne({ _id: new ObjectId(id) });
        revalidatePath('/dashboard/qr-code-maker');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
