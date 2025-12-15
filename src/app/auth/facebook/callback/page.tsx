
'use client';

import { useEffect, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';

export default function FacebookCallbackPage() {
    const searchParams = useSearchParams();
    const [error, setError] = React.useState<string | null>(null);
    const [isProcessing, startTransition] = useTransition();

    useEffect(() => {
        const code = searchParams.get('code');
        
        if (code) {
            startTransition(async () => {
                try {
                    // Retrieve asset data stored by the parent window's postMessage listener
                    const wabaDataString = localStorage.getItem('wabaData');
                    if (!wabaDataString) {
                        throw new Error('Onboarding data not found. Please try the connection process again.');
                    }
                    const wabaData = JSON.parse(wabaDataString);

                    // Call the server action with both the code and the asset data
                    const result = await handleWabaOnboarding({ ...wabaData, code });

                    if (result.error) {
                        throw new Error(result.error);
                    }

                    // Signal success to parent window and close self
                    if (window.opener) {
                        window.opener.postMessage('WABASimplifyOnboardingSuccess', window.location.origin);
                    }
                    window.close();

                } catch (e: any) {
                    setError(e.message || 'An unknown error occurred.');
                    if (window.opener) {
                        window.opener.postMessage({ type: 'WABASimplifyOnboardingError', error: e.message }, window.location.origin);
                    }
                } finally {
                    localStorage.removeItem('wabaData');
                }
            });
        } else {
            const errorParam = searchParams.get('error_message') || "Authorization failed. No code returned from Facebook.";
            setError(errorParam);
             if (window.opener) {
                window.opener.postMessage({ type: 'WABASimplifyOnboardingError', error: errorParam }, window.location.origin);
                window.close();
            }
        }
    }, [searchParams]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            {isProcessing && (
                <>
                    <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 text-muted-foreground">Finalizing connection, please wait...</p>
                </>
            )}
            {error && (
                <div className="text-center text-destructive p-4">
                    <h1 className="font-bold">Onboarding Failed</h1>
                    <p>{error}</p>
                    <p className="mt-4 text-xs">You can close this window.</p>
                </div>
            )}
        </div>
    );
}
