
'use client';

import { useTransition } from 'react';
import { handleSyncMetaFlows } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SyncMetaFlowsButtonProps {
    projectId: string | null;
    onSyncComplete: () => void;
}

export function SyncMetaFlowsButton({ projectId, onSyncComplete }: SyncMetaFlowsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const onSync = () => {
    if (!projectId) {
        toast({ title: "Error", description: "No active project selected.", variant: "destructive" });
        return;
    }

    startTransition(async () => {
        const result = await handleSyncMetaFlows(projectId);
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
            onSyncComplete();
        }
    });
  };

  return (
    <Button onClick={onSync} variant="outline" disabled={isPending || !projectId}>
      {isPending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync with Meta
        </>
      )}
    </Button>
  );
}
