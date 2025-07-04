

'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { ShortUrl, User, CustomDomain } from '@/lib/definitions';
import { nanoid } from 'nanoid';
import { headers } from 'next/headers';
import { Readable } from 'stream';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const generateShortCode = (length = 7) => nanoid(length);

export async function createShortUrl(prevState: any, formData: FormData): Promise<{ message?: string; error?: string, shortUrlId?: string }> {
    const originalUrl = formData.get('originalUrl') as string;
    const alias = formData.get('alias') as string | null;
    const tagIds = (formData.get('tagIds') as string)?.split(',').filter(Boolean) || [];
    const expiresAtStr = formData.get('expiresAt') as string | null;
    let domainId = formData.get('domainId') as string | null;
    if (domainId === 'none') {
        domainId = null;
    }


    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    if (!originalUrl) {
        return { error: 'Original URL is required.' };
    }

    try {
        new URL(originalUrl);
    } catch (_) {
        return { error: 'Invalid Original URL format.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        let shortCode = alias || generateShortCode();

        const query: any = { shortCode };
        if (domainId) {
            query.domainId = domainId;
        } else {
            query.userId = new ObjectId(session.user._id); // legacy links tied to user
        }

        const existing = await db.collection('short_urls').findOne(query);
        if (existing) {
            return { error: 'This custom alias is already in use for this domain.' };
        }

        const newShortUrl: Omit<ShortUrl, '_id'> = {
            userId: new ObjectId(session.user._id),
            originalUrl,
            shortCode,
            clickCount: 0,
            analytics: [],
            tagIds,
            ...(domainId && { domainId }),
            createdAt: new Date(),
            ...(expiresAtStr && { expiresAt: new Date(expiresAtStr) }),
        };

        const result = await db.collection('short_urls').insertOne(newShortUrl as any);
        const insertedId = result.insertedId;

        revalidatePath('/dashboard/url-shortener');
        return { message: 'Short URL created successfully!', shortUrlId: insertedId.toString() };

    } catch (e: any) {
        if (e.code === 11000) { 
            return { error: 'That short code is already taken, please try again.' };
        }
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

async function processUrlStream(inputStream: NodeJS.ReadableStream | string, userId: ObjectId): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const urlRows: { url: string; alias?: string }[] = [];
        
        Papa.parse(inputStream, {
            header: true,
            skipEmptyLines: true,
            step: (results) => {
                urlRows.push(results.data as { url: string; alias?: string });
            },
            complete: async () => {
                if (urlRows.length === 0) {
                    return resolve(0);
                }

                const urlColumnHeader = Object.keys(urlRows[0])[0];
                const aliasColumnHeader = Object.keys(urlRows[0])[1];

                const urlsToInsert = urlRows.map(row => {
                    const originalUrl = (row[urlColumnHeader as keyof typeof row] || '').trim();
                    if (!originalUrl) return null;

                    try { new URL(originalUrl); } catch { return null; }

                    const alias = (row[aliasColumnHeader as keyof typeof row] || '').trim() || null;
                    
                    return {
                        userId,
                        originalUrl,
                        shortCode: alias || generateShortCode(),
                        clickCount: 0,
                        analytics: [],
                        createdAt: new Date(),
                    };
                }).filter(Boolean);

                if (urlsToInsert.length === 0) {
                    return resolve(0);
                }

                const { db } = await connectToDatabase();
                try {
                    const result = await db.collection('short_urls').insertMany(urlsToInsert as any[], { ordered: false });
                    resolve(result.insertedCount);
                } catch(e: any) {
                    if (e.code === 11000) {
                        resolve(e.result.nInserted || 0);
                    } else {
                        reject(e);
                    }
                }
            },
            error: (error) => reject(error)
        });
    });
};

export async function handleBulkCreateShortUrls(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const urlFile = formData.get('urlFile') as File;
    
    const session = await getSession();
    if (!session?.user) return { error: "Access denied." };

    if (!urlFile || urlFile.size === 0) {
        return { error: 'A file is required.' };
    }

    try {
        let createdCount = 0;
        if (urlFile.name.endsWith('.csv')) {
            const nodeStream = Readable.fromWeb(urlFile.stream() as any);
            createdCount = await processUrlStream(nodeStream, new ObjectId(session.user._id));
        } else if (urlFile.name.endsWith('.xlsx')) {
            const fileBuffer = Buffer.from(await urlFile.arrayBuffer());
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) throw new Error('The XLSX file contains no sheets.');
            const worksheet = workbook.Sheets[sheetName];
            const csvData = XLSX.utils.sheet_to_csv(worksheet);
            createdCount = await processUrlStream(csvData, new ObjectId(session.user._id));
        } else {
            return { error: 'Unsupported file type. Please upload a .csv or .xlsx file.' };
        }

        if (createdCount === 0) {
            return { error: 'No valid URLs found in the file to import.' };
        }

        revalidatePath('/dashboard/url-shortener');
        return { message: `Successfully imported and created ${createdCount} short URL(s).` };
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred during bulk import.' };
    }
}


