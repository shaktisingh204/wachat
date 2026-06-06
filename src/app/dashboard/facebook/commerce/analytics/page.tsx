"use client";

import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, ZoruChart, ChartContainer, ChartTooltip, ZORU_CHART_PALETTE, DataTable, EmptyState, Skeleton, StatCard } from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from "react";
import { format,
  subDays } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  BarChart3,
  Coins,
  LoaderCircle,
  Package,
  RefreshCw,
  ShoppingBag,
  Users,
  } from "lucide-react";

import { getFacebookOrders } from "@/app/actions/facebook.actions";
import type { FacebookOrder } from "@/lib/definitions";

/**
 * /dashboard/facebook/commerce/analytics — Meta Suite Commerce
 * analytics.
 *
 * Same data source as the orders page (`getFacebookOrders`). We derive
 * a 30-day order/revenue trend, status mix and a top-buyers breakdown
 * client-side — no separate analytics endpoint.
 *
 * Pure ZoruUI primitives. Charts use ZORU_CHART_PALETTE and series are
 * differentiated by stroke-dasharray (no hue).
 */

import * as React from "react";

import {
  CommerceBreadcrumb,
  CommerceHeader,
  CommercePage,
} from "../../_components/commerce-shell";

type DailyPoint = { date: string; orders: number; revenue: number };
type StatusRow = { status: string; count: number };
type BuyerRow = { name: string; orders: number; revenue: number };

function AnalyticsSkeleton() {
  return (
    <CommercePage>
      <Skeleton className="h-3 w-72" />
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72 w-full" />
      <Skeleton className="mt-6 h-48 w-full" />
    </CommercePage>
  );
}

