
'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { CrmProductForm } from '@/components/wabasimplify/crm-product-form';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCrmProducts } from '@/app/actions/crm-products.actions';
import type { WithId, EcommProduct } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditCrmItemPage() {
    const params = useParams();
    const productId = params.productId as string;
    const [product, setProduct] = useState<WithId<EcommProduct> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (productId) {
            getCrmProducts().then(products => {
                const found = products.find(p => p._id.toString() === productId);
                if (found) {
                    setProduct(found);
                }
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [productId]);
    
    if (loading) {
        return <Skeleton className="h-96 w-full" />
    }

    if (!product) {
        notFound();
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <Button variant="ghost" asChild className="-ml-4">
                    <Link href="/dashboard/crm/inventory/items">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Items
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline mt-2">Edit Item: {product.name}</h1>
                <p className="text-muted-foreground">Modify the details for this product or service.</p>
            </div>
            <CrmProductForm product={product} />
        </div>
    );
}
