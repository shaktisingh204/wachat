'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';
import React from 'react';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

function FacebookCallbackHandler() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const [isProcessing, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get('code');

        if (code) {
            console.log('[CALLBACK] Authorization code received. Initiating server action.');
            startTransition(async () => {
                const result = await handleWabaOnboarding(code);
                if (result.error) {
                    setError(result.error);
                    toast({
                        title: 'Onboarding Failed',
                        description: result.error,
                        variant: 'destructive',
                        duration: 10000,
                    });
                } else {
                    toast({
                        title: 'Onboarding Success!',
                        description: result.message || 'Your account has been connected.',
                    });
                    // Redirect to the dashboard after success
                    router.push('/dashboard');
                }
            });
        } else {
            const errorParam = searchParams.get('error_description') || 'No authorization code received from Meta.';
            setError(errorParam);
             toast({
                title: 'Onboarding Cancelled or Failed',
                description: errorParam,
                variant: 'destructive',
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">
                {isProcessing ? 'Finalizing connection, please wait...' : error ? 'An error occurred.' : 'Processing...'}
            </p>
            {error && <p className="mt-2 text-xs text-destructive max-w-sm text-center">{error}</p>}
            <p className="mt-2 text-xs text-muted-foreground">This window should close automatically.</p>
        </div>
    );
}

export default function FacebookCallbackPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <FacebookCallbackHandler />
        </Suspense>
    );
}
