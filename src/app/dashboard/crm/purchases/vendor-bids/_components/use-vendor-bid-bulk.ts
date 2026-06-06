'use client';

import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';

/**
 * useVendorBidBulk — bulk-action handlers for the Vendor Bids list.
 * Each handler funnels through `startBulkTransition` so the loading
 * state is shared, runs the appropriate server action, surfaces a
 * toast, and refreshes the router on success.
 */

import * as React from 'react';

import {
  bulkArchiveVendorBids,
  bulkChangeVendorBidStatus,
  bulkDeleteVendorBids,
} from '@/app/actions/crm/vendor-bids.actions';
import type { CrmVendorBidStatus } from '@/lib/rust-client/crm-vendor-bids';

interface UseVendorBidBulkArgs {
  selected: Set<string>;
  onCleared: () => void;
}

export function useVendorBidBulk({ selected, onCleared }: UseVendorBidBulkArgs) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [pending, startTransition] = React.useTransition();

  const archive = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkArchiveVendorBids(ids);
      if (res.success) {
        toast({
          title: `${res.processed} bid${res.processed === 1 ? '' : 's'} archived`,
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
      const res = await bulkDeleteVendorBids(ids);
      if (res.success) {
        toast({
          title: `${res.processed} bid${res.processed === 1 ? '' : 's'} deleted`,
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
    (status: CrmVendorBidStatus) => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      startTransition(async () => {
        const res = await bulkChangeVendorBidStatus(ids, status);
        if (res.success) {
          toast({
            title: `${res.processed} bid${res.processed === 1 ? '' : 's'} → ${status}`,
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

  const approve = React.useCallback(() => changeStatus('awarded'), [changeStatus]);
  const reject = React.useCallback(() => changeStatus('rejected'), [changeStatus]);

  return { pending, archive, remove, changeStatus, approve, reject };
}
