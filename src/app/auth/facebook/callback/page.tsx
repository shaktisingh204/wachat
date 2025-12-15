
'use client';

import { Suspense, useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';
import React from 'react';

// This component is intentionally kept minimal.
// Its primary purpose is to be the redirect target for the OAuth flow.
// The actual logic is handled by the parent window that opened this popup.
function FacebookCallbackHandler() {
    
    useEffect(() => {
        // The parent window listens for the code via the redirect URL of the popup.
        // It's crucial to close this window so the parent's FB.login callback can fire.
        if (window.opener) {
            console.log("Callback page loaded, signaling parent window might be possible here if needed, but closing is primary.");
        }
        // The FB.login callback in the parent window is what receives the code, so we just close this popup.
        // If the code were in the URL, we could post it back:
        // const urlParams = new URLSearchParams(window.location.search);
        // const code = urlParams.get('code');
        // if (window.opener && code) {
        //     window.opener.postMessage({ type: 'oauthCode', code: code }, '*');
        // }
        // For embedded signup, this window should close automatically or be closed by the parent.
        // If it remains open, it means the flow has likely failed. We'll leave it open for debugging.
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
