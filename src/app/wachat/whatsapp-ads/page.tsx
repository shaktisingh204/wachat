'use client';

/**
 * Wachat WhatsApp Ads — deprecated. This page has moved to
 * /dashboard/facebook/ads. We render a ZoruUI redirect notice and
 * forward the user automatically.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { ZoruCard } from '@/components/zoruui';

export default function DeprecatedWhatsappAdsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/facebook/ads');
  }, [router]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] items-center justify-center px-6 pt-16">
      <ZoruCard className="flex flex-col items-center gap-3 px-10 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-zoru-ink-muted" />
        <h1 className="text-[18px] tracking-tight text-zoru-ink">
          This page has moved
        </h1>
        <p className="text-[13px] text-zoru-ink-muted">
          Redirecting you to the new Ads Manager page…
        </p>
      </ZoruCard>
    </div>
  );
}
