
'use server';

import { getSession } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { Portfolio, PortfolioPage, WebsiteBlock } from '@/lib/definitions';
import { ObjectId, WithId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

// --- Portfolio Actions ---

export async function getPortfolios(): Promise<WithId<Portfolio>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const portfolios = await db.collection<Portfolio>('portfolios')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(portfolios));
    } catch (e) {
        console.error("Failed to get portfolios:", e);
        return [];
    }
}

export async function getPortfolioById(portfolioId: string): Promise<WithId<Portfolio> | null> {
    if (!ObjectId.isValid(portfolioId)) return null;

    const { db } = await connectToDatabase();
    const portfolio = await db.collection<Portfolio>('portfolios').findOne({ _id: new ObjectId(portfolioId) });

    if (!portfolio) return null;
    
    // For public-facing pages, we don't check session
    const session = await getSession();
    if (session?.user._id.toString() !== portfolio.userId.toString()) {
        // This is a check for management, not public viewing
        // In a real app you might separate public/private fetches
    }

    return JSON.parse(JSON.stringify(portfolio));
}

export async function getPortfolioBySlug(slug: string): Promise<WithId<Portfolio> | null> {
    if (!slug) return null;

    try {
        const { db } = await connectToDatabase();
        const portfolio = await db.collection<Portfolio>('portfolios').findOne({ slug });
        if (!portfolio) return null;
        return JSON.parse(JSON.stringify(portfolio));
    } catch(e) {
        console.error("Failed to get portfolio by slug:", e);
        return null;
    }
}


export async function createPortfolio(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, portfolioId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    const name = formData.get('name') as string;
    if (!name) return { error: 'Portfolio Name is required.' };

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    try {
        const { db } = await connectToDatabase();
        
        const existingSlug = await db.collection('portfolios').findOne({ slug });
        if (existingSlug) {
            return { error: 'A portfolio with this name already exists, resulting in a duplicate URL slug. Please choose a different name.' };
        }

        const newPortfolio: Omit<Portfolio, '_id'> = {
            userId: new ObjectId(session.user._id),
            name,
            slug,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('portfolios').insertOne(newPortfolio as any);
        const portfolioId = result.insertedId;
        
        // Automatically create a default homepage for the new portfolio
        const homepage: Omit<PortfolioPage, '_id'> = {
            portfolioId,
            userId: new ObjectId(session.user._id),
            name: 'Home',
            slug: 'home',
            layout: [],
            isHomepage: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection('portfolio_pages').insertOne(homepage as any);
        
        revalidatePath('/dashboard/portfolio');
        return { message: `Portfolio "${name}" created successfully.`, portfolioId: portfolioId.toString() };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// --- Page Actions ---

export async function getPortfolioPages(portfolioId: string): Promise<WithId<PortfolioPage>[]> {
    if (!ObjectId.isValid(portfolioId)) return [];
    try {
        const { db } = await connectToDatabase();
        const pages = await db.collection<PortfolioPage>('portfolio_pages')
            .find({ portfolioId: new ObjectId(portfolioId) })
            .sort({ isHomepage: -1, name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(pages));
    } catch (e) {
        return [];
    }
}

export async function savePortfolioPage(data: {
    pageId?: string;
    portfolioId: string;
    name: string;
    slug: string;
    layout: WebsiteBlock[];
}): Promise<{ message?: string, error?: string, pageId?: string }> {
    const { pageId, portfolioId, name, slug, layout } = data;
    if (!portfolioId || !name || !slug) return { error: 'Portfolio ID, Page Name, and Slug are required.' };
    
    const portfolio = await getPortfolioById(portfolioId);
    if (!portfolio) return { error: 'Access denied' };
    
    const session = await getSession();
    if (session?.user._id.toString() !== portfolio.userId.toString()) {
        return { error: 'Access denied' };
    }
    
    const isNew = !pageId || pageId.startsWith('temp_');
    
    const pageData: Omit<PortfolioPage, '_id' | 'createdAt' | 'isHomepage'> = {
        name,
        slug,
        portfolioId: new ObjectId(portfolioId),
        userId: portfolio.userId,
        layout,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        
        if (isNew) {
            const result = await db.collection('portfolio_pages').insertOne({ ...pageData, createdAt: new Date() } as any);
            revalidatePath(`/dashboard/portfolio/manage/${portfolioId}/builder`);
            return { message: 'Page created successfully.', pageId: result.insertedId.toString() };
        } else {
            await db.collection('portfolio_pages').updateOne(
                { _id: new ObjectId(pageId) },
                { $set: pageData }
            );
            revalidatePath(`/dashboard/portfolio/manage/${portfolioId}/builder`);
            revalidatePath(`/portfolio/${portfolio.slug}/${slug}`);
            return { message: 'Page updated successfully.', pageId };
        }
    } catch (e: any) {
        return { error: 'Failed to save page.' };
    }
}

export async function deletePortfolioPage(pageId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(pageId)) return { error: 'Invalid Page ID.' };

    const { db } = await connectToDatabase();
    const page = await db.collection<PortfolioPage>('portfolio_pages').findOne({ _id: new ObjectId(pageId) });
    if (!page) return { error: 'Page not found.' };

    const portfolio = await getPortfolioById(page.portfolioId.toString());
    if (!portfolio) return { error: 'Access denied' };
    
    if (page.isHomepage) return { error: 'Cannot delete the homepage. Please set another page as the homepage first.' };

    try {
        await db.collection('portfolio_pages').deleteOne({ _id: new ObjectId(pageId) });
        revalidatePath(`/dashboard/portfolio/manage/${page.portfolioId}/builder`);
        return { message: 'Page deleted.' };
    } catch (e) {
        return { error: 'Failed to delete page.' };
    }
}

export async function setPortfolioAsHomepage(pageId: string, portfolioId: string): Promise<{ message?: string; error?: string }> {
     if (!ObjectId.isValid(pageId) || !ObjectId.isValid(portfolioId)) return { error: 'Invalid IDs.' };
     const portfolio = await getPortfolioById(portfolioId);
     if (!portfolio) return { error: 'Access denied' };

     try {
        const { db } = await connectToDatabase();
        
        // Unset any existing homepage for this portfolio
        await db.collection('portfolio_pages').updateMany(
            { portfolioId: new ObjectId(portfolioId), isHomepage: true },
            { $set: { isHomepage: false } }
        );
        
        // Set the new homepage
        await db.collection('portfolio_pages').updateOne(
            { _id: new ObjectId(pageId), portfolioId: new ObjectId(portfolioId) },
            { $set: { isHomepage: true } }
        );

        revalidatePath(`/dashboard/portfolio/manage/${portfolioId}/builder`);
        revalidatePath(`/portfolio/${portfolio.slug}`);
        return { message: 'Homepage updated.' };
     } catch(e) {
        return { error: 'Failed to set homepage.' };
     }
}
