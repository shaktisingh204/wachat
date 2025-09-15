

import { notFound } from 'next/navigation';
import { getSiteBySlug } from '@/app/actions/portfolio.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { LayoutGrid } from 'lucide-react';
import { connectToDatabase } from '@/lib/mongodb';
import type { WebsitePage } from '@/lib/definitions';

export default async function WebsiteHomePage({ params }: { params: { slug: string } }) {
    if (!params.slug) {
        notFound();
    }

    const site = await getSiteBySlug(params.slug);

    if (!site) {
        notFound();
    }
    
    const { db } = await connectToDatabase();
    const homepage = await db.collection<WebsitePage>('website_pages').findOne({ siteId: site._id, isHomepage: true });

    const homepageLayout = homepage?.layout || [];
    
    return (
        <main>
            {homepageLayout.length > 0 ? (
                <Canvas
                    layout={homepageLayout}
                    products={[]}
                    shopSlug={site.slug}
                    isEditable={false}
                />
            ) : (
                <div className="text-center py-24 text-muted-foreground">
                    <LayoutGrid className="mx-auto h-12 w-12 text-muted-foreground/50"/>
                    <h1 className="mt-4 text-2xl font-semibold">{site.name}</h1>
                    <p className="mt-2 text-sm">This site is under construction. Come back soon!</p>
                </div>
            )}
        </main>
    );
}
