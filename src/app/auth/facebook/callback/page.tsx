
'use client';

import { useEffect, useTransition, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { handleWabaOnboardingTokenExchange } from '@/app/actions/onboarding.actions';

function FacebookCallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [error, setError] = React.useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error_description');
        
        if (errorParam) {
            router.replace(`/dashboard/setup?error=${encodeURIComponent(errorParam)}`);
            return;
        }

        if (!code || !state) {
            setError('Missing authorization code or state. Please try the connection process again.');
            return;
        }

        const exchangeToken = async () => {
            const result = await handleWabaOnboardingTokenExchange(code, state);
            if (result.error) {
                router.replace(`/dashboard/setup?error=${encodeURIComponent(result.error)}`);
            } else {
                // Successfully stored token, now wait for webhook
                router.replace('/dashboard/setup?status=connecting');
            }
        };

        exchangeToken();

    }, [searchParams, router]);
    
    if (error) {
         return (
             <div className="flex flex-col items-center gap-4 text-center">
                <h1 className="text-xl font-semibold text-destructive">
                    Authentication Error
                </h1>
                <p className="text-muted-foreground">{error}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 text-center">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            <h1 className="text-xl font-semibold">Finalizing connection, please wait...</h1>
            <p className="text-muted-foreground">Do not close this window. You will be redirected shortly.</p>
        </div>
    );
}


export default function FacebookCallbackPage() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Suspense fallback={<LoaderCircle className="h-12 w-12 animate-spin text-primary" />}>
        <FacebookCallbackContent />
      </Suspense>
    </div>
  );
}
