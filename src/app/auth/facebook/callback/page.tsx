
'use client';

import { Suspense, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// This is the Client Component that handles effects and state
function FacebookCallbackClient({ code, error, stateFromUrl }: { code?: string, error?: string, stateFromUrl?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessing, startTransition] = useTransition();

  useEffect(() => {
    if (error) {
      toast({
        title: 'Onboarding Failed',
        description: error,
        variant: 'destructive',
      });
      router.push('/dashboard/setup');
      return;
    }

    if (code && stateFromUrl) {
      startTransition(async () => {
        // The server action will now read the user ID from a secure cookie
        const result = await handleWabaOnboarding({ code }); 
        
        if (result.success) {
          toast({
            title: 'Connection Successful!',
            description: 'Your WhatsApp account has been connected.',
          });
          // Use replace to prevent user from going "back" to the loading page
          router.replace('/dashboard');
        } else {
          toast({
            title: 'Onboarding Failed',
            description: result.error || 'An unknown error occurred.',
            variant: 'destructive',
          });
          router.replace('/dashboard/setup');
        }
      });
    }
  // This effect should only run once when the component mounts with the props.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, error, stateFromUrl, router, toast]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted">
      <Card className="max-w-sm text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
          </div>
          <CardTitle>Finalizing connection, please wait...</CardTitle>
          <CardDescription>
            This may take a moment. Do not close this window.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// This is the Server Component that unwraps the searchParams promise
export default async function FacebookCallbackPage({
  searchParams,
}: {
  // 🔥 IMPORTANT: searchParams IS A PROMISE
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  
  // 🔥 MUST unwrap it
  const params = new URLSearchParams(searchParams as any);

  const code = params.get('code') as string | undefined;
  const state = params.get('state') as string | undefined;
  const error = params.get('error_description') as string | undefined;

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-muted">
          <Card className="max-w-sm text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
              </div>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <FacebookCallbackClient
        code={code}
        error={error}
        stateFromUrl={state}
      />
    </Suspense>
  )
}
