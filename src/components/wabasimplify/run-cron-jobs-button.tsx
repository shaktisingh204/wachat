
'use client';

import { useTransition } from 'react';
import { handleRunCron } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Play, LoaderCircle } from 'lucide-react';

export function RunCronJobsButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const onRun = () => {
    startTransition(async () => {
        toast({
            title: 'Starting Cron Jobs...',
            description: 'Manually triggering the broadcast and webhook processors.',
        });
        const result = await handleRunCron();
        if (result?.error) {
            toast({
                title: 'Cron Run Error',
                description: result.error,
                variant: 'destructive',
            });
        }
        if (result?.message) {
            toast({
                title: 'Cron Run Complete',
                description: result.message,
            });
        }
    });
  };

  return (
    <Button onClick={onRun} variant="outline" disabled={isPending}>
      {isPending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Running...
        </>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          Run All Cron Jobs
        </>
      )}
    </Button>
  );
}
