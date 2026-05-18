"use client";

import {
  ZORU_CHART_PALETTE,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruStatCard,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from "react";
import {
  CheckCircle,
  Clock,
  Inbox,
  MessageSquare,
  Smile,
  } from "lucide-react";

import { getSabChatAnalytics } from "@/app/actions/sabchat.actions";

/**
 * /dashboard/sabchat/analytics — KPI cards + chart.
 *
 * Same `getSabChatAnalytics` server action. Visual layer fully Zoru —
 * stat cards via ZoruStatCard, chart via ZoruChart family with the
 * greyscale palette (no rainbow).
 */

interface AnalyticsData {
  totalChats: number;
  openChats: number;
  closedChats: number;
  avgResponseTime: number;
  satisfaction: number;
  dailyChatVolume: Array<{ date: string; count: number }>;
}

function AnalyticsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <ZoruSkeleton className="h-80 w-full" />
    </div>
  );
}

export default function SabChatAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const analyticsData = await getSabChatAnalytics();
      setData(analyticsData as AnalyticsData);
    });
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/sabchat/inbox">
              SabChat
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Analytics</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Analytics</ZoruPageTitle>
          <ZoruPageDescription>
            SabChat performance metrics.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {isLoading || !data ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <ZoruStatCard
              label="Total chats"
              value={data.totalChats.toLocaleString()}
              icon={<MessageSquare />}
            />
            <ZoruStatCard
              label="Open chats"
              value={data.openChats.toLocaleString()}
              icon={<Inbox />}
            />
            <ZoruStatCard
              label="Closed chats"
              value={data.closedChats.toLocaleString()}
              icon={<CheckCircle />}
            />
            <ZoruStatCard
              label="Avg. first response"
              value={`${data.avgResponseTime}s`}
              icon={<Clock />}
            />
            <ZoruStatCard
              label="Customer satisfaction"
              value={`${data.satisfaction}%`}
              icon={<Smile />}
            />
          </div>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Daily chat volume</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <ZoruChartContainer height={280}>
                <ZoruChart.BarChart data={data.dailyChatVolume}>
                  <ZoruChart.CartesianGrid
                    vertical={false}
                    stroke="hsl(var(--zoru-line))"
                  />
                  <ZoruChart.XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    stroke="hsl(var(--zoru-ink-muted))"
                    fontSize={11}
                  />
                  <ZoruChart.YAxis
                    tickLine={false}
                    axisLine={false}
                    stroke="hsl(var(--zoru-ink-muted))"
                    fontSize={11}
                  />
                  <ZoruChart.Tooltip
                    cursor={{ fill: "hsl(var(--zoru-surface))" }}
                    content={<ZoruChartTooltip />}
                  />
                  <ZoruChart.Bar
                    dataKey="count"
                    name="Chats"
                    fill={ZORU_CHART_PALETTE[0]}
                    radius={[4, 4, 0, 0]}
                  />
                </ZoruChart.BarChart>
              </ZoruChartContainer>
            </ZoruCardContent>
          </ZoruCard>
        </>
      )}
    </div>
  );
}
