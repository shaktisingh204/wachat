
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

// This page is deprecated and now lives at /dashboard/facebook/all-projects
// This component will redirect users to avoid 404s from old links.
export default function DeprecatedFacebookSetupPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/facebook/all-projects');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold">This page has moved</h1>
            <p className="text-muted-foreground">Redirecting you to the new Project Connections page...</p>
        </div>
    );
}
