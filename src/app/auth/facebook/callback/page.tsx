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
    const params = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    const [error, setError] = useState<string | null>(null);
    const [isProcessing, startTransition] = useTransition();

    useEffect(() => {
        const code = params.get('code');

        if (code) {
            console.log('[CALLBACK] Auth code received.');
            startTransition(async () => {
                const res = await handleWabaOnboarding(code);

                if (res.error) {
                    setError(res.error);
                    toast({
                        title: 'Onboarding failed',
                        description: res.error,
                        variant: 'destructive',
                    });
                } else {
                    toast({
                        title: 'Success',
                        description: res.message,
                    });
                    router.push('/dashboard');
                }
            });
        } else {
            const err = params.get('error_description') || 'Missing authorization code.';
            setError(err);
            toast({
                title: 'Onboarding failed',
                description: err,
                variant: 'destructive',
            });
        }
    }, [params]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center">
            <LoaderCircle className="h-12 w-12 animate-spin" />
            {error && <p className="text-red-500 mt-4">{error}</p>}
        </div>
    );
}

export default function FacebookCallbackPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <FacebookCallbackHandler />
        </Suspense>
    );
}

