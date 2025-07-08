
import { notFound } from 'next/navigation';
import { getPublicEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { connectToDatabase } from '@/lib/mongodb';
import { EcommPage } from '@/lib/definitions';
import { ObjectId } from 'mongodb';

async function getPageBySlug(shopSlug: string, pageSlug: string) {
    const { db } = await connectToDatabase();
    const shop = await db.collection('ecomm_shops').findOne({ slug: shopSlug });
    if (!shop) return null;

    const page = await db.collection<EcommPage>('ecomm_pages').findOne({ shopId: shop._id, slug: pageSlug });
    return page;
}

export default async function ShopSubPage({ params }: { params: { slug: string, pageSlug: string } }) {
    if (!params.slug || !params.pageSlug) {
        notFound();
    }

    const page = await getPageBySlug(params.slug, params.pageSlug);
    if (!page) {
        notFound();
    }
    
    const products = await getPublicEcommProducts(page.shopId.toString());
    
    return (
        <main>
            <Canvas
                layout={page.layout}
                products={products}
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
        const pages = await db.collection('ecomm_pages').find({ isHomepage: { $ne: true } }).toArray();
        const shops = await db.collection('ecomm_shops').find({ _id: { $in: pages.map(p => p.shopId) } }).toArray();
        const shopMap = new Map(shops.map(s => [s._id.toString(), s.slug]));

        return pages.map(page => ({
            slug: shopMap.get(page.shopId.toString()),
            pageSlug: page.slug,
        }));
    } catch (e) {
        console.error("Failed to generate static params for shop pages:", e);
        return [];
    }
}
