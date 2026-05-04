"use client";

/**
 * /dashboard/facebook/commerce/shop — Meta Suite Commerce overview.
 *
 * KPI strip via ZoruStatCard, recent orders via ZoruDataTable, and
 * a connect-shop empty state. Same data sources as the previous
 * incarnation: getProjectById + getCommerceMerchantSettings +
 * getFacebookOrders. Pure ZoruUI primitives.
 */

import * as React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  ExternalLink,
  Eye,
  LoaderCircle,
  Package,
  RefreshCw,
  ShoppingBag,
  Store,
} from "lucide-react";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";

import {
  getCommerceMerchantSettings,
  getFacebookOrders,
} from "@/app/actions/facebook.actions";
import { getProjectById } from "@/app/actions/project.actions";
import type {
  CommerceMerchantSettings,
  FacebookOrder,
  Project,
  WithId,
} from "@/lib/definitions";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDataTable,
  ZoruEmptyState,
  ZoruSkeleton,
  ZoruStatCard,
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

function ShopSkeleton() {
  return (
    <CommercePage>
      <ZoruSkeleton className="h-3 w-64" />
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-3">
          <ZoruSkeleton className="h-3 w-24" />
          <ZoruSkeleton className="h-8 w-72" />
          <ZoruSkeleton className="h-4 w-96" />
        </div>
        <ZoruSkeleton className="h-9 w-32" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-28" />
        ))}
      </div>
      <ZoruSkeleton className="mt-8 h-64 w-full" />
    </CommercePage>
  );
}

export default function ShopOverviewPage() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [settings, setSettings] = useState<CommerceMerchantSettings | null>(null);
  const [orders, setOrders] = useState<FacebookOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

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
      const projectData = await getProjectById(storedProjectId);
      setProject(projectData as WithId<Project> | null);
      if (projectData?.facebookPageId) {
        const settingsResult = await getCommerceMerchantSettings(storedProjectId);
        if (settingsResult.error) {
          setError(settingsResult.error);
        } else {
          setSettings(settingsResult.settings || null);
          setError(null);
        }
        const ordersResult = await getFacebookOrders(storedProjectId);
        if (ordersResult.error) {
          setOrdersError(ordersResult.error);
        } else {
          setOrders(ordersResult.orders || []);
          setOrdersError(null);
        }
      }
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const total = orders.length;
    const fulfilled = orders.filter(
      (o) =>
        o.order_status?.state?.toLowerCase() === "completed" ||
        o.order_status?.state?.toLowerCase() === "fulfilled",
    ).length;
    const pending = orders.filter((o) =>
      (o.order_status?.state?.toLowerCase() ?? "").includes("pending"),
    ).length;
    const revenue = orders.reduce((sum, o) => {
      const v = parseFloat(o.estimated_payment_details?.total_amount?.amount || "0");
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    return { total, fulfilled, pending, revenue };
  }, [orders]);

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
            <ZoruBadge
              variant={statusVariant(s)}
              className="capitalize"
            >
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
    ],
    [],
  );

  if (isLoading && !project) {
    return <ShopSkeleton />;
  }

  return (
    <CommercePage>
      <CommerceBreadcrumb section="Commerce" pageLabel="Shop" />
      <CommerceHeader
        eyebrow="Meta Suite › Commerce"
        title="Shop overview"
        description="Manage your Facebook Shop and review recent orders coming through Meta Commerce."
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

      {!project && (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Pick a project to manage its Commerce settings.
          </ZoruAlertDescription>
        </ZoruAlert>
      )}

      {error && !error.includes("No Commerce Merchant Settings found") && (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Could not fetch shop status</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      {project ? (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ZoruStatCard
              label="Total orders"
              value={stats.total.toLocaleString()}
              icon={<Package />}
              period="all time"
            />
            <ZoruStatCard
              label="Fulfilled"
              value={stats.fulfilled.toLocaleString()}
              icon={<ShoppingBag />}
              period={`${stats.total ? Math.round((stats.fulfilled / stats.total) * 100) : 0}% of orders`}
            />
            <ZoruStatCard
              label="Pending"
              value={stats.pending.toLocaleString()}
              icon={<RefreshCw />}
              period={stats.pending ? "needs review" : "all clear"}
            />
            <ZoruStatCard
              label="Estimated revenue"
              value={
                stats.revenue
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency:
                        orders[0]?.estimated_payment_details?.total_amount
                          ?.currency || "USD",
                    }).format(stats.revenue)
                  : "—"
              }
              icon={<Store />}
              period="based on visible orders"
            />
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-3">
            {settings ? (
              <ZoruCard className="lg:col-span-1">
                <ZoruCardHeader>
                  <ZoruCardTitle>Shop is connected</ZoruCardTitle>
                  <ZoruCardDescription>
                    Your Facebook Shop is set up and powering SabNode commerce
                    features.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-2 text-sm text-zoru-ink">
                  <p>
                    <span className="text-zoru-ink-muted">Shop name:</span>{" "}
                    <span className="font-medium">{settings.display_name}</span>
                  </p>
                  {settings.shops?.data?.map((shop) => (
                    <p key={shop.id}>
                      <span className="text-zoru-ink-muted">Page shop:</span>{" "}
                      <a
                        href={shop.shop_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {shop.name}
                      </a>
                    </p>
                  ))}
                  <ZoruButton asChild size="sm" className="mt-3">
                    <a
                      href={settings.commerce_manager_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Commerce Manager <ExternalLink />
                    </a>
                  </ZoruButton>
                </ZoruCardContent>
              </ZoruCard>
            ) : (
              <ZoruCard className="lg:col-span-1">
                <ZoruCardHeader>
                  <ZoruCardTitle>Set up Facebook Shop</ZoruCardTitle>
                  <ZoruCardDescription>
                    Create a shop in Meta Commerce Manager to start selling.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <ZoruButton asChild size="sm">
                    <a
                      href={
                        project?.businessId
                          ? `https://business.facebook.com/commerce/${project.businessId}/`
                          : "https://business.facebook.com/commerce_manager/"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Go to Commerce Manager <ExternalLink />
                    </a>
                  </ZoruButton>
                </ZoruCardContent>
              </ZoruCard>
            )}

            <ZoruCard className="lg:col-span-2">
              <ZoruCardHeader>
                <ZoruCardTitle>Recent orders</ZoruCardTitle>
                <ZoruCardDescription>
                  Available for shops using Facebook or Instagram Checkout.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                {ordersError ? (
                  <ZoruAlert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>Could not fetch orders</ZoruAlertTitle>
                    <ZoruAlertDescription>{ordersError}</ZoruAlertDescription>
                  </ZoruAlert>
                ) : orders.length === 0 ? (
                  <ZoruEmptyState
                    icon={<Package />}
                    title="No orders yet"
                    description="Once shoppers place orders through your Facebook Shop, they will appear here."
                    action={
                      <ZoruButton asChild size="sm" variant="outline">
                        <a href="/dashboard/facebook/commerce/orders">
                          <Eye />
                          Open orders
                        </a>
                      </ZoruButton>
                    }
                  />
                ) : (
                  <ZoruDataTable
                    columns={columns}
                    data={orders.slice(0, 8)}
                    pageSize={8}
                    showColumnMenu={false}
                  />
                )}
              </ZoruCardContent>
            </ZoruCard>
          </section>
        </>
      ) : null}
    </CommercePage>
  );
}
