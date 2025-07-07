
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

export default function RedirectToNewBuilder() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/facebook/custom-ecommerce');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-4">Redirecting to the new Custom Shops dashboard...</p>
        </div>
    );
}
