
import { getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WishlistPage(props: { params: Promise<{ slug: string }>}) {
    const params = await props.params;
    const shop = await getEcommShopBySlug(params.slug);
    if (!shop) {
        notFound();
    }

    const layout = shop.wishlistPageLayout || [];

    return (
        <main>
            <Canvas
                layout={layout}
                products={[]}
                shopSlug={shop.slug}
                isEditable={false}
            />
        </main>
    );
}
