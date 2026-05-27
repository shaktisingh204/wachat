'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/wachat-ui';

// Redirect the base /wachat/calls route to the default logs tab.
export default function CallsRedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/wachat/calls/logs'); }, [router]);
  return (
    <EmptyState
      icon={Loader2}
      title="Redirecting..."
      description="Taking you to call logs."
    />
  );
}
