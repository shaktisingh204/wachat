
'use client';

// This is a client-side component to show a loading state
// while the server action in the Suspense boundary runs.

import { LoaderCircle } from 'lucide-react';

export default function FacebookCallbackLoadingPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">Finalizing connection, please wait...</p>
        </div>
    );
}
