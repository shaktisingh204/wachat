'use client'

import { useState } from 'react';
import { Button } from '@/components/zoruui/button';
import { retryFailedMessages, cancelQueuedMessages } from './actions';
import { useZoruToast } from '@/components/zoruui/use-zoru-toast';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent } from '@/components/sabcrm/20ui/compat';

export function QueueActions() {
  const [loadingRetry, setLoadingRetry] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const { toast } = useZoruToast();

  async function onRetry() {
    try {
      setLoadingRetry(true);
      const res = await retryFailedMessages();
      toast({ title: 'Retried messages', description: `${res.count} messages queued for retry.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message });
    } finally {
      setLoadingRetry(false);
    }
  }

  async function onCancel() {
    try {
      setLoadingCancel(true);
      const res = await cancelQueuedMessages();
      toast({ title: 'Cancelled messages', description: `${res.count} messages cancelled.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message });
    } finally {
      setLoadingCancel(false);
    }
  }

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle>Queue Management</ZoruCardTitle>
        <ZoruCardDescription>
          Manually intervene in stuck queues or bulk retry failed sends.
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onRetry} disabled={loadingRetry || loadingCancel}>
          {loadingRetry ? 'Retrying...' : 'Retry All Failed'}
        </Button>
        <Button variant="destructive" onClick={onCancel} disabled={loadingCancel || loadingRetry}>
          {loadingCancel ? 'Cancelling...' : 'Cancel All Queued'}
        </Button>
      </ZoruCardContent>
    </Card>
  );
}
