'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { format,
  formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  PackageCheck,
  RefreshCw,
  Store,
  Undo2,
  XCircle,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getCommerceMerchantSettings,
  getFacebookOrders,
  fulfillOrder,
  cancelOrder,
  refundOrder,
  } from '@/app/actions/facebook.actions';
import type { FacebookOrder } from '@/lib/definitions';

/**
 * /dashboard/facebook/commerce/shop — Meta Commerce shop overview.
 *
 * Header card surfaces merchant settings (display name, currency, payout
 * email) from `getCommerceMerchantSettings`, followed by a recent orders
 * table from `getFacebookOrders`. Each row has a fulfill / cancel / refund
 * action menu, each gated by a small confirm dialog before firing the
 * matching server action.
 */

import * as React from 'react';

interface MerchantSettings {
  display_name?: string;
  business_name?: string;
  email?: string;
  payout_email?: string;
  currency?: string;
  id?: string;
}

type OrderAction = 'fulfill' | 'cancel' | 'refund';

function safeWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function safeDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'PP · p');
}

function statusVariant(
  s?: string,
): 'success' | 'warning' | 'danger' | 'info' | 'ghost' {
  if (!s) return 'ghost';
  const v = s.toLowerCase();
  if (v === 'completed' || v === 'fulfilled' || v === 'shipped') return 'success';
  if (v.includes('pending') || v === 'created' || v === 'processing') return 'warning';
  if (v === 'cancelled' || v === 'canceled') return 'danger';
  if (v === 'refunded') return 'info';
  return 'ghost';
}

