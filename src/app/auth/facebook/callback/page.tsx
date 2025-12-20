
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';

// This component handles the server-side logic
async function OnboardingProcessor({ code, state }: { code: string; state: string }) {
    if (!code) {
        redirect('/dashboard/setup?error=Authorization+failed');
    }
    
    try {
        await handleWabaOnboarding(code, state);
        redirect('/dashboard/setup?status=connecting');
    } catch (error: any) {
        redirect(`/dashboard/setup?error=${encodeURIComponent(error.message)}`);
    }

    // This part should not be reached due to redirects
    return null;
}

// The main page component using Suspense
export default function FacebookCallbackPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const code = searchParams.code as string | undefined;
  const state = searchParams.state as string | undefined;

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Finalizing connection, please wait...</p>
        {code && state && (
          <Suspense fallback={null}>
            <OnboardingProcessor code={code} state={state} />
          </Suspense>
        )}
        {!code && !state && (
            <p className="text-destructive">Missing authorization code or state. Please try again.</p>
        )}
      </div>
    </div>
  );
}
