'use client';

import { useToast } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';

/**
 * useRfqBulk — bulk-action handlers for the RFQs list. Each handler
 * funnels through `startBulkTransition` so the loading state is
 * shared, runs the appropriate server action, surfaces a toast, and
 * refreshes the router on success.
 */

import * as React from 'react';

import {
  bulkArchiveRfqs,
  bulkChangeRfqStatus,
  bulkCloseRfqs,
  bulkDeleteRfqs,
} from '@/app/actions/crm/rfqs.actions';
import type { CrmRfqStatus } from '@/lib/rust-client/crm-rfqs';

interface UseRfqBulkArgs {
  selected: Set<string>;
  onCleared: () => void;
}

export function useRfqBulk({ selected, onCleared }: UseRfqBulkArgs) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const archive = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkArchiveRfqs(ids);
      if (res.success) {
        toast({
          title: `${res.processed} RFQ${res.processed === 1 ? '' : 's'} archived`,
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
      const res = await bulkDeleteRfqs(ids);
      if (res.success) {
        toast({
          title: `${res.processed} RFQ${res.processed === 1 ? '' : 's'} deleted`,
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
    (status: CrmRfqStatus) => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      startTransition(async () => {
        const res = await bulkChangeRfqStatus(ids, status);
        if (res.success) {
          toast({
            title: `${res.processed} RFQ${res.processed === 1 ? '' : 's'} → ${status}`,
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

  const close = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkCloseRfqs(ids);
      if (res.success) {
        toast({
          title: `${res.processed} RFQ${res.processed === 1 ? '' : 's'} closed`,
        });
        onCleared();
        router.refresh();
      } else {
        toast({
          title: 'Bulk close failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  }, [selected, toast, router, onCleared]);

  return { pending, archive, remove, changeStatus, close };
}
