'use client';

import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';

/**
 * useInvoicesBulk — bulk-action handlers for the invoice list.
 *
 * Each handler funnels through a single transition so the loading state
 * is shared across the bar. Toasts surface the result; on success we
 * refresh the route so the list reloads from the server.
 */

import * as React from 'react';

import {
  bulkArchiveInvoices,
  bulkAssignInvoices,
  bulkChangeInvoiceStatus,
  bulkDeleteInvoices,
} from '@/app/actions/crm/invoices.actions';
import type { CrmInvoiceStatus } from '@/lib/rust-client/crm-invoices';

interface UseInvoicesBulkArgs {
  selected: Set<string>;
  onCleared: () => void;
}

export function useInvoicesBulk({ selected, onCleared }: UseInvoicesBulkArgs) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [pending, startTransition] = React.useTransition();

  const ids = React.useCallback(() => Array.from(selected), [selected]);

  const archive = React.useCallback(() => {
    const list = ids();
    if (list.length === 0) return;
    startTransition(async () => {
      const res = await bulkArchiveInvoices(list);
      if (res.success) {
        toast({
          title: `${res.processed} invoice${res.processed === 1 ? '' : 's'} archived`,
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
      const res = await bulkDeleteInvoices(list);
      if (res.success) {
        toast({
          title: `${res.processed} invoice${res.processed === 1 ? '' : 's'} deleted`,
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
    (status: CrmInvoiceStatus | string) => {
      const list = ids();
      if (list.length === 0) return;
      startTransition(async () => {
        const res = await bulkChangeInvoiceStatus(list, status);
        if (res.success) {
          toast({
            title: `${res.processed} invoice${res.processed === 1 ? '' : 's'} → ${status}`,
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

  const send = React.useCallback(() => {
    changeStatus('sent');
  }, [changeStatus]);

  const assign = React.useCallback(
    (userId: string | null) => {
      const list = ids();
      if (list.length === 0) return;
      startTransition(async () => {
        const res = await bulkAssignInvoices(list, userId);
        if (res.success) {
          toast({
            title: `${res.processed} invoice${res.processed === 1 ? '' : 's'} reassigned`,
          });
          onCleared();
          router.refresh();
        } else {
          toast({
            title: 'Bulk assign failed',
            description: res.error,
            variant: 'destructive',
          });
        }
      });
    },
    [ids, toast, router, onCleared],
  );

  return { pending, archive, remove, changeStatus, markPaid, send, assign };
}
