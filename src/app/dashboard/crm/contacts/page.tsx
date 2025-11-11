
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This file is deprecated. Redirecting to the correct "All Leads" page.
export default function DeprecatedCrmContactsPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/crm/sales-crm/all-leads');
    }, [router]);

    return null; // Render nothing while redirecting
}
