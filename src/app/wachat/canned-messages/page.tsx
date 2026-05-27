'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { WaPage, EmptyState } from '@/components/wachat-ui';

export default function DeprecatedCannedMessagesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?tab=canned-messages');
  }, [router]);

  return (
    <WaPage>
      <EmptyState
        icon={Loader2}
        title="This page has moved"
        description="Redirecting you to Settings > Canned messages..."
      />
    </WaPage>
  );
}
