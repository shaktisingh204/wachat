import { notFound } from 'next/navigation';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { connectToDatabase } from '@/lib/mongodb';
import { WebsitePage } from '@/lib/definitions';
import { ObjectId } from 'mongodb';

async function getPageBySlug(siteSlug: string, pageSlug: string) {
    const { db } = await connectToDatabase();
    const site = await db.collection('sites').findOne({ slug: siteSlug });
    if (!site) return null;

    const page = await db.collection<WebsitePage>('website_pages').findOne({ siteId: site._id, slug: pageSlug });
    return page;
}

export default async function WebsiteSubPage({ params }: { params: Promise<{ slug: string, pageSlug: string }> }) {
    const { slug, pageSlug } = await params;
    if (!slug || !pageSlug) {
        notFound();
    }

    const page = await getPageBySlug(slug, pageSlug);
    if (!page) {
        notFound();
    }

    return (
        <main className="min-h-screen w-full">
            <Canvas
                layout={page.layout}
                products={[]}
                shopSlug={slug}
                isEditable={false}
            />
        </main>
    );
}

// Optional: Improve SEO by generating static params
export async function generateStaticParams() {
    try {
        const { db } = await connectToDatabase();
        const pages = await db.collection('website_pages').find({ isHomepage: { $ne: true } }).toArray();
        const sites = await db.collection('sites').find({ _id: { $in: pages.map(p => p.siteId) } }).toArray();
        const siteMap = new Map(sites.map(p => [p._id.toString(), p.slug]));

        return pages.map(page => ({
            slug: siteMap.get(page.siteId.toString()),
            pageSlug: page.slug,
        }));
    } catch (e) {
        console.error("Failed to generate static params for site pages:", e);
        return [];
    }
}
