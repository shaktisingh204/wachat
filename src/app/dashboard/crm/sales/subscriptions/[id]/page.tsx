import { Badge, Button, Card } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Subscription detail — `/dashboard/crm/sales/subscriptions/[id]`.
 *
 * Server component: hydrates the subscription via the Rust client and
 * resolves relational fields through `<EntityPickerChip>`. Edit lives
 * here; delete is on the list page.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getSubscription } from '@/app/actions/crm/subscriptions.actions';
import type {
  CrmSubscriptionDoc,
  CrmSubStatus,
} from '@/lib/rust-client/crm-subscriptions';

export const dynamic = 'force-dynamic';

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function frequencyLabel(f: CrmSubscriptionDoc['frequency']): string {
  switch (f) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'yearly':
      return 'Yearly';
    case 'custom':
      return 'Custom';
    default:
      return String(f);
  }
}

function statusVariant(
  s: CrmSubStatus,
): 'success' | 'warning' | 'danger' | 'ghost' | 'outline' {
  switch (s) {
    case 'active':
      return 'success';
    case 'trial':
      return 'warning';
    case 'past_due':
      return 'danger';
    case 'paused':
      return 'ghost';
    case 'cancelled':
    case 'expired':
      return 'outline';
    default:
      return 'outline';
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { subscription, error } = await getSubscription(id);

  if (!subscription) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this subscription — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/sales/subscriptions">
              <ArrowLeft className="h-4 w-4" /> Back to Subscriptions
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const firstItem = subscription.items?.[0];
  const lineTotal =
    firstItem && typeof firstItem.qty === 'number' && typeof firstItem.rate === 'number'
      ? firstItem.qty * firstItem.rate
      : undefined;

  return (
    <EntityDetailShell
      eyebrow="SUBSCRIPTION"
      title={`Subscription ${String(subscription._id).slice(-6)}`}
      back={{ href: '/dashboard/crm/sales/subscriptions', label: 'Subscriptions' }}
      actions={
        <ZoruButton asChild>
          <Link href={`/dashboard/crm/sales/subscriptions/${id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </ZoruButton>
      }
    >

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Customer & Plan
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer">
              {subscription.customerId ? (
                <EntityPickerChip
                  entity="client"
                  id={subscription.customerId}
                />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Plan / item">
              {firstItem?.itemId ? (
                <EntityPickerChip entity="item" id={firstItem.itemId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Quantity">
              {typeof firstItem?.qty === 'number' ? firstItem.qty : '—'}
            </Field>
            <Field label="Rate">
              {fmtMoney(firstItem?.rate, firstItem?.currency)}
            </Field>
            <Field label="Line total">
              {fmtMoney(lineTotal, firstItem?.currency)}
            </Field>
            <Field label="Currency">{firstItem?.currency || '—'}</Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Billing cadence
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Billing cycle">
              {frequencyLabel(subscription.frequency)}
            </Field>
            <Field label="Renewal mode">{subscription.renewalMode}</Field>
            <Field label="Proration">
              {subscription.prorationEnabled ? 'Enabled' : 'Disabled'}
            </Field>
            <Field label="Trial ends">{fmtDate(subscription.trialUntil)}</Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Lifecycle
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Status">
              <ZoruBadge variant={statusVariant(subscription.status)}>
                {subscription.status}
              </ZoruBadge>
            </Field>
            <Field label="Started">{fmtDate(subscription.startedAt)}</Field>
            <Field label="Next billing">
              {fmtDate(subscription.nextBillingAt)}
            </Field>
            <Field label="Paused until">
              {fmtDate(subscription.pausedUntil)}
            </Field>
            <Field label="Cancelled at">
              {fmtDate(subscription.cancelledAt)}
            </Field>
          </div>
        </ZoruCard>
      </div>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(subscription.createdAt || subscription.audit?.createdAt)} ·
        Updated {fmtDate(subscription.updatedAt || subscription.audit?.updatedAt)}
      </div>
    </EntityDetailShell>
  );
}
