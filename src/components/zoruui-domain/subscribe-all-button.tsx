'use client';

import {
  Button,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
} from '@/components/sabcrm/20ui/compat';
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
    <ZoruAlertDialog>
      <ZoruAlertDialogTrigger asChild>
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
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Subscribe All Projects?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            This will attempt to subscribe all projects to webhook events. Are you sure you want to proceed?
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction onClick={onSubscribe}>
            Continue
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
