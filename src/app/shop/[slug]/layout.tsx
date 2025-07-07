

import React from 'react';
import { getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/context/cart-context';
import { ShopHeader } from '@/components/wabasimplify/website-builder/shop-header';

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
    
    const globalFontFamily = shop.appearance?.fontFamily || 'Inter, sans-serif';
    const primaryColor = shop.appearance?.primaryColor || '#000000';

    return (
        <CartProvider>
            <div style={{ fontFamily: globalFontFamily, '--shop-primary-color': primaryColor } as React.CSSProperties}>
                <ShopHeader shopName={shop.name} />
                <main>{children}</main>
                {/* You can add a shared footer here */}
            </div>
        </CartProvider>
    );
}