export default function CommerceShopPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [settings, setSettings] = useState<MerchantSettings | null>(null);
  const [orders, setOrders] = useState<FacebookOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const [pendingAction, setPendingAction] = useState<{
    type: OrderAction;
    order: FacebookOrder;
  } | null>(null);
  const [submitting, startSubmit] = useTransition();

  // Per-action inputs
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [reason, setReason] = useState('');

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const [s, o] = await Promise.all([
        getCommerceMerchantSettings(projectId),
        getFacebookOrders(projectId),
      ]);
      const errMsg = s.error ?? o.error ?? null;
      setError(errMsg);
      setSettings((s.settings as MerchantSettings | undefined) ?? null);
      setOrders(o.orders ?? []);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openAction = (type: OrderAction, order: FacebookOrder) => {
    setPendingAction({ type, order });
    setCarrier('');
    setTrackingNumber('');
    setReason('');
  };

  const closeAction = () => {
    if (submitting) return;
    setPendingAction(null);
  };

  const confirmAction = () => {
    if (!pendingAction) return;
    const { type, order } = pendingAction;
    startSubmit(async () => {
      let res: { success: boolean; error?: string };
      if (type === 'fulfill') {
        if (!carrier.trim() || !trackingNumber.trim()) {
          zoruSonnerToast.error('Carrier and tracking number are required.');
          return;
        }
        res = await fulfillOrder(order.id, projectId, {
          carrier: carrier.trim(),
          tracking_number: trackingNumber.trim(),
        });
      } else if (type === 'cancel') {
        res = await cancelOrder(order.id, projectId, reason.trim() || undefined);
      } else {
        res = await refundOrder(order.id, projectId, reason.trim() || undefined);
      }
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? `Could not ${type} order.`);
        return;
      }
      zoruSonnerToast.success(
        type === 'fulfill'
          ? 'Order fulfilled.'
          : type === 'cancel'
          ? 'Order cancelled.'
          : 'Refund issued.',
      );
      setPendingAction(null);
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Store />}
          title="No project selected"
          description="Pick a project to view its commerce shop."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook/commerce/orders">
              Commerce
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Shop</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Shop</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Merchant settings and recent orders for the connected Meta Commerce
            account.
          </p>
        </div>
        <ZoruButton variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </ZoruButton>
      </header>

      {error && (
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load shop data</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      {/* ── Merchant settings card ── */}
      {loading && !settings ? (
        <ZoruSkeleton className="h-28 w-full" />
      ) : (
        <ZoruCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zoru-surface-2 text-zoru-ink-muted">
              <Store className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-base text-zoru-ink">
                {settings?.display_name ?? settings?.business_name ?? 'Merchant'}
              </p>
              <p className="text-xs text-zoru-ink-muted">
                {settings?.id ? `ID ${settings.id}` : 'No merchant ID on record'}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                Currency
              </p>
              <p className="text-zoru-ink">{settings?.currency ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                Payout email
              </p>
              <p className="break-all text-zoru-ink">
                {settings?.payout_email ?? settings?.email ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                Orders loaded
              </p>
              <p className="text-zoru-ink">{orders.length}</p>
            </div>
          </div>
        </ZoruCard>
      )}

      {/* ── Recent orders ── */}
      <section className="mt-2">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-base text-zoru-ink">Recent orders</h2>
        </header>

        {loading && orders.length === 0 ? (
          <div className="flex flex-col gap-2">
            <ZoruSkeleton className="h-12 w-full" />
            <ZoruSkeleton className="h-12 w-full" />
            <ZoruSkeleton className="h-12 w-full" />
          </div>
        ) : orders.length === 0 ? (
          <ZoruEmptyState
            icon={<PackageCheck />}
            title="No recent orders"
            description="When buyers place orders through your Meta Commerce shop, they'll appear here."
          />
        ) : (
          <ZoruCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zoru-surface-2 text-left text-xs uppercase tracking-wide text-zoru-ink-subtle">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order ID</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zoru-line">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-mono text-xs text-zoru-ink">
                        {o.id}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-zoru-ink">
                          {o.buyer_details?.name ?? '—'}
                        </p>
                        <p className="text-xs text-zoru-ink-muted">
                          {o.buyer_details?.email ?? ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zoru-ink">
                        {o.estimated_payment_details?.total_amount?.formatted_amount ??
                          '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ZoruBadge
                          variant={statusVariant(o.order_status?.state)}
                          className="capitalize"
                        >
                          {o.order_status?.state?.replace(/_/g, ' ').toLowerCase() ??
                            '—'}
                        </ZoruBadge>
                      </td>
                      <td className="px-4 py-3 text-zoru-ink-muted">
                        <span title={safeDate(o.created)}>{safeWhen(o.created)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ZoruDropdownMenu>
                          <ZoruDropdownMenuTrigger asChild>
                            <ZoruButton
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Order actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </ZoruButton>
                          </ZoruDropdownMenuTrigger>
                          <ZoruDropdownMenuContent align="end">
                            <ZoruDropdownMenuItem onSelect={() => openAction('fulfill', o)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Fulfill
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem onSelect={() => openAction('refund', o)}>
                              <Undo2 className="mr-2 h-4 w-4" /> Refund
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem
                              onSelect={() => openAction('cancel', o)}
                              className="text-zoru-danger-ink"
                            >
                              <XCircle className="mr-2 h-4 w-4" /> Cancel
                            </ZoruDropdownMenuItem>
                          </ZoruDropdownMenuContent>
                        </ZoruDropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ZoruCard>
        )}
      </section>

      {/* ── Per-action confirm dialog ── */}
      <ZoruAlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => !open && closeAction()}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              {pendingAction?.type === 'fulfill'
                ? 'Fulfill this order?'
                : pendingAction?.type === 'cancel'
                ? 'Cancel this order?'
                : 'Refund this order?'}
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Order{' '}
              <span className="font-mono">{pendingAction?.order.id}</span> for{' '}
              {pendingAction?.order.buyer_details?.name ?? 'the buyer'}.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>

          {pendingAction?.type === 'fulfill' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <ZoruLabel htmlFor="ord-carrier">Carrier</ZoruLabel>
                <ZoruInput
                  id="ord-carrier"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="UPS, FedEx, DHL…"
                />
              </div>
              <div className="space-y-1.5">
                <ZoruLabel htmlFor="ord-tracking">Tracking number</ZoruLabel>
                <ZoruInput
                  id="ord-tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="1Z…"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="ord-reason">Reason (optional)</ZoruLabel>
              <ZoruInput
                id="ord-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  pendingAction?.type === 'cancel'
                    ? 'Out of stock, customer request, …'
                    : 'Damaged item, customer request, …'
                }
              />
            </div>
          )}

          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={submitting}>Back</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={confirmAction} disabled={submitting}>
              {submitting
                ? 'Working…'
                : pendingAction?.type === 'fulfill'
                ? 'Fulfill order'
                : pendingAction?.type === 'cancel'
                ? 'Cancel order'
                : 'Issue refund'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
