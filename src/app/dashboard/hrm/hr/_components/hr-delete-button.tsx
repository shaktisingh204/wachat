'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import * as React from 'react';

export interface HrDeleteButtonProps {
  entityId: string;
  listHref: string;
  deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function HrDeleteButton({
  entityId,
  listHref,
  deleteAction,
}: HrDeleteButtonProps): React.JSX.Element {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [deleting, setDeleting] = React.useState(false);

  const handleConfirmDelete = React.useCallback(async () => {
    const res = await deleteAction(entityId);
    if (res.success) {
      toast({ title: 'Deleted' });
      router.push(listHref);
      router.refresh();
    } else {
      toast({
        title: 'Delete failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  }, [deleteAction, entityId, listHref, router, toast]);

  return (
    <>
      <ZoruButton
        variant="destructive"
        size="sm"
        onClick={() => setDeleting(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </ZoruButton>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this entry?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
