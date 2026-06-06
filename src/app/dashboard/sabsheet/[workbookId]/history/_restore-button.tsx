'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui';
import { restoreSabsheetVersion } from '@/app/actions/sabsheet.actions';

export function RestoreButton({ versionId }: { versionId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await restoreSabsheetVersion(versionId);
          router.refresh();
        })
      }
    >
      {pending ? 'Restoring…' : 'Restore'}
    </Button>
  );
}
