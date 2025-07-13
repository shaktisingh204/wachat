
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RedirectToNewDocs() {
    const router = useRouter();

    useEffect(() => {
        // Find the active project ID to construct the new URL if needed,
        // but for now, we'll just go to the top-level custom e-commerce page.
        // A better approach might be to redirect to the specific shop's docs.
        router.replace('/dashboard/facebook/custom-ecommerce');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full">
            <p>This page has moved. Redirecting...</p>
        </div>
    );
}
