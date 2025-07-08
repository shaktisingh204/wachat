

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
    
    // Scoped theme for the shop
    const shopTheme = `
      .shop-theme {
        --background: 210 17% 98%;
        --foreground: 210 10% 23%;
        --card: 0 0% 100%;
        --card-foreground: 210 10% 23%;
        --popover: 0 0% 100%;
        --popover-foreground: 210 10% 23%;
        --primary: 217 91% 60%;
        --primary-foreground: 0 0% 100%;
        --secondary: 217 80% 55%;
        --secondary-foreground: 0 0% 100%;
        --muted: 210 40% 96.1%;
        --muted-foreground: 215.4 16.3% 46.9%;
        --accent: 210 40% 96.1%;
        --accent-foreground: 210 10% 23%;
        --border: 214.3 31.8% 91.4%;
        --input: 214.3 31.8% 91.4%;
        --ring: 217 91% 60%;
        --radius: 0.5rem;
      }
    `;

    return (
        <CartProvider>
            <style>{shopTheme}</style>
            <div className="shop-theme" style={{ fontFamily: globalFontFamily, '--shop-primary-color': shop.appearance?.primaryColor || '#1877F2' } as React.CSSProperties}>
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

    
