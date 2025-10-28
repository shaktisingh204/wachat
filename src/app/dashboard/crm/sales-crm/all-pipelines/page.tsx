
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is deprecated. Redirecting to a more relevant page.
export default function DeprecatedAllPipelinesPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/crm/sales-crm/leads-summary');
    }, [router]);

    return null;
}
