'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Skeleton, RouteComingSoon, Button } from '@/components/sabcrm/20ui';
import { EmailSuiteLayout } from '@/components/email/layout';

export default function EmailSignupFormsPage() {
  const router = useRouter();

  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <RouteComingSoon
          title="Audience, Signup forms"
          description="Embedded forms, popups and hosted landing pages for collecting subscribers."
          action={
            <Button
              variant="secondary"
              iconLeft={ArrowLeft}
              onClick={() => router.push('/dashboard/email/audience')}
            >
              Back to audience
            </Button>
          }
        />
      </Suspense>
    </EmailSuiteLayout>
  );
}
