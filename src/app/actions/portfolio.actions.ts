
'use server';

import { getSession } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { Website, WebsitePage, WebsiteBlock } from '@/lib/definitions';
import { ObjectId, WithId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

// --- Site Actions ---

export async function getSites(): Promise<WithId<Website>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const sites = await db.collection<Website>('sites')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(sites));
    } catch (e) {
        console.error("Failed to get sites:", e);
        return [];
    }
}

export async function getSiteById(siteId: string): Promise<WithId<Website> | null> {
    if (!ObjectId.isValid(siteId)) return null;

    const { db } = await connectToDatabase();
    const site = await db.collection<Website>('sites').findOne({ _id: new ObjectId(siteId) });

    if (!site) return null;
    
    const session = await getSession();
    if (session?.user._id.toString() !== site.userId.toString()) {
        // This is a check for management, not public viewing
    }

    return JSON.parse(JSON.stringify(site));
}

export async function getSiteBySlug(slug: string): Promise<WithId<Website> | null> {
    if (!slug) return null;

    try {
        const { db } = await connectToDatabase();
        const site = await db.collection<Website>('sites').findOne({ slug });
        if (!site) return null;
        return JSON.parse(JSON.stringify(site));
    } catch(e) {
        console.error("Failed to get site by slug:", e);
        return null;
    }
}


export async function createSite(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, siteId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    const name = formData.get('name') as string;
    if (!name) return { error: 'Site Name is required.' };

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    try {
        const { db } = await connectToDatabase();
        
        const existingSlug = await db.collection('sites').findOne({ slug });
        if (existingSlug) {
            return { error: 'A site with this name already exists, resulting in a duplicate URL slug. Please choose a different name.' };
        }

        const newSite: Omit<Website, '_id'> = {
            userId: new ObjectId(session.user._id),
            name,
            slug,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('sites').insertOne(newSite as any);
        const siteId = result.insertedId;
        
        const homepage: Omit<WebsitePage, '_id'> = {
            siteId,
            userId: new ObjectId(session.user._id),
            name: 'Home',
            slug: 'home',
            layout: [],
            isHomepage: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection('website_pages').insertOne(homepage as any);
        
        revalidatePath('/dashboard/website-builder');
        return { message: `Site "${name}" created successfully.`, siteId: siteId.toString() };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// --- Page Actions ---

export async function getWebsitePages(siteId: string): Promise<WithId<WebsitePage>[]> {
    if (!ObjectId.isValid(siteId)) return [];
    try {
        const { db } = await connectToDatabase();
        const pages = await db.collection<WebsitePage>('website_pages')
            .find({ siteId: new ObjectId(siteId) })
            .sort({ isHomepage: -1, name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(pages));
    } catch (e) {
        return [];
    }
}

export async function saveWebsitePage(data: {
    pageId?: string;
    siteId: string;
    name: string;
    slug: string;
    layout: WebsiteBlock[];
}): Promise<{ message?: string, error?: string, pageId?: string }> {
    const { pageId, siteId, name, slug, layout } = data;
    if (!siteId || !name || !slug) return { error: 'Site ID, Page Name, and Slug are required.' };
    
    const site = await getSiteById(siteId);
    if (!site) return { error: 'Access denied' };
    
    const session = await getSession();
    if (session?.user._id.toString() !== site.userId.toString()) {
        return { error: 'Access denied' };
    }
    
    const isNew = !pageId || pageId.startsWith('temp_');
    
    const pageData: Omit<WebsitePage, '_id' | 'createdAt' | 'isHomepage'> = {
        name,
        slug,
        siteId: new ObjectId(siteId),
        userId: site.userId,
        layout,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        
        if (isNew) {
            const result = await db.collection('website_pages').insertOne({ ...pageData, createdAt: new Date() } as any);
            revalidatePath(`/dashboard/website-builder/manage/${siteId}/builder`);
            return { message: 'Page created successfully.', pageId: result.insertedId.toString() };
        } else {
            await db.collection('website_pages').updateOne(
                { _id: new ObjectId(pageId) },
                { $set: pageData }
            );
            revalidatePath(`/dashboard/website-builder/manage/${siteId}/builder`);
            revalidatePath(`/web/${site.slug}/${slug}`);
            return { message: 'Page updated successfully.', pageId };
        }
    } catch (e: any) {
        return { error: 'Failed to save page.' };
    }
}

export async function deleteWebsitePage(pageId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(pageId)) return { error: 'Invalid Page ID.' };

    const { db } = await connectToDatabase();
    const page = await db.collection<WebsitePage>('website_pages').findOne({ _id: new ObjectId(pageId) });
    if (!page) return { error: 'Page not found.' };

    const site = await getSiteById(page.siteId.toString());
    if (!site) return { error: 'Access denied' };
    
    if (page.isHomepage) return { error: 'Cannot delete the homepage. Please set another page as the homepage first.' };

    try {
        await db.collection('website_pages').deleteOne({ _id: new ObjectId(pageId) });
        revalidatePath(`/dashboard/website-builder/manage/${page.siteId}/builder`);
        return { message: 'Page deleted.' };
    } catch (e) {
        return { error: 'Failed to delete page.' };
    }
}

export async function setAsHomepage(pageId: string, siteId: string): Promise<{ message?: string; error?: string }> {
     if (!ObjectId.isValid(pageId) || !ObjectId.isValid(siteId)) return { error: 'Invalid IDs.' };
     const site = await getSiteById(siteId);
     if (!site) return { error: 'Access denied' };

     try {
        const { db } = await connectToDatabase();
        
        await db.collection('website_pages').updateMany(
            { siteId: new ObjectId(siteId), isHomepage: true },
            { $set: { isHomepage: false } }
        );
        
        await db.collection('website_pages').updateOne(
            { _id: new ObjectId(pageId), siteId: new ObjectId(siteId) },
            { $set: { isHomepage: true } }
        );

        revalidatePath(`/dashboard/website-builder/manage/${siteId}/builder`);
        revalidatePath(`/web/${site.slug}`);
        return { message: 'Homepage updated.' };
     } catch(e) {
        return { error: 'Failed to set homepage.' };
     }
}
