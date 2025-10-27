'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeprecatedCrmNewFormPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/crm/sales-crm/forms/new');
    }, [router]);

    return null;
}