export default function CommerceAnalyticsPage() {
  const [orders, setOrders] = useState<FacebookOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const fetchData = useCallback(() => {
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

  const currency = useMemo(() => {
    return (
      orders.find(
        (o) => o.estimated_payment_details?.total_amount?.currency,
      )?.estimated_payment_details?.total_amount?.currency || "USD"
    );
  }, [orders]);

  const stats = useMemo(() => {
    const total = orders.length;
    const fulfilled = orders.filter(
      (o) =>
        o.order_status?.state?.toLowerCase() === "completed" ||
        o.order_status?.state?.toLowerCase() === "fulfilled",
    ).length;
    const revenue = orders.reduce((sum, o) => {
      const v = parseFloat(o.estimated_payment_details?.total_amount?.amount || "0");
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const buyers = new Set(
      orders.map((o) => o.buyer_details?.name).filter(Boolean) as string[],
    );
    const aov = total ? revenue / total : 0;
    return { total, fulfilled, revenue, uniqueBuyers: buyers.size, aov };
  }, [orders]);

  const trend = useMemo<DailyPoint[]>(() => {
    const buckets = new Map<string, { orders: number; revenue: number }>();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(now, i), "MMM d");
      buckets.set(d, { orders: 0, revenue: 0 });
    }
    for (const o of orders) {
      if (!o.created) continue;
      const d = format(new Date(o.created), "MMM d");
      const slot = buckets.get(d);
      if (!slot) continue;
      slot.orders += 1;
      const v = parseFloat(
        o.estimated_payment_details?.total_amount?.amount || "0",
      );
      slot.revenue += Number.isFinite(v) ? v : 0;
    }
    return Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      orders: v.orders,
      revenue: Math.round(v.revenue * 100) / 100,
    }));
  }, [orders]);

  const statusMix = useMemo<StatusRow[]>(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const s = o.order_status?.state?.toLowerCase() ?? "unknown";
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  const topBuyers = useMemo<BuyerRow[]>(() => {
    const map = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      const name = o.buyer_details?.name ?? "Unknown";
      const slot = map.get(name) ?? { orders: 0, revenue: 0 };
      slot.orders += 1;
      const v = parseFloat(
        o.estimated_payment_details?.total_amount?.amount || "0",
      );
      slot.revenue += Number.isFinite(v) ? v : 0;
      map.set(name, slot);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [orders]);

  const buyerColumns = useMemo<ColumnDef<BuyerRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Customer",
        cell: ({ row }) => (
          <span className="font-medium text-[var(--st-text)]">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "orders",
        header: "Orders",
        cell: ({ row }) => row.original.orders.toLocaleString(),
      },
      {
        accessorKey: "revenue",
        header: "Revenue",
        cell: ({ row }) =>
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
          }).format(row.original.revenue),
      },
    ],
    [currency],
  );

  const statusColumns = useMemo<ColumnDef<StatusRow>[]>(
    () => [
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.status.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "count",
        header: "Orders",
        cell: ({ row }) => row.original.count.toLocaleString(),
      },
      {
        id: "share",
        header: "Share",
        cell: ({ row }) => {
          const total = orders.length || 1;
          return `${Math.round((row.original.count / total) * 100)}%`;
        },
      },
    ],
    [orders.length],
  );

  if (isLoading && orders.length === 0 && !error) {
    return <AnalyticsSkeleton />;
  }

  return (
    <CommercePage>
      <CommerceBreadcrumb section="Commerce" pageLabel="Analytics" />
      <CommerceHeader
        eyebrow="Meta Suite › Commerce"
        title="Commerce analytics"
        description="Track shop performance, sales velocity and customer mix derived from your Facebook orders."
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
          <AlertTitle>Could not fetch analytics</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* ── KPI strip ── */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Orders (all time)"
          value={stats.total.toLocaleString()}
          icon={<Package />}
          period={`${stats.fulfilled.toLocaleString()} fulfilled`}
        />
        <StatCard
          label="Revenue"
          value={
            stats.revenue
              ? new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency,
                }).format(stats.revenue)
              : "—"
          }
          icon={<Coins />}
          period="based on visible orders"
        />
        <StatCard
          label="Avg. order value"
          value={
            stats.aov
              ? new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency,
                }).format(stats.aov)
              : "—"
          }
          icon={<ShoppingBag />}
          period={stats.total ? `across ${stats.total} orders` : "no orders"}
        />
        <StatCard
          label="Unique buyers"
          value={stats.uniqueBuyers.toLocaleString()}
          icon={<Users />}
          period="distinct customer names"
        />
      </section>

      {/* ── Trend chart (greyscale) ── */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Last 30 days
          </CardTitle>
          <CardDescription>
            Daily order count and revenue. Series differentiated by line
            pattern, not colour.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {orders.length === 0 ? (
            <EmptyState
              compact
              icon={<BarChart3 />}
              title="No orders yet"
              description="Once shoppers place orders through your Facebook Shop, the trend will populate here."
            />
          ) : (
            <ChartContainer height={320}>
              <ZoruChart.LineChart data={trend}>
                <ZoruChart.CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--st-border)"
                />
                <ZoruChart.XAxis
                  dataKey="date"
                  stroke="var(--st-text-tertiary)"
                  tick={{ fontSize: 11 }}
                />
                <ZoruChart.YAxis
                  yAxisId="orders"
                  stroke="var(--st-text-tertiary)"
                  tick={{ fontSize: 11 }}
                />
                <ZoruChart.YAxis
                  yAxisId="revenue"
                  orientation="right"
                  stroke="var(--st-text-tertiary)"
                  tick={{ fontSize: 11 }}
                />
                <ZoruChart.Tooltip content={<ChartTooltip />} />
                <ZoruChart.Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="line"
                />
                <ZoruChart.Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke={ZORU_CHART_PALETTE[0]}
                  strokeDasharray="0"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <ZoruChart.Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke={ZORU_CHART_PALETTE[1]}
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ZoruChart.LineChart>
            </ChartContainer>
          )}
        </CardBody>
      </Card>

      {/* ── Breakdowns ── */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status mix</CardTitle>
            <CardDescription>
              How orders are distributed across lifecycle states.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {statusMix.length === 0 ? (
              <EmptyState
                compact
                icon={<Package />}
                title="No status data"
                description="Order statuses will appear here once orders are recorded."
              />
            ) : (
              <DataTable
                columns={statusColumns}
                data={statusMix}
                pageSize={6}
                showColumnMenu={false}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top customers</CardTitle>
            <CardDescription>
              Highest-revenue buyers (max 10) across all visible orders.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {topBuyers.length === 0 ? (
              <EmptyState
                compact
                icon={<Users />}
                title="No customer data"
                description="Customer breakdown will appear here once orders are recorded."
              />
            ) : (
              <DataTable
                columns={buyerColumns}
                data={topBuyers}
                pageSize={6}
                showColumnMenu={false}
              />
            )}
          </CardBody>
        </Card>
      </section>
    </CommercePage>
  );
}
