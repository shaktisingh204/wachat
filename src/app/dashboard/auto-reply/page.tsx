
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

export default function DeprecatedAutoReplyPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/settings');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold">This page has moved</h1>
            <p className="text-muted-foreground">Redirecting you to the new settings page...</p>
        </div>
    );
}
