

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { WithId, EcommProduct } from '@/lib/definitions';
import { ProductCard } from './product-card';

export function FeaturedProductsBlockRenderer({ settings, products, shopSlug }: { settings: any, products: WithId<EcommProduct>[], shopSlug: string }) {
    const productIds = settings.productIds || [];
    let featuredProducts = products;
    if (productIds.length > 0) {
        featuredProducts = products.filter(p => productIds.includes(p._id.toString()));
    }
    
    const gridCols = settings.columns === '4' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3';

    return (
        <div>
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold">{settings.title || 'Featured Products'}</h2>
                <p className="text-muted-foreground">{settings.subtitle}</p>
            </div>
             <div className={cn("grid gap-6", gridCols)}>
                {featuredProducts.map(product => (
                    <ProductCard key={product._id.toString()} product={product} shopSlug={shopSlug} />
                ))}
            </div>
        </div>
    );
};
