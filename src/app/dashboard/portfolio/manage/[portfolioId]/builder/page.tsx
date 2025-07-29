

import { WebsiteBuilder } from '@/components/wabasimplify/website-builder/website-builder';
import { getPortfolioById, getPortfolioPages } from '@/app/actions/portfolio.actions';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/context/cart-context';

export const dynamic = 'force-dynamic';

export default async function PortfolioBuilderPage({ params }: { params: { portfolioId: string } }) {
    const [portfolio, pages] = await Promise.all([
        getPortfolioById(params.portfolioId),
        getPortfolioPages(params.portfolioId),
    ]);

    if (!portfolio) {
        notFound();
    }

    return (
        <CartProvider>
            <WebsiteBuilder shop={portfolio as any} initialPages={pages} availableProducts={[]} />
        </CartProvider>
    );
}
