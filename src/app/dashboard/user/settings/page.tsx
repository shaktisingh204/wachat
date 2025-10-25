'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is deprecated and now lives at /dashboard/settings/profile
// This component will redirect users to avoid 404s from old links.
export default function DeprecatedUserSettingsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/settings/profile');
    }, [router]);

    return (
        <div>
            <p>Redirecting to new settings page...</p>
        </div>
    );
}
