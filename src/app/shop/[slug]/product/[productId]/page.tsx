
'use client';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getPublicEcommProductById } from '@/app/actions/custom-ecommerce.actions';
import { AddToCartButton } from '@/components/wabasimplify/website-builder/add-to-cart-button';
import { Badge } from '@/components/ui/badge';
import { Suspense, useEffect, useState } from 'react';
import type { WithId, EcommProduct } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';

function ProductPageContent({ productId }: { productId: string }) {
    const [product, setProduct] = useState<WithId<EcommProduct> | null>(null);

    useEffect(() => {
        getPublicEcommProductById(productId).then(data => {
            if (!data) {
                notFound();
            }
            setProduct(data);
        });
    }, [productId]);

    if (!product) {
        return (
            <div className="grid md:grid-cols-2 gap-8">
                <Skeleton className="aspect-square" />
                <div className="space-y-6">
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-8 w-1/4" />
                    <Skeleton className="h-4 w-1/5" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-12 w-1/2" />
                </div>
            </div>
        )
    }

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <div>
                <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                    <Image
                        src={product.imageUrl || 'https://placehold.co/600x600.png'}
                        alt={product.name}
                        layout="fill"
                        objectFit="cover"
                        data-ai-hint="product image"
                    />
                </div>
            </div>
            <div className="space-y-6">
                <h1 className="text-4xl font-bold">{product.name}</h1>
                <p className="text-3xl text-primary">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(product.price)}</p>
                
                {product.stock && product.stock > 0 ? (
                    <Badge variant="default">In Stock</Badge>
                ) : (
                    <Badge variant="destructive">Out of stock</Badge>
                )}

                <div className="prose dark:prose-invert">
                    <p>{product.description}</p>
                </div>

                <AddToCartButton product={product} />

            </div>
        </div>
    );
}

export default function ProductDetailPage({ params }: { params: { productId: string }}) {
    return (
        <div className="container mx-auto px-4 py-8">
            <Suspense fallback={<ProductPageContent productId={params.productId} />}>
                <ProductPageContent productId={params.productId} />
            </Suspense>
        </div>
    );
}
