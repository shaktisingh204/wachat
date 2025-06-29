
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

export default function DeprecatedCannedMessagesPage() {
    const router = useRouter();
    useEffect(() => {
        // Redirect to the settings page with the correct tab pre-selected
        router.replace('/dashboard/settings?tab=canned-messages');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold">This page has moved</h1>
            <p className="text-muted-foreground">Redirecting you to the new settings page...</p>
        </div>
    );
}
