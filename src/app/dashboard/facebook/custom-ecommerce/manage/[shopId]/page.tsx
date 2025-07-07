
'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

export default function ShopManageIndexPage() {
    const router = useRouter();
    const params = useParams();
    const shopId = params.shopId as string;

    useEffect(() => {
        if (shopId) {
            router.replace(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/settings`);
        }
    }, [router, shopId]);

    // Render a loading state while redirecting
    return (
        <div className="flex items-center justify-center h-full p-8">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-4">Redirecting to shop settings...</p>
        </div>
    );
}
