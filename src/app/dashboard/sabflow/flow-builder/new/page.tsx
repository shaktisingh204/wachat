
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect to the main flow builder page where a dialog will handle creation
export default function NewSabFlowRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/sabflow/flow-builder');
    }, [router]);
    
    return null;
}
