

import { notFound } from 'next/navigation';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { connectToDatabase } from '@/lib/mongodb';
import { PortfolioPage } from '@/lib/definitions';
import { ObjectId } from 'mongodb';

async function getPageBySlug(portfolioSlug: string, pageSlug: string) {
    const { db } = await connectToDatabase();
    const portfolio = await db.collection('portfolios').findOne({ slug: portfolioSlug });
    if (!portfolio) return null;

    const page = await db.collection<PortfolioPage>('portfolio_pages').findOne({ portfolioId: portfolio._id, slug: pageSlug });
    return page;
}

export default async function PortfolioSubPage({ params }: { params: { slug: string, pageSlug: string } }) {
    if (!params.slug || !params.pageSlug) {
        notFound();
    }

    const page = await getPageBySlug(params.slug, params.pageSlug);
    if (!page) {
        notFound();
    }
    
    return (
        <main>
            <Canvas
                layout={page.layout}
                products={[]}
                shopSlug={params.slug}
                isEditable={false}
            />
        </main>
    );
}

// Optional: Improve SEO by generating static paths
export async function generateStaticParams() {
    try {
        const { db } = await connectToDatabase();
        const pages = await db.collection('portfolio_pages').find({ isHomepage: { $ne: true } }).toArray();
        const portfolios = await db.collection('portfolios').find({ _id: { $in: pages.map(p => p.portfolioId) } }).toArray();
        const portfolioMap = new Map(portfolios.map(p => [p._id.toString(), p.slug]));

        return pages.map(page => ({
            slug: portfolioMap.get(page.portfolioId.toString()),
            pageSlug: page.slug,
        }));
    } catch (e) {
        console.error("Failed to generate static params for portfolio pages:", e);
        return [];
    }
}
