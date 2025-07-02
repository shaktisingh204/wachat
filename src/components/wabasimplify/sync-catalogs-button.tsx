
'use client';

import { useTransition } from 'react';
import { syncCatalogs } from '@/app/actions/catalog.actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, LoaderCircle } from 'lucide-react';

interface SyncCatalogsButtonProps {
    projectId: string | null;
    onSyncComplete: () => void;
}

export function SyncCatalogsButton({ projectId, onSyncComplete }: SyncCatalogsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const onSync = () => {
    if (!projectId) {
        toast({ title: "Error", description: "No active project selected.", variant: "destructive" });
        return;
    }

    startTransition(async () => {
        const result = await syncCatalogs(projectId);
        if (result?.error) {
            toast({ title: 'Sync Error', description: result.error, variant: 'destructive' });
        }
        if (result?.message) {
            toast({ title: 'Sync Complete', description: result.message });
            onSyncComplete();
        }
    });
  };

  return (
    <Button onClick={onSync} variant="outline" disabled={isPending || !projectId}>
      {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
      Sync with Meta
    </Button>
  );
}
