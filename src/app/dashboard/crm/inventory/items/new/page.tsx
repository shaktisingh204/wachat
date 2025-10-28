
'use client';

import { CrmProductForm } from '@/components/wabasimplify/crm-product-form';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewCrmItemPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <Button variant="ghost" asChild className="-ml-4">
                    <Link href="/dashboard/crm/inventory/items">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Items
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline mt-2">Add New Item</h1>
                <p className="text-muted-foreground">Create a new product or service for your inventory.</p>
            </div>
            <CrmProductForm />
        </div>
    );
}
