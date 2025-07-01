'use client';

import { useTransition } from 'react';
import { handleSubscribeProjectWebhook } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Rss, LoaderCircle } from 'lucide-react';
import type { WithId } from 'mongodb';
import type { Project } from '@/app/actions';

interface SubscribeProjectButtonProps {
  projectId: string;
}

export function SubscribeProjectButton({ projectId }: SubscribeProjectButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const onSubscribe = () => {
    startTransition(async () => {
        const result = await handleSubscribeProjectWebhook(projectId);
        if (result?.error) {
            toast({
                title: 'Subscription Error',
                description: result.error,
                variant: 'destructive',
            });
        }
        if (result?.message) {
            toast({
                title: 'Subscription Success',
                description: result.message,
            });
        }
    });
  };

  return (
    <Button onClick={onSubscribe} variant="outline" size="sm" disabled={isPending}>
      {isPending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Rss className="mr-2 h-4 w-4" />
      )}
      Subscribe
    </Button>
  );
}
