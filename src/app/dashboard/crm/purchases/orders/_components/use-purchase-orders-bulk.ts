'use client';

import { useToast } from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';

/**
 * usePurchaseOrdersBulk — bulk-action handlers for the PO list.
 *
 * Each handler funnels through a single transition so the loading state
 * is shared across the bar. Toasts surface the result; on success we
 * refresh the route so the list reloads from the server.
 */

import * as React from 'react';

import {
  bulkApprovePurchaseOrders,
  bulkArchivePurchaseOrders,
  bulkChangePurchaseOrderStatus,
  bulkDeletePurchaseOrders,
} from '@/app/actions/crm/purchase-orders.actions';
import type { CrmPurchaseOrderStatus } from '@/lib/rust-client/crm-purchase-orders';

interface UsePurchaseOrdersBulkArgs {
  selected: Set<string>;
  onCleared: () => void;
}

export function usePurchaseOrdersBulk({
  selected,
  onCleared,
}: UsePurchaseOrdersBulkArgs) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const ids = React.useCallback(() => Array.from(selected), [selected]);

  const archive = React.useCallback(() => {
    const list = ids();
    if (list.length === 0) return;
    startTransition(async () => {
      const res = await bulkArchivePurchaseOrders(list);
      if (res.success) {
        toast({
          title: `${res.processed} purchase order${res.processed === 1 ? '' : 's'} archived`,
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
      const res = await bulkDeletePurchaseOrders(list);
      if (res.success) {
        toast({
          title: `${res.processed} purchase order${res.processed === 1 ? '' : 's'} deleted`,
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
    (status: CrmPurchaseOrderStatus | string) => {
      const list = ids();
      if (list.length === 0) return;
      startTransition(async () => {
        const res = await bulkChangePurchaseOrderStatus(list, status);
        if (res.success) {
          toast({
            title: `${res.processed} purchase order${res.processed === 1 ? '' : 's'} → ${status}`,
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

  const approve = React.useCallback(() => {
    const list = ids();
    if (list.length === 0) return;
    startTransition(async () => {
      const res = await bulkApprovePurchaseOrders(list);
      if (res.success) {
        toast({
          title: `${res.processed} purchase order${res.processed === 1 ? '' : 's'} approved`,
        });
        onCleared();
        router.refresh();
      } else {
        toast({
          title: 'Bulk approval failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  }, [ids, toast, router, onCleared]);

  const send = React.useCallback(() => {
    changeStatus('sent');
  }, [changeStatus]);

  return { pending, archive, remove, changeStatus, approve, send };
}
