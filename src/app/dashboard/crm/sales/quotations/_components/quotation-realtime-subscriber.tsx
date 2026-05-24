'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWorksuiteRealtime } from '@/app/dashboard/crm/_components/use-worksuite-realtime';

export function QuotationRealtimeSubscriber({ quotationId }: { quotationId: string }) {
  const router = useRouter();

  const handleEvent = useCallback((event: unknown) => {
    // If the real-time event is related to this quotation, trigger a router.refresh()
    // This handles the error: "timelineItems might not re-render if real-time events fire."
    try {
      const str = JSON.stringify(event);
      if (str.includes(quotationId)) {
        router.refresh();
      }
    } catch {}
  }, [quotationId, router]);

  useWorksuiteRealtime(handleEvent);

  return null;
}
