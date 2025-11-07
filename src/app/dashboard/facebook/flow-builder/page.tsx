
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page is now deprecated. It's being replaced by the e-commerce version.
// Redirect users to the new location to avoid confusion.
export default function DeprecatedFacebookFlowBuilderPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/facebook/custom-ecommerce');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full">
            <p>This page has moved to the Custom E-commerce section. Redirecting...</p>
        </div>
    );
}
