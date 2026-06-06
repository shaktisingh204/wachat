import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Skeleton, RouteComingSoon } from '@/components/sabcrm/20ui';
import { EmailSuiteLayout } from '@/components/email/layout';

export default function EmailFormsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <RouteComingSoon
          title="Forms"
          description="Signup forms, popups and hosted landing pages."
          action={
            <Link
              href="/dashboard/email"
              className="u-btn u-btn--secondary u-btn--sm"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span className="u-btn__label">Back to email overview</span>
            </Link>
          }
        />
      </Suspense>
    </EmailSuiteLayout>
  );
}
