'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { EmptyState, Spinner } from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

// Redirect the base /wachat/calls route to the default logs tab.
export default function CallsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/wachat/calls/logs');
  }, [router]);
  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Calls' },
      ]}
      width="narrow"
    >
      <EmptyState
        title="Redirecting…"
        description="Taking you to call logs."
        action={<Spinner size="lg" label="Redirecting" />}
      />
    </WachatPage>
  );
}
