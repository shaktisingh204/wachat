'use client';

import { EmptyState, Spinner } from '@/components/sabcrm/20ui';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

export default function DeprecatedCannedMessagesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?tab=canned-messages');
  }, [router]);

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Canned messages' },
      ]}
      width="narrow"
    >
      <EmptyState
        title="This page has moved"
        description="Redirecting you to Settings → Canned messages…"
        action={<Spinner size="lg" label="Redirecting" />}
      />
    </WachatPage>
  );
}
