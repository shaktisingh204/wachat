
'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function FacebookCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const code = searchParams.get('code');
    const stateFromUrl = searchParams.get('state');
    const error = searchParams.get('error_description');

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
  }, [searchParams, router, toast]);

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

export default function FacebookCallbackPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <FacebookCallback />
        </Suspense>
    )
}
