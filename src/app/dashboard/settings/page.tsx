'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page redirects to the default settings tab.
export default function SettingsRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/settings/profile');
    }, [router]);
    return null; 
}
