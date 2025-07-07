
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

export default function RedirectToNewDocs() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/facebook/custom-ecommerce');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full">
            <p>This page has moved. Redirecting...</p>
        </div>
    );
}