export async function getShortUrls(): Promise<{ user: (Omit<User, 'password'> & { _id: string }) | null; urls: WithId<ShortUrl>[]; domains: WithId<CustomDomain>[] }> {
    const session = await getSession();
    if (!session?.user) return { user: null, urls: [], domains: [] };

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) }, { projection: { password: 0 }});
        
        if (!user) return { user: null, urls: [], domains: [] };
        
        const urls = await db.collection('short_urls')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();

        return { 
            user: JSON.parse(JSON.stringify(user)),
            urls: JSON.parse(JSON.stringify(urls)),
            domains: JSON.parse(JSON.stringify(user?.customDomains || [])),
        };
    } catch (error) {
        console.error('Failed to fetch short URLs:', error);
        return { user: session.user as any, urls: [], domains: [] };
    }
}

export async function trackClickAndGetUrl(shortCode: string): Promise<{ originalUrl: string | null; error?: string }> {
    try {
        const { db } = await connectToDatabase();
        
        // This simplified logic assumes the default domain. Custom domain routing would need middleware.
        const urlDoc = await db.collection<ShortUrl>('short_urls').findOne({ shortCode, domainId: { $exists: false } });

        if (!urlDoc) {
             return { originalUrl: null, error: 'URL not found.' };
        }
        if (urlDoc.expiresAt && new Date() > new Date(urlDoc.expiresAt)) {
             return { originalUrl: null, error: 'This link has expired.' };
        }
        
        const headerList = headers();
        const userAgent = headerList.get('user-agent');
        const referrer = headerList.get('referer');
        const ip = headerList.get('x-forwarded-for') || headerList.get('x-real-ip');

        await db.collection<ShortUrl>('short_urls').updateOne(
            { _id: urlDoc._id },
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
            }
        );

        return { originalUrl: urlDoc.originalUrl };

    } catch (e: any) {
        console.error('Error tracking click:', e);
        return { originalUrl: null, error: 'Database error.' };
    }
}

export async function deleteShortUrl(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) {
      return { success: false, error: 'Invalid URL ID.' };
    }
    
    const urlToDelete = await getShortUrlById(id);
    if (!urlToDelete) return { success: false, error: 'URL not found or access denied.' };
    if (urlToDelete.userId.toString() !== session.user._id.toString()) {
        return { success: false, error: 'Access denied.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('short_urls').deleteOne({ _id: new ObjectId(id) });
        revalidatePath('/dashboard/url-shortener');
        revalidatePath(`/dashboard/url-shortener/${id}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'An unexpected error occurred.' };
    }
}

export async function getShortUrlById(id: string): Promise<WithId<ShortUrl> | null> {
    if (!ObjectId.isValid(id)) return null;
    
    const session = await getSession();
    if (!session?.user) return null;

    const { db } = await connectToDatabase();
    const url = await db.collection<ShortUrl>('short_urls').findOne({ 
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id) 
    });

    if (!url) return null;
    return JSON.parse(JSON.stringify(url));
}


// --- Custom Domain Actions ---

export async function getCustomDomains(): Promise<WithId<CustomDomain>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });
        return JSON.parse(JSON.stringify(user?.customDomains || []));
    } catch (error) {
        console.error('Failed to fetch custom domains:', error);
        return [];
    }
}

export async function addCustomDomain(prevState: any, formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const hostname = formData.get('hostname') as string;
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!hostname) return { error: 'Hostname is required.' };
    
    // Basic validation
    const domainRegex = /^(?!-)[A-Za-z0-9-]+([\-\.]{1}[a-z0-9]+)*\.[A-Za-z]{2,6}$/;
    if(!domainRegex.test(hostname)) {
        return { error: 'Invalid domain format.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        if (user?.customDomains?.some(d => d.hostname === hostname)) {
            return { error: 'This domain has already been added.' };
        }

        const newDomain: CustomDomain = {
            _id: new ObjectId(),
            hostname,
            verified: false,
            verificationCode: `sabnode-verify=${nanoid(16)}`,
        };

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $push: { customDomains: newDomain } }
        );

        revalidatePath('/dashboard/url-shortener/settings');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function verifyCustomDomain(domainId: string): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    
    // In a real application, this would perform a DNS lookup for the verification code.
    // For this prototype, we'll just simulate success.
    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id), 'customDomains._id': new ObjectId(domainId) },
            { $set: { 'customDomains.$.verified': true } }
        );
        revalidatePath('/dashboard/url-shortener/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to verify domain.' };
    }
}

export async function deleteCustomDomain(domainId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { customDomains: { _id: new ObjectId(domainId) } } }
        );
        revalidatePath('/dashboard/url-shortener/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to delete domain.' };
    }
}
