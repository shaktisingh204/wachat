

import React from 'react';
import { getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/context/cart-context';
import { BlockRenderer } from '@/components/wabasimplify/website-builder/block-renderer';
import { getPublicEcommProducts } from '@/app/actions/custom-ecommerce.actions';

export default async function ShopLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: { slug: string };
}) {
    const shop = await getEcommShopBySlug(params.slug);
    if (!shop) {
        notFound();
    }
    
    // Fetch products once at the layout level if needed by header/footer
    const products = await getPublicEcommProducts(shop._id.toString());
    
    const globalFontFamily = shop.appearance?.fontFamily || 'Inter, sans-serif';
    
    return (
        <CartProvider>
            <div style={{ fontFamily: globalFontFamily, '--shop-primary-color': shop.appearance?.primaryColor || '#1877F2' } as React.CSSProperties}>
                {shop.headerLayout && shop.headerLayout.length > 0 && (
                     <header className="sticky top-0 z-40">
                        {shop.headerLayout.map(block => (
                            <BlockRenderer key={block.id} block={block} products={products} shopSlug={shop.slug} />
                        ))}
                    </header>
                )}
                <main>{children}</main>
                 {shop.footerLayout && shop.footerLayout.length > 0 && (
                     <footer>
                        {shop.footerLayout.map(block => (
                            <BlockRenderer key={block.id} block={block} products={products} shopSlug={shop.slug} />
                        ))}
                    </footer>
                )}
            </div>
        </CartProvider>
    );
}
