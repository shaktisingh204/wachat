

import { notFound } from 'next/navigation';
import { getPortfolioBySlug } from '@/app/actions/portfolio.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { LayoutGrid } from 'lucide-react';
import { connectToDatabase } from '@/lib/mongodb';
import type { PortfolioPage } from '@/lib/definitions';

export default async function PortfolioHomePage({ params }: { params: { slug: string } }) {
    if (!params.slug) {
        notFound();
    }

    const portfolio = await getPortfolioBySlug(params.slug);

    if (!portfolio) {
        notFound();
    }
    
    const { db } = await connectToDatabase();
    const homepage = await db.collection<PortfolioPage>('portfolio_pages').findOne({ portfolioId: portfolio._id, isHomepage: true });

    const homepageLayout = homepage?.layout || [];
    
    return (
        <main>
            {homepageLayout.length > 0 ? (
                <Canvas
                    layout={homepageLayout}
                    products={[]}
                    shopSlug={portfolio.slug}
                    isEditable={false}
                />
            ) : (
                <div className="text-center py-24 text-muted-foreground">
                    <LayoutGrid className="mx-auto h-12 w-12 text-muted-foreground/50"/>
                    <h1 className="mt-4 text-2xl font-semibold">{portfolio.name}</h1>
                    <p className="mt-2 text-sm">This site is under construction. Come back soon!</p>
                </div>
            )}
        </main>
    );
}
