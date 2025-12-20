// This file is no longer used by the primary onboarding flow,
// but it is kept to handle any legacy links or manual setups that might still use it
// and to satisfy the redirect_uri requirement in the Meta App settings.
// It will simply close the window if opened.

'use client';

import { useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

export default function FacebookCallbackPage() {
    useEffect(() => {
        // The popup flow communicates via `postMessage`. This page, if opened,
        // was likely part of a redirect flow that is no longer the primary method.
        // We can close it to complete the user journey.
        if (typeof window !== 'undefined') {
            window.close();
        }
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
             <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
             <h1 className="text-xl font-semibold">Finalizing Connection...</h1>
             <p className="text-muted-foreground">This window will close automatically.</p>
        </div>
    );
}
