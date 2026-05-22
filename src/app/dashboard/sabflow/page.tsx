import * as React from "react";
import { 
  Activity, 
  CheckCircle2, 
  GitMerge, 
  AlertCircle, 
  Plus, 
  Play,
  MoreHorizontal
} from "lucide-react";
import { StatCard } from "@/components/zoruui/stat-card";
import { 
  PageHeader, 
  ZoruPageHeading, 
  ZoruPageTitle, 
  ZoruPageDescription, 
  ZoruPageActions 
} from "@/components/zoruui/page-header";
import { 
  Card, 
  ZoruCardHeader, 
  ZoruCardTitle, 
  ZoruCardDescription, 
  ZoruCardContent 
} from "@/components/zoruui/card";
import { 
  ZoruChart, 
  ZoruChartContainer, 
  ZoruChartTooltip 
} from "@/components/zoruui/chart";
import { Button } from "@/components/zoruui/button";
import { Badge } from "@/components/zoruui/badge";
import { 
  Table, 
  ZoruTableHeader, 
  ZoruTableRow, 
  ZoruTableHead, 
  ZoruTableBody, 
  ZoruTableCell 
} from "@/components/zoruui/table";
import Link from "next/link";

// Mock Data
const EXECUTION_DATA = [
  { time: "00:00", success: 120, failed: 2 },
  { time: "04:00", success: 150, failed: 5 },
  { time: "08:00", success: 320, failed: 10 },
  { time: "12:00", success: 450, failed: 15 },
  { time: "16:00", success: 380, failed: 8 },
  { time: "20:00", success: 210, failed: 4 },
  { time: "24:00", success: 180, failed: 3 },
];

const RECENT_ACTIVITY = [
  { id: "1", flow: "User Onboarding", status: "success", duration: "1.2s", time: "2 mins ago" },
  { id: "2", flow: "Daily Backup Sync", status: "failed", duration: "5.4s", time: "15 mins ago" },
  { id: "3", flow: "Lead Scoring", status: "success", duration: "0.8s", time: "1 hour ago" },
  { id: "4", flow: "Invoice Generator", status: "success", duration: "2.1s", time: "3 hours ago" },
  { id: "5", flow: "Slack Notification", status: "success", duration: "0.4s", time: "5 hours ago" },
];

export const dynamic = "force-dynamic";

export default function SabFlowIndexPage() {
  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      <PageHeader bordered={false}>
        <ZoruPageHeading>
          <ZoruPageTitle>Overview</ZoruPageTitle>
          <ZoruPageDescription>
            Monitor your Sabflow executions, active workflows, and system health.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline" leading={<Play className="w-4 h-4" />}>
            Run Flow
          </Button>
          <Button asChild leading={<Plus className="w-4 h-4" />}>
            <Link href="/dashboard/sabflow/flow-builder">
              New Flow
            </Link>
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Executions"
          value="12,482"
          delta={12.5}
          period="vs last month"
          icon={<Activity />}
        />
        <StatCard
          label="Success Rate"
          value="99.2%"
          delta={0.4}
          period="vs last month"
          icon={<CheckCircle2 />}
        />
        <StatCard
          label="Active Flows"
          value="48"
          delta={5}
          formatDelta={(d) => `+${d}`}
          period="new this week"
          icon={<GitMerge />}
        />
        <StatCard
          label="Error Rate"
          value="0.8%"
          delta={-0.1}
          period="vs last month"
          icon={<AlertCircle />}
          invertDelta
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <ZoruCardHeader>
            <ZoruCardTitle>Execution Volume</ZoruCardTitle>
            <ZoruCardDescription>
              Success vs failed executions over the last 24 hours.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ZoruChartContainer height={300}>
              <ZoruChart.AreaChart data={EXECUTION_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--zoru-success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--zoru-success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--zoru-danger))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--zoru-danger))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ZoruChart.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--zoru-line))" />
                <ZoruChart.XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "hsl(var(--zoru-ink-muted))", fontSize: 12 }} 
                  dy={10} 
                />
                <ZoruChart.YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "hsl(var(--zoru-ink-muted))", fontSize: 12 }} 
                />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Area 
                  type="monotone" 
                  dataKey="success" 
                  stroke="hsl(var(--zoru-success))" 
                  fillOpacity={1} 
                  fill="url(#colorSuccess)" 
                  strokeWidth={2}
                />
                <ZoruChart.Area 
                  type="monotone" 
                  dataKey="failed" 
                  stroke="hsl(var(--zoru-danger))" 
                  fillOpacity={1} 
                  fill="url(#colorFailed)" 
                  strokeWidth={2}
                />
              </ZoruChart.AreaChart>
            </ZoruChartContainer>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Recent Activity</ZoruCardTitle>
            <ZoruCardDescription>Latest flow executions.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0 sm:p-0">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Flow</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="text-right">Time</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {RECENT_ACTIVITY.map((activity) => (
                  <ZoruTableRow key={activity.id}>
                    <ZoruTableCell className="font-medium">
                      {activity.flow}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge 
                        tone={activity.status === "success" ? "green" : "red"}
                      >
                        {activity.status}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-zoru-ink-muted whitespace-nowrap">
                      {activity.time}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
            <div className="p-4 pt-2 border-t border-zoru-line mt-2 flex justify-center">
              <Button variant="ghost" size="sm" className="w-full text-zoru-ink-muted">
                View All Activity
              </Button>
            </div>
          </ZoruCardContent>
        </Card>
      </div>
    </div>
  );
}
