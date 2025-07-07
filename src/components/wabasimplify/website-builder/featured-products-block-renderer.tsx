

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { WithId, EcommProduct } from '@/lib/definitions';

export function FeaturedProductsBlockRenderer({ settings, products, shopSlug }: { settings: any, products: WithId<EcommProduct>[], shopSlug: string }) {
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
                    <Link key={product._id.toString()} href={`/shop/${shopSlug}/product/${product._id.toString()}`} className="group">
                        <Card className="overflow-hidden transition-all group-hover:shadow-lg">
                            <CardHeader className="p-0">
                                <div className="relative aspect-square">
                                    <Image src={product.imageUrl || 'https://placehold.co/400x400.png'} alt={product.name} layout="fill" objectFit="cover" className="transition-transform group-hover:scale-105" data-ai-hint="product image"/>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <h3 className="font-semibold text-lg">{product.name}</h3>
                                <p className="text-muted-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price)}</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
};
