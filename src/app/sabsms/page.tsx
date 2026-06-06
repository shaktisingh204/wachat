import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Table,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableBody,
  ZoruTableCell,
} from "@/components/sabcrm/20ui/zoru";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { SabsmsDashboardWidgets, type MetricData } from "./_components/sabsms-dashboard-widgets";
const { getRedisClient } = require('@/lib/redis');

const mockActiveCampaigns = [
  { id: "camp_1", name: "Black Friday Promo", status: "Sending", sent: 4500, target: 10000 },
  { id: "camp_2", name: "Welcome Series (Drip)", status: "Active", sent: 1250, target: "-" },
  { id: "camp_3", name: "Re-engagement Batch 4", status: "Scheduled", sent: 0, target: 5000 },
];

async function getDashboardMetrics(): Promise<MetricData[]> {
  let redis;
  try {
    redis = await getRedisClient();
    const cached = await redis.get("sabsms:dashboard_metrics");
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error("Redis cache error:", e);
  }

  // Simulate complex aggregation from DB
  await new Promise(resolve => setTimeout(resolve, 800));

  const metrics: MetricData[] = [
    { id: "totalSent", label: "Total Sent", value: "1,254,300", delta: 12.5, period: "vs last month", iconName: "Activity" },
    { id: "deliveryRate", label: "Delivery Rate", value: "99.04%", delta: 0.2, period: "vs last month", iconName: "CheckCircle2" },
    { id: "activeCampaigns", label: "Active Campaigns", value: "3", delta: 50, period: "vs last month", iconName: "PlayCircle" },
    { id: "failedDeliveries", label: "Failed Deliveries", value: "1,200", delta: -1.2, invertDelta: true, period: "vs last month", iconName: "AlertCircle" },
    { id: "avgCost", label: "Avg Cost / SMS", value: "$0.008", delta: -5, invertDelta: true, period: "vs last month", iconName: "DollarSign" },
    { id: "conversionRate", label: "Conversion Rate", value: "4.2%", delta: 1.1, period: "vs last month", iconName: "TrendingUp" },
    { id: "unsubscribeRate", label: "Opt-out Rate", value: "0.1%", delta: 0, period: "vs last month", iconName: "UserMinus" }
  ];

  if (redis) {
    try {
      await redis.set("sabsms:dashboard_metrics", JSON.stringify(metrics), { EX: 60 });
    } catch (e) {
      console.error("Redis set error:", e);
    }
  }

  return metrics;
}

export default async function SabsmsOverviewPage() {
  const metrics = await getDashboardMetrics();

  return (
    <SabsmsPageShell
      title="Overview"
      description="SabSMS Dashboard: High-throughput, multi-provider messaging engine."
      primaryAction={{
        label: "New Campaign",
        href: "/sabsms/campaigns/new",
      }}
      secondaryActions={[
        { label: "System Logs", onSelectHref: "/sabsms/logs" }
      ]}
    >
      <SabsmsDashboardWidgets allMetrics={metrics} />

      <div className="grid gap-6 xl:grid-cols-3 mt-6">
        <Card className="shadow-sm flex flex-col xl:col-span-3">
          <ZoruCardHeader className="pb-4 border-b border-[var(--st-border)]">
            <ZoruCardTitle className="text-lg">Active Campaigns</ZoruCardTitle>
            <ZoruCardDescription>Currently running or scheduled.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0 flex-1">
            <div className="w-full overflow-hidden">
              <Table className="border-0 shadow-none rounded-none w-full">
                <ZoruTableHeader className="bg-[var(--st-bg-muted)]/50 border-b border-[var(--st-border)]">
                  <ZoruTableRow className="border-none hover:bg-transparent">
                    <ZoruTableHead className="h-9">Campaign</ZoruTableHead>
                    <ZoruTableHead className="h-9">Status</ZoruTableHead>
                    <ZoruTableHead className="h-9 text-right">Sent / Target</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {mockActiveCampaigns.map((camp) => (
                    <ZoruTableRow key={camp.id} className="group">
                      <ZoruTableCell className="font-medium text-[var(--st-text)] text-sm">
                        {camp.name}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge 
                          variant={camp.status === "Sending" ? "default" : "secondary"} 
                          className={`text-xs px-2 py-0.5 border-0 ${
                            camp.status === "Sending" ? "bg-[var(--st-status-ok)]/15 text-[var(--st-status-ok)]" : ""
                          }`}
                        >
                          {camp.status}
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-sm text-[var(--st-text-secondary)] group-hover:text-[var(--st-text)] transition-colors">
                        {camp.sent.toLocaleString()} / {camp.target.toLocaleString()}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </Table>
            </div>
          </ZoruCardContent>
          <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-muted)]/30">
            <Button variant="ghost" className="w-full text-xs font-medium" asChild>
              <Link href="/sabsms/campaigns">View all campaigns →</Link>
            </Button>
          </div>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}
