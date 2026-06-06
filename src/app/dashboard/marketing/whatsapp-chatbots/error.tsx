'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';

/**
 * WhatsApp Chatbots error boundary — catches unexpected React render errors
 * and shows a recoverable 20ui EmptyState instead of the raw Next.js error
 * page.
 */

export default function WhatsappChatbotsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[sabwa] route error', error);
  }, [error]);

  const description =
    error?.message && error.message.length < 200
      ? error.message
      : 'We ran into an issue loading the chatbots page. Try again or head back to overview.';

  return (
    <div className="ui20 mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
      <div role="alert" className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon={AlertTriangle}
          tone="danger"
          title="Failed to load WhatsApp Chatbots"
          description={description}
          action={
            <div className="flex items-center justify-center gap-3">
              <Button variant="primary" size="md" onClick={() => reset()}>
                Try again
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  window.location.href = '/dashboard/marketing';
                }}
              >
                Back to Marketing
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
