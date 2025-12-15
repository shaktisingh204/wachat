'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { useToast } from '@/hooks/use-toast';

function FacebookCallbackHandler() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    const [error, setError] = useState<string | null>(null);
    const [isProcessing, startTransition] = useTransition();

    useEffect(() => {
        const code = searchParams.get('code');

        if (code) {
            startTransition(async () => {
                const result = await handleWabaOnboarding(code);

                if (result.error) {
                    setError(result.error);
                    toast({
                        title: 'Onboarding Failed',
                        description: result.error,
                        variant: 'destructive',
                    });
                } else {
                    toast({
                        title: 'Onboarding Complete',
                        description: result.message,
                    });
                    router.push('/dashboard');
                }
            });
        } else {
            const err =
                searchParams.get('error_description') ??
                'No authorization code received from Meta';
            setError(err);
        }
    }, [searchParams]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center">
            <LoaderCircle className="h-12 w-12 animate-spin" />
            {error && <p className="mt-4 text-red-500">{error}</p>}
        </div>
    );
}

export default function FacebookCallbackPage() {
    return (
        <Suspense fallback={<div>Loading…</div>}>
            <FacebookCallbackHandler />
        </Suspense>
    );
}
