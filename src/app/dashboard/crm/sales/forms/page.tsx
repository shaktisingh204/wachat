'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeprecatedCrmFormsPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/crm/sales-crm/forms');
    }, [router]);

    return null;
}
