
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { ShortUrl } from '@/lib/definitions';
import { nanoid } from 'nanoid';

const generateShortCode = (length = 7) => nanoid(length);

export async function createShortUrl(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const originalUrl = formData.get('originalUrl') as string;
    const alias = formData.get('alias') as string | null;

    if (!projectId || !originalUrl) {
        return { error: 'Project ID and Original URL are required.' };
    }

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        
        if (alias) {
            const existing = await db.collection('short_urls').findOne({ alias, projectId: new ObjectId(projectId) });
            if (existing) {
                return { error: 'This custom alias is already in use.' };
            }
        }

        const shortCode = alias || generateShortCode();

        const newShortUrl: Omit<ShortUrl, '_id'> = {
            projectId: new ObjectId(projectId),
            originalUrl,
            shortCode,
            ...(alias && { alias }),
            clickCount: 0,
            analytics: [],
            createdAt: new Date(),
        };

        await db.collection('short_urls').insertOne(newShortUrl as any);

        revalidatePath('/dashboard/url-shortener');
        return { message: 'Short URL created successfully!' };

    } catch (e: any) {
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
