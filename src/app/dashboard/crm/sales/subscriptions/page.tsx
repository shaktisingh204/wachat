import Link from 'next/link';
import { ObjectId } from 'mongodb';
import { Repeat, Plus } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';

type AnySubscription = {
  _id?: { toString(): string } | string;
  planName?: string;
  name?: string;
  items?: Array<{ name?: string }>;
  accountId?: { toString(): string } | string;
  customerId?: { toString(): string } | string;
  customerName?: string;
  frequency?: string;
  interval?: string;
  intervalCount?: number;
  nextBillingAt?: string | Date;
  status?: string;
  startsAt?: string | Date;
  createdAt?: string | Date;
};

function formatDate(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function getStatusVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'completed') return 'success';
  if (s === 'paused' || s === 'draft') return 'ghost';
  if (s === 'cancelled' || s === 'voided' || s === 'past_due') return 'danger';
  return 'warning';
}

function getPlanName(sub: AnySubscription): string {
  if (sub.planName) return sub.planName;
  if (sub.name) return sub.name;
  if (Array.isArray(sub.items) && sub.items.length > 0) {
    const first = sub.items[0] as { name?: string } | undefined;
    if (first?.name) return first.name;
  }
  return 'Untitled subscription';
}

function getFrequency(sub: AnySubscription): string {
  if (sub.frequency) return sub.frequency;
  if (sub.interval) {
    const count = typeof sub.intervalCount === 'number' ? sub.intervalCount : 1;
    return count > 1 ? `Every ${count} ${sub.interval}` : sub.interval;
  }
  return '—';
}

async function resolveCustomerName(sub: AnySubscription): Promise<string> {
  if (sub.customerName) return sub.customerName;
  const rawId =
    (sub as any).accountId ?? (sub as any).customerId ?? null;
  const idStr =
    typeof rawId === 'string'
      ? rawId
      : rawId && typeof (rawId as any).toString === 'function'
        ? (rawId as any).toString()
        : null;
  if (!idStr) return '—';
  try {
    const account = await getCrmAccountById(idStr);
    if (account) {
      return (
        (account as any).name ||
        (account as any).companyName ||
        (account as any).displayName ||
        idStr
      );
    }
  } catch {
    // best-effort; fall through to raw id
  }
  return idStr;
}

export default async function SubscriptionsPage() {
  let subs: AnySubscription[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id);
      const docs = await db
        .collection('crm_subscriptions')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      subs = JSON.parse(JSON.stringify(docs)) as AnySubscription[];
    } catch (e) {
      console.error('Failed to load CRM subscriptions:', e);
      loadError = true;
    }
  }

  const customerNames = await Promise.all(subs.map((s) => resolveCustomerName(s)));

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Subscriptions & Recurring"
        subtitle="Manage recurring billing plans, renewals and dunning workflows."
        icon={Repeat}
        actions={
          <Link href="/dashboard/crm/sales/subscriptions/new">
            <ZoruButton variant="outline">
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New subscription
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All subscriptions</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Recurring billing plans attached to your customers.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Plan</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Customer</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Frequency</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Next billing</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Started</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load subscriptions. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : subs.length > 0 ? (
                subs.map((sub, idx) => {
                  const id =
                    typeof sub._id === 'string'
                      ? sub._id
                      : sub._id?.toString?.() ?? String(idx);
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        <Link
                          href={`/dashboard/crm/sales/subscriptions/${id}`}
                          className="hover:underline"
                        >
                          {getPlanName(sub)}
                        </Link>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {customerNames[idx] || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {getFrequency(sub)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate((sub as any).nextBillingAt)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(sub.status)}>
                          {sub.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate((sub as any).startsAt ?? sub.createdAt)}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No subscriptions yet. Create one to start recurring billing.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
