'use client';

import { EmptyState } from '@/components/zoruui';
import {
  useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedCannedMessagesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?tab=canned-messages');
  }, [router]);

  return (
    <ZoruEmptyState
      icon={<Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.75} />}
      title="This page has moved"
      description="Redirecting you to Settings → Canned messages…"
    />
  );
}
