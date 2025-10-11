
'use client';

import { useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Play, LoaderCircle } from 'lucide-react';

async function triggerAllCrons() {
    const endpoints = [
        '/api/cron/send-broadcasts',
        '/api/cron/process-webhooks',
        '/api/cron/sync-local-templates',
        '/api/cron/post-randomizer',
        '/api/cron/send-scheduled-emails',
        '/api/cron/abandoned-cart-reminder',
    ];

    const results = await Promise.allSettled(
        endpoints.map(endpoint => fetch(endpoint, { method: 'POST' }).then(res => res.json()))
    );
    
    return results;
}

export function RunCronJobsButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const onRun = () => {
    startTransition(async () => {
        toast({
            title: 'Starting All Cron Jobs...',
            description: 'Manually triggering all scheduled background tasks.',
        });
        
        const results = await triggerAllCrons();
        
        results.forEach((result, index) => {
            const endpoint = ['Broadcasts', 'Webhooks', 'Templates', 'Randomizer', 'Emails', 'Carts'][index];
            if (result.status === 'fulfilled') {
                console.log(`Cron success for ${endpoint}:`, result.value.message);
            } else {
                 console.error(`Cron failure for ${endpoint}:`, result.reason);
            }
        });

        toast({
            title: 'Cron Run Complete',
            description: 'All jobs have been triggered. Check console for details.',
        });
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
