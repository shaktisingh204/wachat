
'use client';

import { ProductForm } from '@/components/wabasimplify/product-form';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function NewProductPage() {
    const searchParams = useSearchParams();
    const catalogId = searchParams.get('catalogId');

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <Button variant="ghost" asChild className="-ml-4">
                    <Link href={`/dashboard/catalog/${catalogId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline mt-2">Add New Product</h1>
                <p className="text-muted-foreground">Fill in the details to add a new product to your catalog.</p>
            </div>
            <ProductForm />
        </div>
    );
}
