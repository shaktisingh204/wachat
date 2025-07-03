
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { ShortUrl } from '@/lib/definitions';
import { nanoid } from 'nanoid';
import { headers } from 'next/headers';

const generateShortCode = (length = 7) => nanoid(length);

export async function createShortUrl(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const originalUrl = formData.get('originalUrl') as string;
    const alias = formData.get('alias') as string | null;

    if (!projectId || !originalUrl) {
        return { error: 'Project ID and Original URL are required.' };
    }

    // Basic URL validation
    try {
        new URL(originalUrl);
    } catch (_) {
        return { error: 'Invalid Original URL format.' };
    }

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        
        let shortCode = alias || generateShortCode();

        if (alias) {
            const existing = await db.collection('short_urls').findOne({ shortCode, projectId: new ObjectId(projectId) });
            if (existing) {
                return { error: 'This custom alias is already in use.' };
            }
        }

        const newShortUrl: Omit<ShortUrl, '_id'> = {
            projectId: new ObjectId(projectId),
            originalUrl,
            shortCode,
            clickCount: 0,
            analytics: [],
            createdAt: new Date(),
        };

        await db.collection('short_urls').insertOne(newShortUrl as any);

        revalidatePath('/dashboard/url-shortener');
        return { message: 'Short URL created successfully!' };

    } catch (e: any) {
        if (e.code === 11000) { // Handle rare nanoid collision
            return { error: 'That short code is already taken, please try again.' };
        }
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function getShortUrls(projectId: string): Promise<WithId<ShortUrl>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const urls = await db.collection('short_urls')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(urls));
    } catch (error) {
        console.error('Failed to fetch short URLs:', error);
        return [];
    }
}

export async function trackClickAndGetUrl(shortCode: string): Promise<{ originalUrl: string | null; error?: string }> {
    try {
        const { db } = await connectToDatabase();
        
        const headerList = headers();
        const userAgent = headerList.get('user-agent');
        const referrer = headerList.get('referer');
        const ip = headerList.get('x-forwarded-for') || headerList.get('x-real-ip');

        const updateResult = await db.collection<ShortUrl>('short_urls').findOneAndUpdate(
            { shortCode },
            { 
                $inc: { clickCount: 1 },
                $push: { 
                    analytics: {
                        $each: [{
                            timestamp: new Date(),
                            ...(userAgent && { userAgent }),
                            ...(referrer && { referrer }),
                            ...(ip && { ip }),
                        }],
                        $slice: -100 // Keep only the last 100 clicks for analytics
                    }
                }
            },
            {
                returnDocument: 'after',
                projection: { originalUrl: 1 }
            }
        );

        if (updateResult) {
            return { originalUrl: updateResult.originalUrl };
        } else {
            return { originalUrl: null, error: 'URL not found.' };
        }
    } catch (e: any) {
        console.error('Error tracking click:', e);
        return { originalUrl: null, error: 'Database error.' };
    }
}

export async function deleteShortUrl(id: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(id)) {
      return { success: false, error: 'Invalid URL ID.' };
    }
    
    const urlToDelete = await getShortUrlById(id);
    if (!urlToDelete) return { success: false, error: 'URL not found or access denied.' };
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('short_urls').deleteOne({ _id: new ObjectId(id) });
        revalidatePath('/dashboard/url-shortener');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'An unexpected error occurred.' };
    }
}

async function getShortUrlById(id: string): Promise<WithId<ShortUrl> | null> {
    const { db } = await connectToDatabase();
    const url = await db.collection<ShortUrl>('short_urls').findOne({ _id: new ObjectId(id) });
    if (!url) return null;

    const hasAccess = await getProjectById(url.projectId.toString());
    if (!hasAccess) return null;

    return url;
}
