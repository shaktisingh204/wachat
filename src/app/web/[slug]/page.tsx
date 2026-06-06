import { notFound } from 'next/navigation';
import { getSiteBySlug } from '@/app/actions/portfolio.actions';
import { Canvas } from '@/components/zoruui-domain/website-builder/canvas';
import { LayoutGrid, AlertCircle } from 'lucide-react';
import { connectToDatabase } from '@/lib/mongodb';
import type { WebsitePage } from '@/lib/definitions';
import { EmptyState, Alert, AlertTitle, AlertDescription } from '@/components/sabcrm/20ui/compat';

export const revalidate = 60; // Enable ISR caching

export default async function WebsiteHomePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    if (!slug) {
        notFound();
    }

    const site = await getSiteBySlug(slug);

    if (!site) {
        notFound();
    }

    let homepageLayout: any[] = [];
    let error: string | null = null;

    try {
        const { db } = await connectToDatabase();
        
        // Fetch all homepages for A/B testing (randomly select one)
        const homepages = await db.collection<WebsitePage>('website_pages')
            .find({ siteId: site._id, isHomepage: true })
            .toArray();

        if (homepages.length > 0) {
            const randomIndex = Math.floor(Math.random() * homepages.length);
            const homepage = homepages[randomIndex];
            homepageLayout = homepage?.layout || [];
        }
    } catch (e: any) {
        console.error("Database connection error in website homepage:", e);
        error = "Failed to load website content. Please try again later.";
    }

    return (
        <main className="min-h-screen w-full">
            {error ? (
                <div className="container mx-auto p-8 max-w-2xl mt-12">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Connection Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </div>
            ) : homepageLayout.length > 0 ? (
                <Canvas
                    layout={homepageLayout}
                    products={[]}
                    shopSlug={site.slug}
                    isEditable={false}
                />
            ) : (
                <div className="flex items-center justify-center min-h-[60vh] p-8">
                    <EmptyState
                        icon={<LayoutGrid />}
                        title={site.name}
                        description="This site is under construction. Come back soon!"
                    />
                </div>
            )}
        </main>
    );
}
