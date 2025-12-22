
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, notFound } from 'next/navigation';
import { ProductForm } from '@/components/wabasimplify/product-form';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getProductsForCatalog } from '@/app/actions/catalog.actions';
import { useProject } from '@/context/project-context';
import type { WithId } from 'mongodb';
import type { Product } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditProductPage() {
    const params = useParams();
    const { activeProjectId } = useProject();
    const productId = params.productId as string;
    const catalogId = params.catalogId as string;
    
    const [product, setProduct] = useState<WithId<Product> | null>(null);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        if (productId && activeProjectId) {
            startLoading(async () => {
                const products = await getProductsForCatalog(catalogId, activeProjectId);
                const found = products.find(p => p.id === productId);
                if (found) {
                    setProduct(found as any);
                }
            });
        }
    }, [productId, catalogId, activeProjectId]);
    
    if (isLoading || !product) {
        return <Skeleton className="h-96 w-full" />;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <Button variant="ghost" asChild className="-ml-4">
                    <Link href={`/dashboard/catalog/${catalogId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline mt-2">Edit Product: {product.name}</h1>
                <p className="text-muted-foreground">Modify the details for this product.</p>
            </div>
            <ProductForm product={product} />
        </div>
    );
}
