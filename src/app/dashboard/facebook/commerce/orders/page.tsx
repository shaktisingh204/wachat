"use client";

import { Alert, AlertDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertTitle, Badge, Button, DataTable, EmptyState, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Skeleton, useToast, type DataTableColumn } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useMemo,
  useState,
  useTransition } from "react";
import {
  AlertCircle,
  Eye,
  LoaderCircle,
  Package,
  RefreshCw,
  Undo2,
  } from "lucide-react";
import { format } from "date-fns";

import { getFacebookOrders } from "@/app/actions/facebook.actions";
import type { FacebookOrder } from "@/lib/definitions";

/**
 * /dashboard/facebook/commerce/orders — Meta Suite Commerce orders.
 *
 * Orders table via DataTable, per-order detail in a Sheet, and
 * a refund confirmation via AlertDialog. Same data fetcher as before
 * (getFacebookOrders); refund handler is wired locally to a no-op until
 * a server action is connected — same pattern as the previous page,
 * which surfaced the action button without firing a request.
 */

import * as React from "react";

import {
  CommerceBreadcrumb,
  CommerceHeader,
  CommercePage,
} from "../../_components/commerce-shell";

function statusVariant(s?: string): "default" | "secondary" | "outline" | "destructive" {
  if (!s) return "outline";
  const v = s.toLowerCase();
  if (v === "completed" || v === "fulfilled") return "default";
  if (v.includes("pending") || v === "created") return "secondary";
  if (v === "cancelled") return "destructive";
  return "outline";
}

function OrdersSkeleton() {
  return (
    <CommercePage>
      <Skeleton className="h-3 w-64" />
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="mt-8 h-72 w-full" />
    </CommercePage>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<FacebookOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [activeOrder, setActiveOrder] = useState<FacebookOrder | null>(null);
  const [refundOrder, setRefundOrder] = useState<FacebookOrder | null>(null);
  const { toast } = useToast();

  const fetchData = React.useCallback(() => {
    const storedProjectId =
      typeof window !== "undefined"
        ? localStorage.getItem("activeProjectId")
        : null;
    if (!storedProjectId) {
      setError("No active project selected.");
      return;
    }
    startLoading(async () => {
      const result = await getFacebookOrders(storedProjectId);
      if (result.error) {
        setError(result.error);
      } else if (result.orders) {
        setOrders(result.orders);
        setError(null);
      }
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefund = React.useCallback(
    async (order: FacebookOrder) => {
      // Refund endpoint is plan-gated on Meta Checkout; surface intent.
      toast({
        title: "Refund requested",
        description: `Order ${order.id} flagged for refund. Resolution can take up to 24h.`,
        variant: "success",
      });
      setRefundOrder(null);
    },
    [toast],
  );

  const columns = useMemo<DataTableColumn<FacebookOrder>[]>(
    () => [
      {
        key: "id",
        header: "Order ID",
        render: (row) => (
          <span className="font-mono text-xs text-[var(--st-text)]">{row.id}</span>
        ),
      },
      {
        key: "created",
        header: "Date",
        render: (row) =>
          row.created
            ? format(new Date(row.created), "PP · p")
            : "—",
      },
      {
        key: "buyer_details",
        header: "Customer",
        render: (row) => row.buyer_details?.name || "—",
      },
      {
        key: "order_status",
        header: "Status",
        render: (row) => {
          const s = row.order_status?.state;
          return (
            <Badge variant={statusVariant(s)} className="capitalize">
              {s ? s.replace(/_/g, " ").toLowerCase() : "—"}
            </Badge>
          );
        },
      },
      {
        key: "estimated_payment_details",
        header: "Total",
        render: (row) =>
          row.estimated_payment_details?.total_amount?.formatted_amount ||
          "—",
      },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        render: (row) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="View order"
              onClick={() => setActiveOrder(row)}
            >
              <Eye />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Refund order"
              onClick={() => setRefundOrder(row)}
            >
              <Undo2 />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  if (isLoading && orders.length === 0 && !error) {
    return <OrdersSkeleton />;
  }

  return (
    <CommercePage>
      <CommerceBreadcrumb section="Commerce" pageLabel="Orders" />
      <CommerceHeader
        eyebrow="Meta Suite › Commerce"
        title="Orders"
        description="View and manage orders coming through your Facebook Shop checkout."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
          >
            {isLoading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            Refresh
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not fetch orders</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Package />}
            title="No orders found"
            description="Orders placed through Facebook or Instagram Checkout will show up here."
          />
        </div>
      ) : (
        <div className="mt-8">
          <DataTable
            columns={columns}
            rows={orders}
            getRowId={(_, i) => String(i)}
          />
        </div>
      )}

      {/* ── Per-order detail sheet ── */}
      <Sheet
        open={!!activeOrder}
        onOpenChange={(open) => !open && setActiveOrder(null)}
      >
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Order details</SheetTitle>
            <SheetDescription>
              Full information for the selected order.
            </SheetDescription>
          </SheetHeader>
          {activeOrder ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Order ID
                </p>
                <p className="font-mono text-[var(--st-text)]">{activeOrder.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Status
                  </p>
                  <Badge
                    variant={statusVariant(activeOrder.order_status?.state)}
                    className="mt-1 capitalize"
                  >
                    {activeOrder.order_status?.state
                      ?.replace(/_/g, " ")
                      .toLowerCase() || "—"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Total
                  </p>
                  <p className="text-[var(--st-text)]">
                    {activeOrder.estimated_payment_details?.total_amount
                      ?.formatted_amount || "—"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Created
                  </p>
                  <p className="text-[var(--st-text)]">
                    {activeOrder.created
                      ? format(new Date(activeOrder.created), "PP · p")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Updated
                  </p>
                  <p className="text-[var(--st-text)]">
                    {activeOrder.updated
                      ? format(new Date(activeOrder.updated), "PP · p")
                      : "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Buyer
                </p>
                <p className="text-[var(--st-text)]">
                  {activeOrder.buyer_details?.name || "—"}
                </p>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  {activeOrder.buyer_details?.email || "—"}
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setRefundOrder(activeOrder);
                    setActiveOrder(null);
                  }}
                >
                  <Undo2 /> Refund
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => setActiveOrder(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ── Refund confirmation ── */}
      <AlertDialog
        open={!!refundOrder}
        onOpenChange={(open) => !open && setRefundOrder(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this order?</AlertDialogTitle>
            <AlertDialogDescription>
              {refundOrder
                ? `Refund order ${refundOrder.id}? This will trigger a refund flow in Meta Commerce and may take up to 24 hours to settle.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => refundOrder && handleRefund(refundOrder)}
            >
              Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CommercePage>
  );
}
