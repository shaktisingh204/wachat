
'use client';

import { useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SyncLocalTemplatesButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const onSync = async () => {
    startTransition(async () => {
        toast({ title: 'Starting Sync...', description: 'Submitting local templates to Meta.' });
        try {
            const response = await fetch('/api/cron/sync-local-templates', { method: 'POST' });
            const result = await response.json();

            if (!response.ok) {
                 toast({ title: 'Sync Error', description: result.error || 'An unknown error occurred.', variant: 'destructive' });
            } else {
                 toast({ title: 'Sync Complete', description: result.message });
            }
        } catch (e: any) {
             toast({ title: 'Sync Failed', description: e.message, variant: 'destructive' });
        }
    });
  };

  return (
    <Button onClick={onSync} variant="outline" disabled={isPending}>
      {isPending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Syncing Templates...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Local Templates
        </>
      )}
    </Button>
  );
}
