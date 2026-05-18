'use client';

import { ZoruEmptyState } from '@/components/zoruui';
import {
  useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Redirect the base /wachat/calls route to the default logs tab.
export default function CallsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/wachat/calls/logs');
  }, [router]);
  return (
    <ZoruEmptyState
      icon={<Loader2 className="h-6 w-6 animate-spin" />}
      title="Redirecting…"
      description="Taking you to call logs."
    />
  );
}
