"use client";

import { Card, CardBody, ChartContainer, EmptyState, Skeleton, ZORU_CHART_PALETTE } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsResp } from "@/lib/rust-client/telegram-webhooks";
import { TelegramProjectGate } from "../../_components/telegram-project-gate";
import { ACCENT } from "./utils";

export function AnalyticsSection({
  loading,
  analytics,
}: {
  loading: boolean;
  analytics: AnalyticsResp | null;
}) {
  if (loading) {
    return <Skeleton className="h-72 w-full" />;
  }
  if (!analytics) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-8 w-8" />}
        title="No analytics yet"
        description="Once deliveries arrive this section shows the 7-day trend."
      />
    );
  }
  const palette = ZORU_CHART_PALETTE;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <TelegramProjectGate />
      <Card className="xl:col-span-2">
        <CardBody className="p-4">
          <h3 className="mb-2 text-sm font-medium">
            Deliveries & failures by day
          </h3>
          <ChartContainer config={{}} className="h-64 w-full">
            <LineChart data={analytics.byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <RechartsTooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="received"
                stroke={ACCENT}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="processed"
                stroke={palette[1]}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="failed"
                stroke={palette[3]}
                strokeWidth={2}
              />
            </LineChart>
          </ChartContainer>
        </CardBody>
      </Card>
      <Card>
        <CardBody className="p-4">
          <h3 className="mb-2 text-sm font-medium">By event type</h3>
          {analytics.byEventType.length === 0 ? (
            <p className="text-xs text-[var(--st-text-secondary)]">No data yet.</p>
          ) : (
            <ChartContainer config={{}} className="h-64 w-full">
              <PieChart>
                <Pie
                  data={analytics.byEventType}
                  dataKey="count"
                  nameKey="eventType"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                >
                  {analytics.byEventType.map((_, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ChartContainer>
          )}
        </CardBody>
      </Card>
      <Card className="xl:col-span-3">
        <CardBody className="p-4">
          <h3 className="mb-2 text-sm font-medium">Top event types</h3>
          {analytics.byEventType.length === 0 ? (
            <p className="text-xs text-[var(--st-text-secondary)]">No data yet.</p>
          ) : (
            <ChartContainer config={{}} className="h-56 w-full">
              <BarChart data={analytics.byEventType.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="eventType" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="count" fill={ACCENT} />
              </BarChart>
            </ChartContainer>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
