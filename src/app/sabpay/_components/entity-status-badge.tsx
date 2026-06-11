import * as React from 'react';

import { Badge, type BadgeTone } from '@/components/sabcrm/20ui';

/**
 * One tone map for every SabPay entity status (payments, orders, refunds,
 * settlements, disputes, invoices, subscriptions, …). Unknown statuses fall
 * back to `neutral` so new backend states never crash a list page.
 */
const TONE_BY_STATUS: Record<string, BadgeTone> = {
  // success — money moved / thing is live
  paid: 'success',
  succeeded: 'success',
  processed: 'success',
  active: 'success',
  won: 'success',
  settled: 'success',
  issued: 'success',
  completed: 'success',
  credited: 'success',
  // danger — terminal failures
  failed: 'danger',
  lost: 'danger',
  cancelled: 'danger',
  halted: 'danger',
  expired: 'danger',
  closed: 'danger',
  // warning — needs attention / in flight
  under_review: 'warning',
  partial: 'warning',
  pending: 'warning',
  attempted: 'warning',
  paused: 'warning',
  // neutral — open / not yet acted on
  created: 'neutral',
  draft: 'neutral',
  open: 'neutral',
  authenticated: 'neutral',
};

/** "under_review" → "Under review"; "paid" → "Paid". */
function formatStatusLabel(status: string): string {
  const words = status.replace(/[_-]+/g, ' ').trim().toLowerCase();
  if (!words) return status;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Generic status pill for any SabPay entity. Accepts any string status —
 * tone comes from the shared map, label is title-cased.
 */
export function EntityStatusBadge({ status }: { status: string }): React.JSX.Element {
  const tone = TONE_BY_STATUS[status.toLowerCase()] ?? 'neutral';
  return <Badge tone={tone}>{formatStatusLabel(status)}</Badge>;
}
