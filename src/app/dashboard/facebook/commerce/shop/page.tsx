'use client';

import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  type BadgeTone,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { format,
  formatDistanceToNow } from 'date-fns';
import {
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
 * /dashboard/facebook/commerce/shop - Meta Commerce shop overview.
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
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return format(d, 'PP, p');
}

function statusTone(s?: string): BadgeTone {
  if (!s) return 'neutral';
  const v = s.toLowerCase();
  if (v === 'completed' || v === 'fulfilled' || v === 'shipped') return 'success';
  if (v.includes('pending') || v === 'created' || v === 'processing') return 'warning';
  if (v === 'cancelled' || v === 'canceled') return 'danger';
  if (v === 'refunded') return 'info';
  return 'neutral';
}

export default function CommerceShopPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useToast();

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
          toast.error('Carrier and tracking number are required.');
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
        toast.error(res.error ?? `Could not ${type} order.`);
        return;
      }
      toast.success(
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
          icon={Store}
          title="No project selected"
          description="Pick a project to view its commerce shop."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook/commerce/orders">
              Commerce
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Shop</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Shop</PageTitle>
          <PageDescription>
            Merchant settings and recent orders for the connected Meta Commerce
            account.
          </PageDescription>
        </PageHeaderHeading>
        <Button
          variant="ghost"
          onClick={refresh}
          disabled={loading}
          iconLeft={RefreshCw}
        >
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive" title="Could not load shop data">
          {error}
        </Alert>
      )}

      {/* Merchant settings card */}
      {loading && !settings ? (
        <Skeleton height="7rem" width="100%" />
      ) : (
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
              <Store className="h-5 w-5" aria-hidden="true" />
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
              <p className="text-[var(--st-text)]">{settings?.currency ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                Payout email
              </p>
              <p className="break-all text-[var(--st-text)]">
                {settings?.payout_email ?? settings?.email ?? '-'}
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

      {/* Recent orders */}
      <section className="mt-2">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-base text-[var(--st-text)]">Recent orders</h2>
        </header>

        {loading && orders.length === 0 ? (
          <div className="flex flex-col gap-2">
            <Skeleton height="3rem" width="100%" />
            <Skeleton height="3rem" width="100%" />
            <Skeleton height="3rem" width="100%" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="No recent orders"
            description="When buyers place orders through your Meta Commerce shop, they'll appear here."
          />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th>Order ID</Th>
                    <Th>Customer</Th>
                    <Th>Total</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th align="right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {orders.map((o) => (
                    <Tr key={o.id}>
                      <Td className="font-mono text-xs text-[var(--st-text)]">
                        {o.id}
                      </Td>
                      <Td>
                        <p className="text-[var(--st-text)]">
                          {o.buyer_details?.name ?? '-'}
                        </p>
                        <p className="text-xs text-[var(--st-text-secondary)]">
                          {o.buyer_details?.email ?? ''}
                        </p>
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {o.estimated_payment_details?.total_amount?.formatted_amount ??
                          '-'}
                      </Td>
                      <Td>
                        <Badge
                          tone={statusTone(o.order_status?.state)}
                          className="capitalize"
                        >
                          {o.order_status?.state?.replace(/_/g, ' ').toLowerCase() ??
                            '-'}
                        </Badge>
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">
                        <span title={safeDate(o.created)}>{safeWhen(o.created)}</span>
                      </Td>
                      <Td align="right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton
                              label="Order actions"
                              icon={MoreHorizontal}
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              iconLeft={CheckCircle2}
                              onSelect={() => openAction('fulfill', o)}
                            >
                              Fulfill
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              iconLeft={Undo2}
                              onSelect={() => openAction('refund', o)}
                            >
                              Refund
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="danger"
                              iconLeft={XCircle}
                              onSelect={() => openAction('cancel', o)}
                            >
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        )}
      </section>

      {/* Per-action confirm dialog */}
      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => !open && closeAction()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === 'fulfill'
                ? 'Fulfill this order?'
                : pendingAction?.type === 'cancel'
                ? 'Cancel this order?'
                : 'Refund this order?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Order{' '}
              <span className="font-mono">{pendingAction?.order.id}</span> for{' '}
              {pendingAction?.order.buyer_details?.name ?? 'the buyer'}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingAction?.type === 'fulfill' ? (
            <div className="space-y-3">
              <Field label="Carrier">
                <Input
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="UPS, FedEx, DHL"
                />
              </Field>
              <Field label="Tracking number">
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="1Z..."
                />
              </Field>
            </div>
          ) : (
            <Field label="Reason (optional)">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  pendingAction?.type === 'cancel'
                    ? 'Out of stock, customer request'
                    : 'Damaged item, customer request'
                }
              />
            </Field>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Back</AlertDialogCancel>
            <AlertDialogAction
              intent={pendingAction?.type === 'fulfill' ? 'primary' : 'danger'}
              onClick={(e) => {
                e.preventDefault();
                confirmAction();
              }}
              disabled={submitting}
            >
              {submitting
                ? 'Working...'
                : pendingAction?.type === 'fulfill'
                ? 'Fulfill order'
                : pendingAction?.type === 'cancel'
                ? 'Cancel order'
                : 'Issue refund'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
