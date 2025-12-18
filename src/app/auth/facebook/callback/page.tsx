
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { redirect } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { Suspense } from 'react';

async function OnboardingProcessor({ code, error }: { code: string | null, error: string | null }) {
    if (error) {
        redirect(`/dashboard/setup?error=${encodeURIComponent(error)}`);
    }
    
    if (!code) {
        redirect('/dashboard/setup?error=No%20authorization%20code%20received.');
    }

    const result = await handleWabaOnboarding(code);
    
    if (result.error) {
        const errorMessage = encodeURIComponent(result.error);
        redirect(`/dashboard/setup?error=${errorMessage}`);
    }

    redirect('/dashboard');
}

export default function FacebookCallbackPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const code = searchParams.code as string | undefined;
    const error = searchParams.error_description as string | undefined;

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center text-center">
                    <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 text-lg font-semibold text-muted-foreground">Loading...</p>
                </div>
            }>
                <OnboardingProcessor code={code || null} error={error || null} />
            </Suspense>
             <div className="flex flex-col items-center justify-center text-center">
                <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-lg font-semibold text-muted-foreground">
                    Finalizing connection, please wait...
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                    This may take a moment. Do not close this window.
                </p>
            </div>
        </div>
    );
}
