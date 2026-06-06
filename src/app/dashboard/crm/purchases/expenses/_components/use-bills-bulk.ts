'use client';

import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';

/**
 * useBillsBulk — bulk-action handlers for the bill list.
 *
 * Each handler funnels through a single transition so the loading state
 * is shared across the bar. Toasts surface the result; on success we
 * refresh the route so the list reloads from the server.
 */

import * as React from 'react';

import {
  bulkArchiveBills,
  bulkChangeBillStatus,
  bulkDeleteBills,
} from '@/app/actions/crm/bills.actions';
import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';

interface UseBillsBulkArgs {
  selected: Set<string>;
  onCleared: () => void;
}

export function useBillsBulk({ selected, onCleared }: UseBillsBulkArgs) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [pending, startTransition] = React.useTransition();

  const ids = React.useCallback(() => Array.from(selected), [selected]);

  const archive = React.useCallback(() => {
    const list = ids();
    if (list.length === 0) return;
    startTransition(async () => {
      const res = await bulkArchiveBills(list);
      if (res.success) {
        toast({
          title: `${res.processed} bill${res.processed === 1 ? '' : 's'} archived`,
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
  }, [ids, toast, router, onCleared]);

  const remove = React.useCallback(() => {
    const list = ids();
    if (list.length === 0) return;
    startTransition(async () => {
      const res = await bulkDeleteBills(list);
      if (res.success) {
        toast({
          title: `${res.processed} bill${res.processed === 1 ? '' : 's'} deleted`,
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
  }, [ids, toast, router, onCleared]);

  const changeStatus = React.useCallback(
    (status: CrmBillStatus | string) => {
      const list = ids();
      if (list.length === 0) return;
      startTransition(async () => {
        const res = await bulkChangeBillStatus(list, status);
        if (res.success) {
          toast({
            title: `${res.processed} bill${res.processed === 1 ? '' : 's'} → ${status}`,
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
    [ids, toast, router, onCleared],
  );

  const markPaid = React.useCallback(() => {
    changeStatus('paid');
  }, [changeStatus]);

  return { pending, archive, remove, changeStatus, markPaid };
}
