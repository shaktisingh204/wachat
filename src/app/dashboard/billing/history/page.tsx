// This file is deprecated. The billing history page has been moved.
// To prevent 404 errors, we'll redirect to the new location.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

export default function DeprecatedBillingHistoryPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/user/billing/history');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold">This page has moved</h1>
            <p className="text-muted-foreground">Redirecting you to the new user settings page...</p>
        </div>
    );
}
