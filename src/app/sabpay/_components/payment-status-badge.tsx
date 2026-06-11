import * as React from 'react';

import { Badge } from '@/components/sabcrm/20ui';
import type { SabpayPaymentStatus } from '@/lib/sabpay/types';

const STATUS_META: Record<
  SabpayPaymentStatus,
  { label: string; tone: 'neutral' | 'success' | 'danger' }
> = {
  created: { label: 'Awaiting payment', tone: 'neutral' },
  succeeded: { label: 'Succeeded', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
};

export function PaymentStatusBadge({ status }: { status: SabpayPaymentStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.created;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
