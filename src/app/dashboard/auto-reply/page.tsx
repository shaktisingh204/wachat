'use client';

/**
 * /dashboard/auto-reply — deprecated, redirects to the settings tab.
 * Clay-styled loading state for the brief redirect flash.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LuLoader } from 'react-icons/lu';

export default function DeprecatedAutoReplyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?tab=auto-reply');
  }, [router]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-center clay-enter">
      <LuLoader
        className="h-6 w-6 animate-spin text-clay-ink-muted"
        strokeWidth={1.75}
      />
      <h1 className="text-[18px] font-semibold text-clay-ink">
        This page has moved
      </h1>
      <p className="text-[13px] text-clay-ink-muted">
        Redirecting you to the new settings page…
      </p>
    </div>
  );
}
