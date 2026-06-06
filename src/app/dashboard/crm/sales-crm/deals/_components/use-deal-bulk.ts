'use client';

import { useToast } from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';

/**
 * useDealBulk — bulk-action handlers for the deals list. Each handler
 * funnels through `startBulkTransition` so the loading state is shared,
 * runs the appropriate server action, surfaces a toast, and refreshes
 * the router on success.
 */

import * as React from 'react';

import {
  bulkArchiveDeals,
  bulkAssignDeals,
  bulkChangeStage,
  bulkDeleteDeals,
} from '@/app/actions/crm-deals.actions';

interface UseDealBulkArgs {
  selected: Set<string>;
  onCleared: () => void;
}

export function useDealBulk({ selected, onCleared }: UseDealBulkArgs) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const archive = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkArchiveDeals(ids);
      if (res.success) {
        toast({ title: `${res.processed} deal${res.processed === 1 ? '' : 's'} archived` });
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
      const res = await bulkDeleteDeals(ids);
      if (res.success) {
        toast({ title: `${res.processed} deal${res.processed === 1 ? '' : 's'} deleted` });
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

  const changeStage = React.useCallback(
    (stage: string) => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      startTransition(async () => {
        const res = await bulkChangeStage(ids, stage);
        if (res.success) {
          toast({ title: `${res.processed} deal${res.processed === 1 ? '' : 's'} moved to ${stage}` });
          onCleared();
          router.refresh();
        } else {
          toast({
            title: 'Bulk stage change failed',
            description: res.error,
            variant: 'destructive',
          });
        }
      });
    },
    [selected, toast, router, onCleared],
  );

  const assign = React.useCallback(
    (userId: string | null) => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      startTransition(async () => {
        const res = await bulkAssignDeals(ids, userId);
        if (res.success) {
          toast({ title: `${res.processed} deal${res.processed === 1 ? '' : 's'} reassigned` });
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
    [selected, toast, router, onCleared],
  );

  return { pending, archive, remove, changeStage, assign };
}
