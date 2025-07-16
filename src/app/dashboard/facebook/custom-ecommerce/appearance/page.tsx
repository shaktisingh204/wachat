
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page is now deprecated. It's being replaced by the shop-specific version.
// This component will redirect users to the new location to avoid confusion.
export default function DeprecatedAppearancePage() {
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
