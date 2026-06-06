'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { refreshDatasetAction } from '@/app/actions/analytics-bi.actions';
import { Button } from '@/components/sabcrm/20ui';

export function RefreshButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      onClick={() =>
        startTransition(async () => {
          await refreshDatasetAction(id);
          router.refresh();
        })
      }
      disabled={pending}
    >
      {pending ? 'Refreshing…' : 'Refresh'}
    </Button>
  );
}
