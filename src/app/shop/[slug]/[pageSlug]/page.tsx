import { notFound } from 'next/navigation';
import { getPublicEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/20ui-domain/website-builder/canvas';
import { connectToDatabase } from '@/lib/mongodb';
import { EcommPage } from '@/lib/definitions';
import { ObjectId } from 'mongodb';
import { CartOverlay } from '@/components/20ui-domain/website-builder/cart-overlay';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
    try {
        const { db } = await connectToDatabase();
        const shops = await db.collection('ecomm_shops').find({}).toArray();

        const params: { slug: string; pageSlug: string }[] = [];
        for (const shop of shops) {
            if (!shop?.slug) continue;
            const pages = await db
                .collection<EcommPage>('ecomm_pages')
                .find({ shopId: shop._id, isPublished: true })
                .toArray();
            for (const page of pages) {
                if (!page?.slug) continue;
                params.push({ slug: shop.slug, pageSlug: page.slug });
            }
        }
        return params;
    } catch (e) {
        console.warn('[shop/[slug]/[pageSlug]] generateStaticParams skipped:', e);
        return [];
    }
}

async function getPageBySlug(shopSlug: string, pageSlug: string) {
    const { db } = await connectToDatabase();
    const shop = await db.collection('ecomm_shops').findOne({ slug: shopSlug });
    if (!shop) return null;

    const page = await db.collection<EcommPage>('ecomm_pages').findOne({ shopId: shop._id, slug: pageSlug });
    return page;
}

async function PageContent({ slug, pageSlug }: { slug: string, pageSlug: string }) {
    if (!slug || !pageSlug) {
        notFound();
    }

    const page = await getPageBySlug(slug, pageSlug);
    if (!page) {
        notFound();
    }

    const products = await getPublicEcommProducts(page.shopId.toString());

    return (
        <div className="relative min-h-screen">
            <Canvas
                layout={page.layout}
                products={products}
                shopSlug={slug}
                isEditable={false}
            />
            <CartOverlay shopSlug={slug} />
        </div>
    );
}

export default async function ShopSubPage(props: { params: Promise<{ slug: string, pageSlug: string }> }) {
    const params = await props.params;

    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading page...</div>}>
            <PageContent slug={params.slug} pageSlug={params.pageSlug} />
        </Suspense>
    );
}
