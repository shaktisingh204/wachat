'use client';

import {
  Alert,
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
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  Label,
  Skeleton,
  zoruSonnerToast,
} from '@/components/sabcrm/20ui/compat';
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
        <EmptyState
          icon={<Store />}
          title="No project selected"
          description="Pick a project to view its commerce shop."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
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
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Shop</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Merchant settings and recent orders for the connected Meta Commerce
            account.
          </p>
        </div>
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load shop data</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {/* ── Merchant settings card ── */}
      {loading && !settings ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
              <Store className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-base text-[var(--st-text)]">
                {settings?.display_name ?? settings?.business_name ?? 'Merchant'}
              </p>
              <p className="text-xs text-[var(--st-text-secondary)]">
                {settings?.id ? `ID ${settings.id}` : 'No merchant ID on record'}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                Currency
              </p>
              <p className="text-[var(--st-text)]">{settings?.currency ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                Payout email
              </p>
              <p className="break-all text-[var(--st-text)]">
                {settings?.payout_email ?? settings?.email ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                Orders loaded
              </p>
              <p className="text-[var(--st-text)]">{orders.length}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Recent orders ── */}
      <section className="mt-2">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-base text-[var(--st-text)]">Recent orders</h2>
        </header>

        {loading && orders.length === 0 ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<PackageCheck />}
            title="No recent orders"
            description="When buyers place orders through your Meta Commerce shop, they'll appear here."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--st-bg-muted)] text-left text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order ID</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--st-border)]">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--st-text)]">
                        {o.id}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[var(--st-text)]">
                          {o.buyer_details?.name ?? '—'}
                        </p>
                        <p className="text-xs text-[var(--st-text-secondary)]">
                          {o.buyer_details?.email ?? ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[var(--st-text)]">
                        {o.estimated_payment_details?.total_amount?.formatted_amount ??
                          '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={statusVariant(o.order_status?.state)}
                          className="capitalize"
                        >
                          {o.order_status?.state?.replace(/_/g, ' ').toLowerCase() ??
                            '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--st-text-secondary)]">
                        <span title={safeDate(o.created)}>{safeWhen(o.created)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <ZoruDropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Order actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
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
                              className="text-[var(--st-danger)]"
                            >
                              <XCircle className="mr-2 h-4 w-4" /> Cancel
                            </ZoruDropdownMenuItem>
                          </ZoruDropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
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
                <Label htmlFor="ord-carrier">Carrier</Label>
                <Input
                  id="ord-carrier"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="UPS, FedEx, DHL…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ord-tracking">Tracking number</Label>
                <Input
                  id="ord-tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="1Z…"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="ord-reason">Reason (optional)</Label>
              <Input
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
