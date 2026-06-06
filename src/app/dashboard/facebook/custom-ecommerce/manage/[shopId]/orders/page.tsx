"use client";

import { Alert, AlertDescription, AlertTitle, Badge, Button, DataTable, EmptyState, Separator, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Skeleton } from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { AlertCircle,
  Eye,
  LoaderCircle,
  Package,
  RefreshCw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import {
  getEcommOrders,
  getEcommShopById,
  } from "@/app/actions/custom-ecommerce.actions";
import type { EcommOrder,
  EcommShop } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * /dashboard/facebook/custom-ecommerce/manage/[shopId]/orders
 *
 * Per-shop orders table built on `ZoruDataTable` with a per-order detail
 * sheet. Same data fetchers as before — only the visual layer changes.
 */

import * as React from "react";

function statusVariant(s?: string): "default" | "secondary" | "outline" | "danger" {
  if (!s) return "outline";
  const v = s.toLowerCase();
  if (v === "paid" || v === "shipped" || v === "delivered") return "default";
  if (v === "pending") return "secondary";
  if (v === "cancelled") return "danger";
  return "outline";
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export default function OrdersPage() {
  const params = useParams();
  const shopId = params?.shopId as string | undefined;
  const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
  const [orders, setOrders] = useState<WithId<EcommOrder>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [activeOrder, setActiveOrder] = useState<WithId<EcommOrder> | null>(
    null,
  );

  const fetchData = useCallback(() => {
    if (!shopId) return;
    startLoading(async () => {
      const [shopData, ordersData] = await Promise.all([
        getEcommShopById(shopId),
        getEcommOrders(shopId),
      ]);
      setShop(shopData);
      setOrders(ordersData);
    });
  }, [shopId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currency = shop?.currency || "USD";
  const formatMoney = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }),
    [currency],
  );

  const columns = useMemo<ColumnDef<WithId<EcommOrder>>[]>(
    () => [
      {
        accessorKey: "_id",
        header: "Order ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[var(--st-text)]">
            {row.original._id.toString().slice(-8)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) =>
          row.original.createdAt
            ? format(new Date(row.original.createdAt), "PP · p")
            : "—",
      },
      {
        accessorKey: "customerInfo",
        header: "Customer",
        cell: ({ row }) => row.original.customerInfo?.name || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={statusVariant(row.original.status)}
            className="capitalize"
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => formatMoney.format(row.original.total),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="View order"
              onClick={() => setActiveOrder(row.original)}
            >
              <Eye />
            </Button>
          </div>
        ),
      },
    ],
    [formatMoney],
  );

  if (isLoading && orders.length === 0 && !shop) {
    return <PageSkeleton />;
  }

  if (!shop) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Shop not found</AlertTitle>
        <AlertDescription>
          Please select a valid shop to manage its orders.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] tracking-tight text-[var(--st-text)]">Orders</h2>
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            View and manage orders from your custom shop.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchData}
          disabled={isLoading}
          size="sm"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          Refresh
        </Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="No orders yet"
          description="Orders placed in your shop will show up here."
        />
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          filterPlaceholder="Search orders…"
          pageSize={10}
        />
      )}

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
                <p className="font-mono text-[var(--st-text)]">
                  {activeOrder._id.toString()}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Status
                  </p>
                  <Badge
                    variant={statusVariant(activeOrder.status)}
                    className="mt-1 capitalize"
                  >
                    {activeOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Total
                  </p>
                  <p className="text-[var(--st-text)]">
                    {formatMoney.format(activeOrder.total)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Created
                  </p>
                  <p className="text-[var(--st-text)]">
                    {activeOrder.createdAt
                      ? format(new Date(activeOrder.createdAt), "PP · p")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Payment
                  </p>
                  <p className="capitalize text-[var(--st-text)]">
                    {activeOrder.paymentStatus || "—"}
                  </p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Customer
                </p>
                <p className="text-[var(--st-text)]">
                  {activeOrder.customerInfo?.name || "—"}
                </p>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  {activeOrder.customerInfo?.email || "—"}
                </p>
                {activeOrder.customerInfo?.phone ? (
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    {activeOrder.customerInfo.phone}
                  </p>
                ) : null}
              </div>
              <Separator />
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Items
                </p>
                <ul className="mt-2 space-y-1.5">
                  {activeOrder.items.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-[var(--st-text)]"
                    >
                      <span className="truncate">
                        {item.productName}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      </span>
                      <span className="text-[var(--st-text-secondary)]">
                        {formatMoney.format(item.price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {activeOrder.shippingAddress ? (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                      Shipping address
                    </p>
                    <p className="text-[var(--st-text)]">
                      {activeOrder.shippingAddress.street}
                    </p>
                    <p className="text-[var(--st-text)]">
                      {activeOrder.shippingAddress.city},{" "}
                      {activeOrder.shippingAddress.state}{" "}
                      {activeOrder.shippingAddress.zip}
                    </p>
                    <p className="text-[var(--st-text-secondary)]">
                      {activeOrder.shippingAddress.country}
                    </p>
                  </div>
                </>
              ) : null}
              <div className="pt-2">
                <Button
                  block
                  size="sm"
                  onClick={() => setActiveOrder(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
