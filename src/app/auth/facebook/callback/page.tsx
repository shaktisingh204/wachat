
import { Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import { finalizeOnboarding } from '@/app/actions/onboarding.actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

async function OnboardingProcessor({ code, state }: { code?: string, state?: string }) {
    if (!code || !state) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Onboarding Failed</AlertTitle>
                <AlertDescription>
                    Missing authorization code or state. Please try the setup process again.
                </AlertDescription>
            </Alert>
        );
    }
    
    // The server action will handle the token exchange, project creation, and redirect.
    await finalizeOnboarding(code, state);

    // This component will likely not render this part as the action redirects.
    // It's here as a fallback.
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold">Finalizing Connection...</h1>
            <p className="text-muted-foreground">This window will close automatically.</p>
        </div>
    );
}

// This is now a fully async Server Component
export default async function FacebookCallbackPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const code = searchParams.code as string | undefined;
  const state = searchParams.state as string | undefined;
  const error = searchParams.error_description as string | undefined;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Onboarding Error</AlertTitle>
            <AlertDescription>
                {error}
            </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold">Processing...</h1>
        </div>
    }>
        <OnboardingProcessor code={code} state={state} />
    </Suspense>
  );
}
