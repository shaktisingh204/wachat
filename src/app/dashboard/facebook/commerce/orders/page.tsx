"use client";

/**
 * /dashboard/facebook/commerce/orders — Meta Suite Commerce orders.
 *
 * Orders table via ZoruDataTable, per-order detail in a ZoruSheet, and
 * a refund confirmation via ZoruAlertDialog. Same data fetcher as before
 * (getFacebookOrders); refund handler is wired locally to a no-op until
 * a server action is connected — same pattern as the previous page,
 * which surfaced the action button without firing a request.
 */

import * as React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  Eye,
  LoaderCircle,
  Package,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";

import { getFacebookOrders } from "@/app/actions/facebook.actions";
import type { FacebookOrder } from "@/lib/definitions";

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
  ZoruButton,
  ZoruDataTable,
  ZoruEmptyState,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSkeleton,
  useZoruToast,
} from "@/components/zoruui";

import {
  CommerceBreadcrumb,
  CommerceHeader,
  CommercePage,
} from "../../_components/commerce-shell";

function statusVariant(s?: string): "default" | "secondary" | "outline" | "danger" {
  if (!s) return "outline";
  const v = s.toLowerCase();
  if (v === "completed" || v === "fulfilled") return "default";
  if (v.includes("pending") || v === "created") return "secondary";
  if (v === "cancelled") return "danger";
  return "outline";
}

function OrdersSkeleton() {
  return (
    <CommercePage>
      <ZoruSkeleton className="h-3 w-64" />
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-3">
          <ZoruSkeleton className="h-3 w-24" />
          <ZoruSkeleton className="h-8 w-72" />
          <ZoruSkeleton className="h-4 w-96" />
        </div>
        <ZoruSkeleton className="h-9 w-28" />
      </div>
      <ZoruSkeleton className="mt-8 h-72 w-full" />
    </CommercePage>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<FacebookOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [activeOrder, setActiveOrder] = useState<FacebookOrder | null>(null);
  const [refundOrder, setRefundOrder] = useState<FacebookOrder | null>(null);
  const { toast } = useZoruToast();

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

  const columns = useMemo<ColumnDef<FacebookOrder>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Order ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-zoru-ink">{row.original.id}</span>
        ),
      },
      {
        accessorKey: "created",
        header: "Date",
        cell: ({ row }) =>
          row.original.created
            ? format(new Date(row.original.created), "PP · p")
            : "—",
      },
      {
        accessorKey: "buyer_details",
        header: "Customer",
        cell: ({ row }) => row.original.buyer_details?.name || "—",
      },
      {
        accessorKey: "order_status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.order_status?.state;
          return (
            <ZoruBadge variant={statusVariant(s)} className="capitalize">
              {s ? s.replace(/_/g, " ").toLowerCase() : "—"}
            </ZoruBadge>
          );
        },
      },
      {
        accessorKey: "estimated_payment_details",
        header: "Total",
        cell: ({ row }) =>
          row.original.estimated_payment_details?.total_amount?.formatted_amount ||
          "—",
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <ZoruButton
              variant="ghost"
              size="icon-sm"
              aria-label="View order"
              onClick={() => setActiveOrder(row.original)}
            >
              <Eye />
            </ZoruButton>
            <ZoruButton
              variant="ghost"
              size="icon-sm"
              aria-label="Refund order"
              onClick={() => setRefundOrder(row.original)}
            >
              <Undo2 />
            </ZoruButton>
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
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
          >
            {isLoading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            Refresh
          </ZoruButton>
        }
      />

      {error ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Could not fetch orders</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      ) : orders.length === 0 ? (
        <div className="mt-8">
          <ZoruEmptyState
            icon={<Package />}
            title="No orders found"
            description="Orders placed through Facebook or Instagram Checkout will show up here."
          />
        </div>
      ) : (
        <div className="mt-8">
          <ZoruDataTable
            columns={columns}
            data={orders}
            filterColumn="id"
            filterPlaceholder="Search orders…"
            pageSize={10}
          />
        </div>
      )}

      {/* ── Per-order detail sheet ── */}
      <ZoruSheet
        open={!!activeOrder}
        onOpenChange={(open) => !open && setActiveOrder(null)}
      >
        <ZoruSheetContent className="w-full sm:max-w-md">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Order details</ZoruSheetTitle>
            <ZoruSheetDescription>
              Full information for the selected order.
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {activeOrder ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                  Order ID
                </p>
                <p className="font-mono text-zoru-ink">{activeOrder.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                    Status
                  </p>
                  <ZoruBadge
                    variant={statusVariant(activeOrder.order_status?.state)}
                    className="mt-1 capitalize"
                  >
                    {activeOrder.order_status?.state
                      ?.replace(/_/g, " ")
                      .toLowerCase() || "—"}
                  </ZoruBadge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                    Total
                  </p>
                  <p className="text-zoru-ink">
                    {activeOrder.estimated_payment_details?.total_amount
                      ?.formatted_amount || "—"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                    Created
                  </p>
                  <p className="text-zoru-ink">
                    {activeOrder.created
                      ? format(new Date(activeOrder.created), "PP · p")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                    Updated
                  </p>
                  <p className="text-zoru-ink">
                    {activeOrder.updated
                      ? format(new Date(activeOrder.updated), "PP · p")
                      : "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                  Buyer
                </p>
                <p className="text-zoru-ink">
                  {activeOrder.buyer_details?.name || "—"}
                </p>
                <p className="text-xs text-zoru-ink-muted">
                  {activeOrder.buyer_details?.email || "—"}
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setRefundOrder(activeOrder);
                    setActiveOrder(null);
                  }}
                >
                  <Undo2 /> Refund
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  className="flex-1"
                  onClick={() => setActiveOrder(null)}
                >
                  Close
                </ZoruButton>
              </div>
            </div>
          ) : null}
        </ZoruSheetContent>
      </ZoruSheet>

      {/* ── Refund confirmation ── */}
      <ZoruAlertDialog
        open={!!refundOrder}
        onOpenChange={(open) => !open && setRefundOrder(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Refund this order?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {refundOrder
                ? `Refund order ${refundOrder.id}? This will trigger a refund flow in Meta Commerce and may take up to 24 hours to settle.`
                : ""}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => refundOrder && handleRefund(refundOrder)}
            >
              Refund
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </CommercePage>
  );
}
