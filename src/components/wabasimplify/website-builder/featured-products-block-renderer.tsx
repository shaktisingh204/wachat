

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { WithId, EcommProduct } from '@/lib/definitions';
import { ProductCard } from './product-card';
import { Button } from '@/components/ui/button';
import React from 'react';

export function FeaturedProductsBlockRenderer({ settings, products, shopSlug }: { settings: any, products: WithId<EcommProduct>[], shopSlug: string }) {
    const productIds = settings.productIds || [];
    let featuredProducts = products;
    
    if (productIds.length > 0) {
        featuredProducts = products.filter(p => productIds.includes(p._id.toString()));
    } else {
        // If no products are selected, show a few as placeholders
        featuredProducts = products.slice(0, settings.columns === '4' ? 4 : 3);
    }
    
    const gridCols = settings.columns === '4' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3';

    const layout = settings.layout || {};
    const style: React.CSSProperties = {
        width: layout.width || '100%',
        height: layout.height || 'auto',
        maxWidth: layout.maxWidth || undefined,
        minHeight: layout.minHeight || undefined,
        overflow: layout.overflow || 'visible',
    };

    return (
        <div style={style}>
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold">{settings.title || 'Featured Products'}</h2>
                <p className="text-muted-foreground">{settings.subtitle}</p>
            </div>
             <div className={cn("grid gap-6", gridCols)}>
                {featuredProducts.map(product => (
                    <ProductCard key={product._id.toString()} product={product} shopSlug={shopSlug} />
                ))}
            </div>
             {settings.showViewAllButton && (
                <div className="mt-8 text-center">
                    <Button variant="outline" size="lg">View All Products</Button>
                </div>
            )}
        </div>
    );
};
