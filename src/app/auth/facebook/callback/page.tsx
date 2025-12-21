
'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter, ReadonlyURLSearchParams } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// 🔥 IMPORTANT: This is now an async component to handle the searchParams promise
async function FacebookCallback({ searchParams }: { searchParams: Promise<ReadonlyURLSearchParams>; }) {
  const router = useRouter();
  const { toast } = useToast();

  // 🔥 MUST unwrap it
  const params = await searchParams;
  const code = params.get('code') as string | undefined;
  const stateFromUrl = params.get('state') as string | undefined;
  const error = params.get('error_description') as string | undefined;

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
      // The `userId` is now retrieved from the secure cookie on the server-side,
      // so we only need to pass the code.
      handleWabaOnboarding({ code, userId: '' }).then((result) => {
        if (result.success) {
          toast({
            title: 'Connection Successful!',
            description: 'Your WhatsApp account has been connected.',
          });
          router.push('/dashboard');
        } else {
          toast({
            title: 'Onboarding Failed',
            description: result.error || 'An unknown error occurred.',
            variant: 'destructive',
          });
          router.push('/dashboard/setup');
        }
      });
    }
  // NOTE: The dependency array is intentionally empty to run this logic only once after the initial render.
  // The params are resolved before the effect runs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

// Wrapper component to use Suspense
function FacebookCallbackWrapper() {
    const searchParams = useSearchParams(); // This is the client-side hook

    // Create a Promise that resolves with the searchParams
    const searchParamsPromise = new Promise<ReadonlyURLSearchParams>((resolve) => {
        resolve(searchParams);
    });
    
    return <FacebookCallback searchParams={searchParamsPromise} />;
}


export default function FacebookCallbackPage() {
    return (
        <Suspense fallback={
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
        }>
            <FacebookCallbackWrapper />
        </Suspense>
    )
}
