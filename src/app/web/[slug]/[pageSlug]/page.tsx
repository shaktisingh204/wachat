import { notFound } from 'next/navigation';
import { Canvas } from '@/components/20ui-domain/website-builder/canvas';
import { connectToDatabase } from '@/lib/mongodb';
import { WebsitePage } from '@/lib/definitions';
import { ObjectId } from 'mongodb';
import { Metadata } from 'next';
import { EmptyState } from '@/components/sabcrm/20ui';
import { Database } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui';
import Link from 'next/link';

async function getPageBySlug(siteSlug: string, pageSlug: string) {
    try {
        const { db } = await connectToDatabase();
        const site = await db.collection('sites').findOne({ slug: siteSlug });
        if (!site) return null;

        const page = await db.collection<WebsitePage>('website_pages').findOne({ siteId: site._id, slug: pageSlug });
        return page;
    } catch (e) {
        console.error("Database error in getPageBySlug:", e);
        throw new Error("DATABASE_UNREACHABLE");
    }
}

function extractTextFromLayout(layout: any[]): string {
    if (!layout || !Array.isArray(layout)) return '';
    let textParts: string[] = [];
    for (const block of layout) {
        if (block.settings) {
            if (typeof block.settings.text === 'string') {
                textParts.push(block.settings.text);
            }
            if (typeof block.settings.content === 'string') {
                const stripped = block.settings.content.replace(/<[^>]+>/g, ' ');
                textParts.push(stripped);
            }
            if (typeof block.settings.subheadingText === 'string') {
                textParts.push(block.settings.subheadingText);
            }
        }
        if (block.children && Array.isArray(block.children)) {
            const childText = extractTextFromLayout(block.children);
            if (childText) textParts.push(childText);
        }
    }
    return textParts.join(' ');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string, pageSlug: string }> }): Promise<Metadata> {
    try {
        const { slug, pageSlug } = await params;
        const page = await getPageBySlug(slug, pageSlug);

        if (!page) {
            return {
                title: 'Page Not Found',
                description: 'The page you are looking for does not exist.'
            };
        }

        const layoutText = extractTextFromLayout(page.layout).replace(/\s+/g, ' ').substring(0, 160).trim();

        return {
            title: page.name || `${slug} Page`,
            description: layoutText || `Explore ${page.name} on ${slug}`,
        };
    } catch (e) {
        return {
            title: 'Internal Error',
            description: 'An error occurred while loading this page.'
        };
    }
}

export default async function WebsiteSubPage({ params }: { params: Promise<{ slug: string, pageSlug: string }> }) {
    try {
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
    } catch (e) {
        if (e instanceof Error && e.message === "DATABASE_UNREACHABLE") {
            return (
                <div className="min-h-screen flex items-center justify-center p-4">
                    <EmptyState
                        icon={Database}
                        title="500 - Internal Server Error"
                        description="We're experiencing technical difficulties connecting to our database. Please try again later."
                        action={
                            <Link href="/">
                                <Button>Return Home</Button>
                            </Link>
                        }
                    />
                </div>
            );
        }
        throw e;
    }
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
