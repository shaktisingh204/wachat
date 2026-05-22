import Link from "next/link";
import { Activity, AlertCircle, PlayCircle, CheckCircle2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  StatCard,
  Table,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableBody,
  ZoruTableCell,
  ZoruChart,
  ZoruChartContainer,
  ZORU_CHART_PALETTE,
} from "@/components/zoruui";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

const mockActiveCampaigns = [
  { id: "camp_1", name: "Black Friday Promo", status: "Sending", sent: 4500, target: 10000 },
  { id: "camp_2", name: "Welcome Series (Drip)", status: "Active", sent: 1250, target: "-" },
  { id: "camp_3", name: "Re-engagement Batch 4", status: "Scheduled", sent: 0, target: 5000 },
];

const mockSparklineData = [
  { val: 10 }, { val: 25 }, { val: 15 }, { val: 40 }, { val: 35 }, { val: 50 }, { val: 45 }
];

function Sparkline() {
  return (
    <ZoruChartContainer height={40} className="w-full mt-2">
      <ZoruChart.LineChart data={mockSparklineData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <ZoruChart.Line
          type="monotone"
          dataKey="val"
          stroke={ZORU_CHART_PALETTE[0]}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ZoruChart.LineChart>
    </ZoruChartContainer>
  );
}

export default function SabsmsOverviewPage() {
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard 
          label="Total Sent" 
          value="1,254,300" 
          delta={12.5} 
          period="vs last month"
          icon={<Activity />}
          chart={<Sparkline />}
        />
        <StatCard 
          label="Delivery Rate" 
          value="99.04%" 
          delta={0.2} 
          period="vs last month"
          icon={<CheckCircle2 />}
          chart={<Sparkline />}
        />
        <StatCard 
          label="Active Campaigns" 
          value="3" 
          delta={50} 
          period="vs last month"
          icon={<PlayCircle />}
          chart={<Sparkline />}
        />
        <StatCard 
          label="Failed Deliveries" 
          value="1,200" 
          delta={-1.2} 
          invertDelta
          period="vs last month"
          icon={<AlertCircle />}
          chart={<Sparkline />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3 mt-6">
        <Card className="shadow-sm flex flex-col xl:col-span-3">
          <ZoruCardHeader className="pb-4 border-b border-zoru-line">
            <ZoruCardTitle className="text-lg">Active Campaigns</ZoruCardTitle>
            <ZoruCardDescription>Currently running or scheduled.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0 flex-1">
            <div className="w-full overflow-hidden">
              <Table className="border-0 shadow-none rounded-none w-full">
                <ZoruTableHeader className="bg-zoru-surface-2/50 border-b border-zoru-line">
                  <ZoruTableRow className="border-none hover:bg-transparent">
                    <ZoruTableHead className="h-9">Campaign</ZoruTableHead>
                    <ZoruTableHead className="h-9">Status</ZoruTableHead>
                    <ZoruTableHead className="h-9 text-right">Sent / Target</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {mockActiveCampaigns.map((camp) => (
                    <ZoruTableRow key={camp.id} className="group">
                      <ZoruTableCell className="font-medium text-zoru-ink text-sm">
                        {camp.name}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge 
                          variant={camp.status === "Sending" ? "default" : "secondary"} 
                          className={`text-xs px-2 py-0.5 border-0 ${
                            camp.status === "Sending" ? "bg-zoru-success/15 text-zoru-success" : ""
                          }`}
                        >
                          {camp.status}
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-sm text-zoru-ink-muted group-hover:text-zoru-ink transition-colors">
                        {camp.sent.toLocaleString()} / {camp.target.toLocaleString()}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </Table>
            </div>
          </ZoruCardContent>
          <div className="p-4 border-t border-zoru-line bg-zoru-surface-2/30">
            <Button variant="ghost" className="w-full text-xs font-medium" asChild>
              <Link href="/sabsms/campaigns">View all campaigns →</Link>
            </Button>
          </div>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}
