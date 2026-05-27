'use client';

import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription } from '@/components/zoruui';
import {
  useEffect,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// This is the Client Component that handles effects and state
export function FacebookCallbackClient({ code, error, stateFromUrl }: { code?: string, error?: string, stateFromUrl?: string }) {
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
      router.push('/wachat/setup');
      return;
    }

    if (code && stateFromUrl) {
      startTransition(async () => {
        // The userId is now read from the secure cookie on the server-side action
        // Passing an empty string, the server will resolve the user from the cookie.
        const result = await (handleWabaOnboarding as any)({ code, userId: '' });
        
        if (result.success) {
          toast({
            title: 'Connection Successful!',
            description: 'Your WhatsApp account has been connected.',
          });
          // Use replace to prevent user from going "back" to the loading page
          router.replace('/wachat');
        } else {
          toast({
            title: 'Onboarding Failed',
            description: result.error || 'An unknown error occurred.',
            variant: 'destructive',
          });
          router.replace('/wachat/setup');
        }
      });
    }
  // This effect should only run once when the component mounts with the props.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, error, stateFromUrl, router, toast]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zoru-surface-2">
      <Card className="max-w-sm text-center">
        <ZoruCardHeader>
          <div className="flex justify-center mb-4">
            <LoaderCircle className="h-10 w-10 animate-spin text-zoru-ink" />
          </div>
          <ZoruCardTitle>Finalizing connection, please wait...</ZoruCardTitle>
          <ZoruCardDescription>
            This may take a moment. Do not close this window.
          </ZoruCardDescription>
        </ZoruCardHeader>
      </Card>
    </div>
  );
}
