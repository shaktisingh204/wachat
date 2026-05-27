'use client';

import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  useZoruToast,
} from '@/components/zoruui';

import { cancelSabcheckoutSubscription } from '@/app/actions/sabcheckout.actions';
import type { SabcheckoutSubscriptionDoc } from '@/lib/rust-client/sabcheckout-subscriptions';

export function SubscriptionsClient({
  initial,
}: {
  initial: SabcheckoutSubscriptionDoc[];
}) {
  const router = useRouter();
  const { toast } = useZoruToast();

  async function onCancel(id: string) {
    if (!confirm('Cancel this subscription?')) return;
    const res = await cancelSabcheckoutSubscription(id);
    if (!res.ok) {
      toast({ title: 'Cancel failed', description: res.error });
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <ZoruCardContent className="p-0">
        {initial.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--zoru-muted-fg)]">
            No subscriptions yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--zoru-border)]">
            {initial.map((s) => (
              <li
                key={s._id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3"
              >
                <div>
                  <p className="truncate text-sm font-medium">
                    {s.planId} → {s.customerId}
                  </p>
                  <p className="truncate text-xs text-[var(--zoru-muted-fg)]">
                    {new Date(s.currentPeriodStart).toLocaleDateString()} →{' '}
                    {new Date(s.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant={
                    s.status === 'active'
                      ? 'default'
                      : s.status === 'cancelled'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {s.status}
                </Badge>
                <span className="text-xs text-[var(--zoru-muted-fg)]">
                  {s.providerSubscriptionId ?? '—'}
                </span>
                {s.status !== 'cancelled' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancel(s._id)}
                    aria-label="Cancel subscription"
                  >
                    <XCircle className="size-4" />
                  </Button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}
      </ZoruCardContent>
    </Card>
  );
}
