
import { getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: { slug: string }}) {
    const shop = await getEcommShopBySlug(params.slug);
    if (!shop) {
        notFound();
    }
    
    const layout = shop.profilePageLayout || [];
    
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
