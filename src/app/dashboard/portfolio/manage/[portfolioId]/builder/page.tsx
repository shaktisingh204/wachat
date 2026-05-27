export const dynamic = "force-dynamic";

import { getSiteById, getWebsitePages } from '@/app/actions/portfolio.actions';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/context/cart-context';
import nextDynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const WebsiteBuilder = nextDynamic(
    () => import('@/components/zoruui-domain/website-builder/website-builder').then((mod) => mod.WebsiteBuilder),
    {
        
        loading: () => (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zoru-ink-muted" />
            </div>
        )
    }
);

export default async function WebsiteBuilderPage(props: { params: Promise<{ portfolioId: string }> }) {
    const params = await props.params;
    const [site, pages] = await Promise.all([
        getSiteById(params.portfolioId),
        getWebsitePages(params.portfolioId),
    ]);

    if (!site) {
        notFound();
    }

    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zoru-ink-muted" />
            </div>
        }>
            <CartProvider>
                <WebsiteBuilder shop={site as any} initialPages={pages} availableProducts={[]} />
            </CartProvider>
        </Suspense>
    );
}
