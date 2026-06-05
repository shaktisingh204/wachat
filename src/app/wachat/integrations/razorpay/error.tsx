'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

export default function IntegrationsRazorpayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error in IntegrationsRazorpay:', error);
  }, [error]);

  return (
    <WachatPage>
      <div className="flex h-[50vh] flex-col items-center justify-center">
        <EmptyState
          icon={AlertCircle}
          title="Something went wrong"
          description={error.message || "We couldn't load this page. Please try again."}
          action={
            <Button variant="outline" onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </div>
    </WachatPage>
  );
}
