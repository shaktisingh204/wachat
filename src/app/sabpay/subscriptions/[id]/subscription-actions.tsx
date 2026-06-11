'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, XCircle } from 'lucide-react';

import { Button, SegmentedControl, toast } from '@/components/sabcrm/20ui';
import type { SabpaySubscription } from '@/lib/sabpay/types';

import {
  cancelSabpaySubscription,
  pauseSabpaySubscription,
  resumeSabpaySubscription,
} from '../../actions/subscriptions';
import { ConfirmAction } from '../../_components/confirm-action';

type CancelTiming = 'now' | 'cycle_end';

const CANCEL_TIMINGS: Array<{ value: CancelTiming; label: string }> = [
  { value: 'now', label: 'Cancel now' },
  { value: 'cycle_end', label: 'At cycle end' },
];

/** Statuses from which a subscription can still be cancelled. */
const CANCELLABLE = new Set(['created', 'authenticated', 'active', 'paused', 'halted']);

export function SubscriptionActions({
  subscription,
}: {
  subscription: SabpaySubscription;
}): React.JSX.Element | null {
  const router = useRouter();
  const [busy, setBusy] = React.useState<'pause' | 'resume' | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [timing, setTiming] = React.useState<CancelTiming>('now');

  const status = subscription.status;
  const canPause = status === 'active';
  const canResume = status === 'paused';
  const canCancel = CANCELLABLE.has(status);

  if (!canPause && !canResume && !canCancel) return null;

  async function handlePause() {
    if (busy) return;
    setBusy('pause');
    const result = await pauseSabpaySubscription(subscription.id);
    setBusy(null);
    if (result.error) {
      toast({ title: 'Could not pause the subscription', description: result.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Subscription paused', description: 'No further cycles will charge until you resume.', tone: 'success' });
    router.refresh();
  }

  async function handleResume() {
    if (busy) return;
    setBusy('resume');
    const result = await resumeSabpaySubscription(subscription.id);
    setBusy(null);
    if (result.error) {
      toast({ title: 'Could not resume the subscription', description: result.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Subscription resumed', description: 'Billing picks up from the next charge date.', tone: 'success' });
    router.refresh();
  }

  async function handleCancel() {
    const result = await cancelSabpaySubscription(subscription.id, timing === 'cycle_end');
    if (result.error) {
      toast({ title: 'Could not cancel the subscription', description: result.error, tone: 'danger' });
      return;
    }
    toast({
      title: timing === 'cycle_end' ? 'Cancellation scheduled' : 'Subscription cancelled',
      description:
        timing === 'cycle_end'
          ? 'It ends after the current billing cycle completes.'
          : 'No further cycles will be charged.',
      tone: 'success',
    });
    router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {canPause ? (
          <Button
            variant="secondary"
            iconLeft={<Pause size={15} />}
            loading={busy === 'pause'}
            disabled={busy !== null}
            onClick={handlePause}
          >
            Pause
          </Button>
        ) : null}
        {canResume ? (
          <Button
            variant="secondary"
            iconLeft={<Play size={15} />}
            loading={busy === 'resume'}
            disabled={busy !== null}
            onClick={handleResume}
          >
            Resume
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            variant="danger"
            iconLeft={<XCircle size={15} />}
            disabled={busy !== null}
            onClick={() => {
              setTiming('now');
              setCancelOpen(true);
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>

      <ConfirmAction
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel this subscription?"
        description={
          <span style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span>
              Cancelling stops future charges — this cannot be undone. Choose when it
              takes effect.
            </span>
            <SegmentedControl
              aria-label="When to cancel"
              items={CANCEL_TIMINGS}
              value={timing}
              onChange={setTiming}
            />
          </span>
        }
        confirmLabel={timing === 'cycle_end' ? 'Cancel at cycle end' : 'Cancel now'}
        tone="danger"
      />
    </>
  );
}
