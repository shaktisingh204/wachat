'use client';

import { Button, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/sabcrm/20ui';
import {
  useTransition,
  useState,
  useEffect } from 'react';
import { handleSubscribeAllProjects } from '@/app/actions/index.ts';
import { useToast } from '@/hooks/use-toast';

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
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isPending}>
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
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Subscribe All Projects?</AlertDialogTitle>
          <AlertDialogDescription>
            This will attempt to subscribe all projects to webhook events. Are you sure you want to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onSubscribe}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
