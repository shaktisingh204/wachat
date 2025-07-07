
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

export default function ShopManageIndexPage({ params }: { params: { shopId: string }}) {
    const router = useRouter();

    useEffect(() => {
        if (params.shopId) {
            router.replace(`/dashboard/facebook/custom-ecommerce/manage/${params.shopId}/settings`);
        }
    }, [router, params.shopId]);

    // Render a loading state while redirecting
    return (
        <div className="flex items-center justify-center h-full p-8">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-4">Redirecting to shop settings...</p>
        </div>
    );
}
