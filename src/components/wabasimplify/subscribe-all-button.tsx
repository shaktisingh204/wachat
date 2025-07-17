
'use client';

import { useTransition } from 'react';
import { handleSubscribeAllProjects } from '@/app/actions/index';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Rss, LoaderCircle } from 'lucide-react';

export function SubscribeAllButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const onSubscribe = () => {
    startTransition(async () => {
        toast({
            title: 'Starting Subscription...',
            description: 'Attempting to subscribe all projects to webhook events.',
        });
        const result = await handleSubscribeAllProjects();
        if (result?.error) {
            toast({
                title: 'Subscription Error',
                description: result.error,
                variant: 'destructive',
            });
        }
        if (result?.message) {
            toast({
                title: 'Subscription Process Complete',
                description: result.message,
            });
        }
    });
  };

  return (
    <Button onClick={onSubscribe} variant="outline" disabled={isPending}>
      {isPending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Subscribing...
        </>
      ) : (
        <>
          <Rss className="mr-2 h-4 w-4" />
          Subscribe All to Webhooks
        </>
      )}
    </Button>
  );
}
