
'use client';

import { useTransition } from 'react';
import { handleSyncWabas } from '@/app/actions/index.ts';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SyncProjectsButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  
  const onSync = () => {
    startTransition(async () => {
        const result = await handleSyncWabas();
        if (result?.error) {
            toast({
                title: 'Sync Error',
                description: result.error,
                variant: 'destructive',
            });
        }
        if (result?.message) {
            toast({
                title: 'Sync Complete',
                description: result.message,
            });
            router.refresh();
        }
    });
  };

  return (
    <Button onClick={onSync} variant="outline" disabled={isPending}>
      {isPending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Projects from Meta
        </>
      )}
    </Button>
  );
}
