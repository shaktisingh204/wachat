'use client';

/**
 * /wachat/canned-messages — deprecated, redirects to the settings tab.
 * ZoruUI loading state for the brief redirect flash.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedCannedMessagesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?tab=canned-messages');
  }, [router]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2
        className="h-6 w-6 animate-spin text-zoru-ink-muted"
        strokeWidth={1.75}
      />
      <h1 className="text-[18px] text-zoru-ink">This page has moved</h1>
      <p className="text-[13px] text-zoru-ink-muted">
        Redirecting you to Settings → Canned messages…
      </p>
    </div>
  );
}
