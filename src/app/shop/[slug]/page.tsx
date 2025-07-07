
import { notFound } from 'next/navigation';
import { getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';

export default async function ShopPage({ params }: { params: { slug: string } }) {
    if (!params.slug) {
        notFound();
    }

    const shop = await getEcommShopBySlug(params.slug);

    if (!shop) {
        notFound();
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-4xl font-bold">{shop.name}</h1>
            <p className="text-lg text-muted-foreground">Welcome to our shop!</p>
            <p className="mt-4 font-mono text-sm">Shop Slug: {shop.slug}</p>
            <p className="font-mono text-sm">Currency: {shop.currency}</p>
        </div>
    );
}
