
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { WithId, EcommProduct } from '@/lib/definitions';

export function FeaturedProductsBlockRenderer({ settings, products }: { settings: any, products: WithId<EcommProduct>[] }) {
    const productIds = settings.productIds || [];
    const featuredProducts = products.filter(p => productIds.includes(p._id.toString()));
    const gridCols = settings.columns === '4' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3';

    return (
        <div>
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold">{settings.title || 'Featured Products'}</h2>
                <p className="text-muted-foreground">{settings.subtitle}</p>
            </div>
             <div className={cn("grid gap-6", gridCols)}>
                {featuredProducts.map(product => (
                    <Card key={product._id.toString()}>
                        <CardHeader className="p-0">
                            <div className="relative aspect-square">
                                <Image src={product.imageUrl || 'https://placehold.co/400x400.png'} alt={product.name} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint="product image"/>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-lg">{product.name}</h3>
                            <p className="text-muted-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price)}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
