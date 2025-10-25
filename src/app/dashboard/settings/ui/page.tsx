'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page redirects to the new user-specific settings page.
export default function DeprecatedUiPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/user/settings/ui');
    }, [router]);
    return null;
}
