'use client';

/**
 * Client side of the Subscriptions list — owns the search box, the
 * table, and the hard-delete confirmation dialog. Search input is
 * debounced and writes back to the URL so the server component
 * re-fetches.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  AlertCircle,
  Pencil,
  Search,
  Trash2,
  LoaderCircle,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { deleteSubscriptionAction } from '@/app/actions/crm/subscriptions.actions';
import type {
  CrmSubscriptionDoc,
  CrmSubStatus,
} from '@/lib/rust-client/crm-subscriptions';

interface SubscriptionListClientProps {
  subscriptions: CrmSubscriptionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
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

function lineTotal(s: CrmSubscriptionDoc): {
  amount?: number;
  currency?: string;
} {
  const item = s.items?.[0];
  if (!item) return { amount: undefined, currency: undefined };
  const qty = typeof item.qty === 'number' ? item.qty : 0;
  const rate = typeof item.rate === 'number' ? item.rate : 0;
  return { amount: qty * rate, currency: item.currency };
}

function displayLabel(s: CrmSubscriptionDoc): string {
  return `Subscription ${String(s._id).slice(-6)}`;
}

export function SubscriptionListClient({
  subscriptions,
  page,
  limit,
  hasMore,
  initialQuery,
  error,
}: SubscriptionListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] =
    React.useState<CrmSubscriptionDoc | null>(null);
  const [deleting, startDelete] = React.useTransition();

  // Debounce search → URL.
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = displayLabel(pendingDelete);
    startDelete(async () => {
      const res = await deleteSubscriptionAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <ZoruInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by currency…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Customer</ZoruTableHead>
            <ZoruTableHead>Plan / Item</ZoruTableHead>
            <ZoruTableHead>Billing cycle</ZoruTableHead>
            <ZoruTableHead>Amount</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Next billing</ZoruTableHead>
            <ZoruTableHead>Started</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {subscriptions.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={8}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {initialQuery
                  ? 'No subscriptions match this search.'
                  : 'No subscriptions yet — click "New subscription" to add one.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            subscriptions.map((sub) => {
              const id = String(sub._id);
              const { amount, currency } = lineTotal(sub);
              const firstItemId = sub.items?.[0]?.itemId;
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    {sub.customerId ? (
                      <EntityPickerChip entity="client" id={sub.customerId} />
                    ) : (
                      <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <Link
                      href={`/dashboard/crm/sales/subscriptions/${id}`}
                      className="font-medium text-zoru-ink hover:underline"
                    >
                      {firstItemId ? (
                        <EntityPickerChip entity="item" id={firstItemId} />
                      ) : (
                        displayLabel(sub)
                      )}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {frequencyLabel(sub.frequency)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink">
                    {fmtMoney(amount, currency)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge variant={statusVariant(sub.status)}>
                      {sub.status}
                    </ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(sub.nextBillingAt)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(sub.startedAt || sub.createdAt || sub.audit?.createdAt)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link
                          href={`/dashboard/crm/sales/subscriptions/${id}/edit`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(sub)}
                        className="text-zoru-danger-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </ZoruTable>

      <PaginationBar page={page} limit={limit} hasMore={hasMore} />

      <ZoruAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete subscription?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes{' '}
              <strong>
                {pendingDelete ? displayLabel(pendingDelete) : ''}
              </strong>{' '}
              from the database. The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {deleting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </ZoruCard>
  );
}
