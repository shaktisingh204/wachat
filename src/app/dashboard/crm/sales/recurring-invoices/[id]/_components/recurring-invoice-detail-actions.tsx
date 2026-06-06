'use client';

import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Play,
  Pause,
  StopCircle,
  Zap,
  LoaderCircle,
  Trash2,
} from 'lucide-react';

import {
  pauseRecurringInvoice,
  resumeRecurringInvoice,
  stopRecurringInvoice,
  runRecurringInvoiceNow,
  deleteRecurringInvoice,
} from '@/app/actions/worksuite/billing.actions';

interface Props {
  id: string;
  status: string;
  onRefresh?: () => void;
}

export function RecurringInvoiceDetailActions({ id, status }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isMutating, startMutating] = useTransition();

  const handle = useCallback(
    (
      fn: () => Promise<{ message?: string; error?: string }>,
      successTitle: string,
    ) => {
      startMutating(async () => {
        const res = await fn();
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
          return;
        }
        toast({ title: successTitle, description: res.message || 'Done.' });
        router.refresh();
      });
    },
    [router, toast],
  );

  const handleDelete = () => {
    if (!confirm('Delete this recurring invoice? This cannot be undone.')) return;
    startMutating(async () => {
      const r = await deleteRecurringInvoice(id);
      if (r.success) {
        toast({ title: 'Deleted', description: 'Recurring invoice removed.' });
        router.push('/dashboard/crm/sales/recurring-invoices');
      } else {
        toast({
          title: 'Error',
          description: r.error || 'Failed to delete',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <>
      <Button
        disabled={isMutating || status === 'stopped'}
        onClick={() => handle(() => runRecurringInvoiceNow(id), 'Invoice generated')}
      >
        {isMutating ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        Run now
      </Button>
      {status === 'active' ? (
        <Button
          variant="outline"
          onClick={() => handle(() => pauseRecurringInvoice(id), 'Paused')}
          disabled={isMutating}
        >
          <Pause className="h-4 w-4" />
          Pause
        </Button>
      ) : status === 'paused' ? (
        <Button
          variant="outline"
          onClick={() => handle(() => resumeRecurringInvoice(id), 'Resumed')}
          disabled={isMutating}
        >
          <Play className="h-4 w-4" />
          Resume
        </Button>
      ) : null}
      {status !== 'stopped' ? (
        <Button
          variant="outline"
          onClick={() => handle(() => stopRecurringInvoice(id), 'Stopped')}
          disabled={isMutating}
        >
          <StopCircle className="h-4 w-4" />
          Stop
        </Button>
      ) : null}
      <Button variant="outline" onClick={handleDelete} disabled={isMutating}>
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
    </>
  );
}
