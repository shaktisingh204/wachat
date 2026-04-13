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
                const found = (products as any).find((p: any) => p._id.toString() === productId);
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
        return <Skeleton className="h-96 w-full rounded-clay-lg" />
    }

    if (!product) {
        notFound();
    }

    return (
        <div className="max-w-4xl mx-auto flex w-full flex-col gap-6">
            <div>
                <Button variant="ghost" asChild className="-ml-4 text-clay-ink-muted hover:text-clay-ink">
                    <Link href="/dashboard/crm/inventory/items">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Items
                    </Link>
                </Button>
                <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-clay-ink">Edit Item: {product.name}</h1>
                <p className="mt-1 text-[13px] text-clay-ink-muted">Modify the details for this product or service.</p>
            </div>
            <CrmProductForm product={product} />
        </div>
    );
}
