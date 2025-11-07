
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect to the new unified builder experience
export default function NewSabFlowRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/sabflow/flow-builder/new');
    }, [router]);
    
    return null;
}

    