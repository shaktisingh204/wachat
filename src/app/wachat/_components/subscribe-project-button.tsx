'use client';

/**
 * SubscribeProjectButton (wachat-local, ZoruUI).
 *
 * Replaces @/components/wabasimplify/subscribe-project-button. Same
 * server actions (handleSubscribeProjectWebhook, getProjectById), same
 * handler signature.
 */

import * as React from 'react';
import { useTransition } from 'react';
import { Loader2, Rss } from 'lucide-react';

import { handleSubscribeProjectWebhook } from '@/app/actions/whatsapp.actions';
import { getProjectById } from '@/app/actions/index.ts';

import { ZoruButton, useZoruToast } from '@/components/zoruui';

interface SubscribeProjectButtonProps {
  projectId: string;
  isActive: boolean;
  buttonText?: string;
}

export function SubscribeProjectButton({
  projectId,
  isActive,
  buttonText,
}: SubscribeProjectButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const onSubscribe = () => {
    startTransition(async () => {
      const project = await getProjectById(projectId);
      if (
        !project ||
        !project.wabaId ||
        !project.accessToken ||
        !project.appId
      ) {
        toast({
          title: 'Error',
          description:
            'Project is missing required WABA ID, App ID, or Access Token.',
          variant: 'destructive',
        });
        return;
      }

      const result = await handleSubscribeProjectWebhook(
        project.wabaId,
        project.appId,
        project.accessToken,
      );
      if (result?.error) {
        toast({
          title: 'Subscription Error',
          description: result.error,
          variant: 'destructive',
        });
      }
      if (result?.success) {
        toast({
          title: 'Subscription Success',
          description: 'Webhook subscription has been successfully updated.',
        });
      }
    });
  };

  const text = buttonText || (isActive ? 'Resubscribe' : 'Subscribe');

  return (
    <ZoruButton
      onClick={onSubscribe}
      variant="outline"
      size="sm"
      disabled={isPending}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <Rss />}
      {text}
    </ZoruButton>
  );
}
