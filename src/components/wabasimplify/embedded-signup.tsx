'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export const runtime = 'nodejs';

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
            console.log('[CALLBACK] Authorization code received. Sending to server action...');
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
                    router.push('/dashboard');
                }
            });
        } else {
            const err = searchParams.get('error_description') || 'No authorization code received';
            setError(err);
            toast({
                title: 'Onboarding Cancelled',
                description: err,
                variant: 'destructive',
            });
        }
    }, [searchParams]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">
                {isProcessing ? 'Finalizing connection...' : error ? 'An error occurred' : 'Processing...'}
            </p>
            {error && <p className="text-destructive text-xs mt-2">{error}</p>}
        </div>
    );
}

export default function FacebookCallbackPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <FacebookCallbackHandler />
        </Suspense>
    );
}
