
import { WebsiteBuilder } from '@/components/wabasimplify/website-builder/website-builder';
import { getSiteById, getWebsitePages } from '@/app/actions/portfolio.actions';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/context/cart-context';

export const dynamic = 'force-dynamic';

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
        <CartProvider>
            <WebsiteBuilder shop={site as any} initialPages={pages} availableProducts={[]} />
        </CartProvider>
    );
}
