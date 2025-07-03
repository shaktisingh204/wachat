
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// This page is deprecated and now lives inside the /admin route.
// This component will redirect users to avoid 404s from old links.
export default function DeprecatedPlanEditorPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/dashboard/plans');
    }, [router]);

    return (
        <div>
            <p>Redirecting...</p>
        </div>
    );
}
