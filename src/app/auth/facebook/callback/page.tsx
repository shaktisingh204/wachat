
'use client';

import { Suspense, useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';
import React from 'react';

// This component's only job is to run once the popup is redirected here.
// It will close the popup window, which signals the parent window (the one with the "Continue with Facebook" button)
// that the FB.login() call has completed. The parent window's callback then handles the `code`.
function FacebookCallbackHandler() {
    
    useEffect(() => {
        // The FB.login callback in the parent window is what receives the code.
        // We just need to close this popup so that callback can fire.
        if (window.opener) {
            console.log("Callback page loaded in popup. Closing...");
            window.close();
        }
    }, []);


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Finalizing connection, please wait...</p>
            <p className="mt-2 text-xs">This window should close automatically.</p>
        </div>
    );
}

// The main page is now a Server Component that wraps the client component in Suspense
export default function FacebookCallbackPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <FacebookCallbackHandler />
        </Suspense>
    );
}
