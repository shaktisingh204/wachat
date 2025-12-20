
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { redirect } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { Suspense } from 'react';

async function OnboardingProcessor({ code, error }: { code?: string, error?: string }) {
    if (error) {
        redirect(`/dashboard/setup?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
        redirect(`/dashboard/setup?error=No%20authorization%20code%20received`);
    }

    const result = await handleWabaOnboarding(code);
    
    if (result.error) {
        const errorMessage = encodeURIComponent(result.error);
        redirect(`/dashboard/setup?error=${errorMessage}`);
    } else {
        redirect('/dashboard');
    }

    // This part will likely not be seen as a redirect will happen.
    return null;
}

function LoadingFallback() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg text-muted-foreground">Finalizing connection...</p>
        </div>
    );
}

export default function FacebookCallbackPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const code = searchParams.code as string | undefined;
    const error = searchParams.error_description as string | undefined;

    return (
        <Suspense fallback={<LoadingFallback />}>
            <OnboardingProcessor code={code} error={error} />
        </Suspense>
    );
}
