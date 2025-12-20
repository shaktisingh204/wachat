
'use server';

import { Suspense } from 'react';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { LoaderCircle, AlertCircle } from 'lucide-react';

async function OnboardingProcessor({
  code,
  state,
  includeCatalog
}: {
  code: string;
  state: string;
  includeCatalog: boolean;
}) {
  const result = await handleWabaOnboarding(code, state, includeCatalog);
  if (result.success) {
    redirect('/dashboard?onboarding=success');
  } else {
    redirect(`/dashboard/setup?error=${encodeURIComponent(result.error || 'An unknown error occurred.')}`);
  }
}

function LoadingFallback() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-md text-center p-8">
                <LoaderCircle className="h-12 w-12 text-primary animate-spin mx-auto" />
                <h1 className="text-2xl font-bold mt-4">Finalizing Connection...</h1>
                <p className="text-muted-foreground">Please wait while we set up your account. Do not close this window.</p>
            </Card>
        </div>
    );
}

export default async function FacebookCallbackPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const code = searchParams.code as string | undefined;
  const state = searchParams.state as string | undefined;
  const error = searchParams.error_description as string | undefined;
  const includeCatalog = searchParams.include_catalog === 'true';


  if (error) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-md text-center p-8">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                <h1 className="text-2xl font-bold mt-4">Connection Failed</h1>
                <p className="text-muted-foreground break-words">{error}</p>
            </Card>
        </div>
    );
  }

  if (!code || !state) {
     return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-md text-center p-8">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                <h1 className="text-2xl font-bold mt-4">Invalid Callback</h1>
                <p className="text-muted-foreground">The callback from Facebook was missing required information. Please try again.</p>
            </Card>
        </div>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <OnboardingProcessor code={code} state={state} includeCatalog={includeCatalog} />
    </Suspense>
  );
}
