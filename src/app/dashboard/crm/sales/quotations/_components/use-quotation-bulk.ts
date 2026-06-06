'use client';

import { useToast } from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';

/**
 * useQuotationBulk — bulk-action handlers for the quotations list.
 * Each handler funnels through `startBulkTransition` so the loading
 * state is shared, runs the appropriate server action, surfaces a
 * toast, and refreshes the router on success.
 */

import * as React from 'react';

import {
  bulkArchiveQuotations,
  bulkChangeQuotationStatus,
  bulkDeleteQuotations,
} from '@/app/actions/crm/quotations.actions';
import type { CrmQuotationStatus } from '@/lib/rust-client/crm-quotations';

interface UseQuotationBulkArgs {
  selected: Set<string>;
  onCleared: () => void;
}

export function useQuotationBulk({ selected, onCleared }: UseQuotationBulkArgs) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const archive = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkArchiveQuotations(ids);
      if (res.success) {
        toast({
          title: `${res.processed} quotation${res.processed === 1 ? '' : 's'} archived`,
        });
        onCleared();
        router.refresh();
      } else {
        toast({
          title: 'Bulk archive failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  }, [selected, toast, router, onCleared]);

  const remove = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkDeleteQuotations(ids);
      if (res.success) {
        toast({
          title: `${res.processed} quotation${res.processed === 1 ? '' : 's'} deleted`,
        });
        onCleared();
        router.refresh();
      } else {
        toast({
          title: 'Bulk delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  }, [selected, toast, router, onCleared]);

  const changeStatus = React.useCallback(
    (status: CrmQuotationStatus) => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      startTransition(async () => {
        const res = await bulkChangeQuotationStatus(ids, status);
        if (res.success) {
          toast({
            title: `${res.processed} quotation${res.processed === 1 ? '' : 's'} → ${status}`,
          });
          onCleared();
          router.refresh();
        } else {
          toast({
            title: 'Bulk status change failed',
            description: res.error,
            variant: 'destructive',
          });
        }
      });
    },
    [selected, toast, router, onCleared],
  );

  /** Mark selected as `sent`. */
  const send = React.useCallback(() => {
    changeStatus('sent');
  }, [changeStatus]);

  return { pending, archive, remove, changeStatus, send };
}
