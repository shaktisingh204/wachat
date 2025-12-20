
'use client';

import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { redirect } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// This is a client-side wrapper to safely read searchParams
function OnboardingProcessor() {
    const searchParams = useSearchParams();
    const code = searchParams.get('code');
    const error = searchParams.get('error_description');

    useEffect(() => {
        async function processOnboarding() {
            if (error) {
                redirect(`/dashboard/setup?error=${encodeURIComponent(error)}`);
                return;
            }

            if (!code) {
                redirect(`/dashboard/setup?error=No%20authorization%20code%20received`);
                return;
            }

            const result = await handleWabaOnboarding(code);
            
            if (result.error) {
                const errorMessage = encodeURIComponent(result.error);
                redirect(`/dashboard/setup?error=${errorMessage}`);
            } else {
                redirect('/dashboard');
            }
        }
        processOnboarding();
    }, [code, error]);

    return null; // The logic is in useEffect, which handles redirection
}

export default function FacebookCallbackPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
            <Suspense fallback={null}>
                <OnboardingProcessor />
            </Suspense>
            <div className="flex flex-col items-center justify-center text-center">
                <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-lg font-semibold text-muted-foreground">Finalizing connection, please wait...</p>
            </div>
        </div>
    );
}
