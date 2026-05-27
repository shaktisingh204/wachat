import { notFound } from 'next/navigation';
import { getEcommShopBySlug, getPublicEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/zoruui-domain/website-builder/canvas';
import { LayoutGrid } from 'lucide-react';
import { connectToDatabase } from '@/lib/mongodb';
import type { EcommPage } from '@/lib/definitions';
import { Suspense } from 'react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
    { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
    const { slug } = await params;
    const shop = await getEcommShopBySlug(slug);
    if (!shop) return { title: 'Shop Not Found' };
    
    return {
        title: shop.name,
        description: `Welcome to ${shop.name}`,
    };
}

async function ShopContent({ slug }: { slug: string }) {
    if (!slug) {
        notFound();
    }

    const shop = await getEcommShopBySlug(slug);
    if (!shop) {
        notFound();
    }

    const { db } = await connectToDatabase();
    const homepage = await db.collection<EcommPage>('ecomm_pages').findOne({ shopId: shop._id, isHomepage: true });

    const products = await getPublicEcommProducts(shop._id.toString());
    const homepageLayout = homepage?.layout || [];

    return (
        <main>
            {homepageLayout.length > 0 ? (
                <Canvas
                    layout={homepageLayout}
                    products={products}
                    shopSlug={shop.slug}
                    isEditable={false}
                />
            ) : (
                <div className="text-center py-24 text-zoru-ink-muted">
                    <LayoutGrid className="mx-auto h-12 w-12 text-zoru-ink-muted/50"/>
                    <h1 className="mt-4 text-2xl font-semibold">{shop.name}</h1>
                    <p className="mt-2 text-sm">This shop is under construction. Come back soon!</p>
                </div>
            )}
        </main>
    );
}

export default async function ShopPage(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;

    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading shop...</div>}>
            <ShopContent slug={params.slug} />
        </Suspense>
    );
}
