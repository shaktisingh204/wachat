'use client';

import { useToast } from '@/components/sabcrm/20ui/compat';
/**
 * useItemsBulk — bulk-action runner for the items list.
 *
 * Wraps `deleteCrmProduct` (the dual-impl action). Archive / bulk-edit /
 * adjust-stock / sync-price are stubbed to surface "not yet wired" toast
 * for now — Mongo schema doesn't ship a `status` column today, so archive
 * is best-effort via a follow-up patch action when that lands.
 */

import * as React from 'react';

import { deleteCrmProduct } from '@/app/actions/crm-products.actions';
import { useRouter } from 'next/navigation';

interface UseItemsBulkArgs {
  selected: Set<string>;
  onCleared: () => void;
}

export function useItemsBulk({ selected, onCleared }: UseItemsBulkArgs) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const run = React.useCallback(
    async (label: string, fn: (id: string) => Promise<{ success?: boolean; error?: string }>) => {
      if (selected.size === 0) {
        toast({ title: 'Nothing selected', description: 'Select rows first.' });
        return;
      }
      setPending(true);
      let ok = 0;
      let fail = 0;
      try {
        for (const id of selected) {
          try {
            const res = await fn(id);
            if (res?.success === false) fail += 1;
            else ok += 1;
          } catch {
            fail += 1;
          }
        }
        toast({
          title: `${label} complete`,
          description: `${ok} updated${fail ? ` · ${fail} failed` : ''}`,
          variant: fail ? 'destructive' : undefined,
        });
        onCleared();
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [selected, toast, router, onCleared],
  );

  const remove = React.useCallback(
    () => run('Delete', (id) => deleteCrmProduct(id)),
    [run],
  );

  const archive = React.useCallback(() => {
    // No archive action exists yet; surface as TODO so users don't think
    // it silently succeeded.
    toast({
      title: 'Archive not wired',
      description: 'Soft-archive landing once `saveCrmProduct` supports a status column.',
    });
  }, [toast]);

  const adjustStock = React.useCallback(() => {
    toast({
      title: 'Use Stock Adjustments',
      description: 'Bulk adjust opens one row at a time today; flow at /dashboard/crm/inventory/adjustments/new.',
    });
  }, [toast]);

  const syncPrice = React.useCallback(() => {
    toast({
      title: 'Sync price coming soon',
      description: 'Wire once batch-price update action ships.',
    });
  }, [toast]);

  const bulkEdit = React.useCallback(
    (field: string) =>
      toast({
        title: `Bulk edit ${field}`,
        description: 'Wire once batch-edit action ships.',
      }),
    [toast],
  );

  return {
    pending,
    remove,
    archive,
    adjustStock,
    syncPrice,
    bulkEdit,
  };
}
