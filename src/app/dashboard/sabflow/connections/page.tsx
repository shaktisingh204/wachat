'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SabFlowConnectionsRedirect() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to the main flow builder as connections are now handled there.
        router.replace('/dashboard/sabflow/flow-builder');
    }, [router]);

    return null; // Render nothing while redirecting
}
