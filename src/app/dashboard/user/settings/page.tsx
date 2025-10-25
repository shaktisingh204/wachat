
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page redirects to the default settings tab.
export default function UserSettingsRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/user/settings/profile');
    }, [router]);
    return null; 
}
