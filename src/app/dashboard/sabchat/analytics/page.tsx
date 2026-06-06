"use client";

import {
  CHART_PALETTE,
  type ChartConfig,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Recharts,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  PageActions,
  Skeleton,
  StatCard,
  Button,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Avatar,
  AvatarFallback,
  Progress,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/sabcrm/20ui";
import { useEffect, useState, useTransition } from "react";
import {
  CheckCircle,
  Clock,
  Inbox,
  MessageSquare,
  Smile,
  Download,
  Calendar,
  Frown,
  Meh,
  Smartphone,
  Monitor,
  Timer,
  ZapOff,
} from "lucide-react";

import { getSabChatAnalytics } from "@/app/actions/sabchat.actions";

/**
 * /dashboard/sabchat/analytics. Comprehensive KPIs and 10+ visual charts.
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={112} className="w-full" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton height={320} className="w-full lg:col-span-2" />
        <Skeleton height={320} className="w-full" />
      </div>
    </div>
  );
}

// Mocks for the advanced features below.
const MOCK_CSAT_DATA = [
  { name: "Positive", value: 75, fill: "var(--st-status-ok)" },
  { name: "Neutral", value: 15, fill: "var(--st-warn)" },
  { name: "Negative", value: 10, fill: "var(--st-danger)" },
];

const MOCK_TAGS_DATA = [
  { name: "Support", value: 45, fill: CHART_PALETTE[0] },
  { name: "Sales", value: 30, fill: CHART_PALETTE[2] },
  { name: "Billing", value: 15, fill: CHART_PALETTE[3] },
  { name: "Bug", value: 10, fill: CHART_PALETTE[4] },
];

const MOCK_DEVICE_DATA = [
  { name: "Desktop", value: 65, icon: Monitor, tone: "accent" as const },
  { name: "Mobile", value: 35, icon: Smartphone, tone: "success" as const },
];

const MOCK_AGENTS = [
  { name: "Alice Johnson", email: "alice@sabnode.com", chats: 142, csat: 98, time: "1m 12s" },
  { name: "Bob Smith", email: "bob@sabnode.com", chats: 89, csat: 92, time: "2m 05s" },
  { name: "Charlie Davis", email: "charlie@sabnode.com", chats: 76, csat: 88, time: "3m 41s" },
];

const MOCK_HOURS_HEATMAP = Array.from({ length: 7 }).map((_, d) => ({
  day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d],
  h9: Math.floor(Math.random() * 20),
  h12: Math.floor(Math.random() * 50) + 10,
  h15: Math.floor(Math.random() * 40) + 10,
  h18: Math.floor(Math.random() * 10),
}));

// Chart configs drive tooltip labels + per-series colours (20ui tokens).
const VOLUME_CONFIG: ChartConfig = {
  count: { label: "Total Chats", color: CHART_PALETTE[0] },
};
const CSAT_CONFIG: ChartConfig = {
  Positive: { label: "Positive", color: "var(--st-status-ok)" },
  Neutral: { label: "Neutral", color: "var(--st-warn)" },
  Negative: { label: "Negative", color: "var(--st-danger)" },
};
const TAGS_CONFIG: ChartConfig = {
  Support: { label: "Support", color: CHART_PALETTE[0] },
  Sales: { label: "Sales", color: CHART_PALETTE[2] },
  Billing: { label: "Billing", color: CHART_PALETTE[3] },
  Bug: { label: "Bug", color: CHART_PALETTE[4] },
};
const HOURS_CONFIG: ChartConfig = {
  h12: { label: "Noon chats", color: CHART_PALETTE[1] },
  h15: { label: "Afternoon chats", color: CHART_PALETTE[0] },
};

const DATE_RANGES = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days"];

export default function SabChatAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [dateRange, setDateRange] = useState("Last 7 Days");

  useEffect(() => {
    startLoading(async () => {
      const analyticsData = await getSabChatAnalytics();
      setData(analyticsData as AnalyticsData);
    });
  }, [dateRange]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/sabchat/inbox">SabChat</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Advanced Analytics</PageTitle>
          <PageDescription>
            Comprehensive insights into your support operations and visitor satisfaction.
          </PageDescription>
        </PageHeading>
        <PageActions className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" iconLeft={Calendar}>
                {dateRange}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {DATE_RANGES.map((range) => (
                <DropdownMenuItem key={range} onSelect={() => setDateRange(range)}>
                  {range}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem>Custom Range...</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="primary" iconLeft={Download}>
            Export CSV
          </Button>
        </PageActions>
      </PageHeader>

      {isLoading || !data ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          {/* Main KPIs (8 metrics) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Conversations"
              value={data.totalChats.toLocaleString()}
              icon={MessageSquare}
              delta={{ value: "+12%", tone: "up" }}
            />
            <StatCard
              label="First Response Time"
              value={`${data.avgResponseTime}s`}
              icon={Clock}
              delta={{ value: "+5%", tone: "up" }}
            />
            <StatCard
              label="Resolution Time"
              value="4m 20s"
              icon={Timer}
              delta={{ value: "-2%", tone: "down" }}
            />
            <StatCard
              label="Customer Satisfaction"
              value={`${data.satisfaction}%`}
              icon={Smile}
              delta={{ value: "+1.5%", tone: "up" }}
            />
            <StatCard
              label="Open Chats"
              value={data.openChats.toLocaleString()}
              icon={Inbox}
            />
            <StatCard
              label="Closed Chats"
              value={data.closedChats.toLocaleString()}
              icon={CheckCircle}
            />
            <StatCard
              label="Abandoned Chats"
              value="14"
              icon={ZapOff}
              delta={{ value: "-8%", tone: "down" }}
            />
            <StatCard
              label="AI Resolution Rate"
              value="34%"
              icon={Monitor}
              delta={{ value: "+14%", tone: "up" }}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Volume Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Chat Volume vs Resolution</CardTitle>
                <CardDescription>
                  Daily total incoming conversations and resolved chats.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <ChartContainer config={VOLUME_CONFIG} className="h-[300px] w-full">
                  <Recharts.AreaChart data={data.dailyChatVolume}>
                    <Recharts.CartesianGrid vertical={false} stroke="var(--st-border)" strokeDasharray="3 3" />
                    <Recharts.XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} stroke="var(--st-text-secondary)" />
                    <Recharts.YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--st-text-secondary)" />
                    <ChartTooltip cursor={{ fill: "var(--st-bg-secondary)" }} content={<ChartTooltipContent />} />
                    <Recharts.Area type="monotone" dataKey="count" name="count" stroke={CHART_PALETTE[0]} fill={CHART_PALETTE[0]} fillOpacity={0.2} strokeWidth={2} />
                  </Recharts.AreaChart>
                </ChartContainer>
              </CardBody>
            </Card>

            {/* CSAT Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>CSAT Breakdown</CardTitle>
                <CardDescription>Customer feedback ratings distribution.</CardDescription>
              </CardHeader>
              <CardBody className="flex flex-col items-center justify-center">
                <ChartContainer config={CSAT_CONFIG} className="h-[220px] w-full">
                  <Recharts.PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Recharts.Pie data={MOCK_CSAT_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                      {MOCK_CSAT_DATA.map((entry) => (
                        <Recharts.Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Recharts.Pie>
                  </Recharts.PieChart>
                </ChartContainer>
                <div className="mt-4 flex w-full justify-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Smile className="h-4 w-4 text-[var(--st-status-ok)]" aria-hidden="true" />
                    <span className="text-sm font-medium">75%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Meh className="h-4 w-4 text-[var(--st-warn)]" aria-hidden="true" />
                    <span className="text-sm font-medium">15%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Frown className="h-4 w-4 text-[var(--st-danger)]" aria-hidden="true" />
                    <span className="text-sm font-medium">10%</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Top Tags */}
            <Card>
              <CardHeader>
                <CardTitle>Top Tags</CardTitle>
              </CardHeader>
              <CardBody>
                <ChartContainer config={TAGS_CONFIG} className="h-[220px] w-full">
                  <Recharts.PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Recharts.Pie data={MOCK_TAGS_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                      {MOCK_TAGS_DATA.map((entry) => (
                        <Recharts.Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Recharts.Pie>
                  </Recharts.PieChart>
                </ChartContainer>
              </CardBody>
            </Card>

            {/* Device Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
              </CardHeader>
              <CardBody className="flex h-[260px] flex-col justify-center">
                <div className="space-y-6">
                  {MOCK_DEVICE_DATA.map((device) => {
                    const DeviceIcon = device.icon;
                    return (
                      <div key={device.name}>
                        <div className="mb-2 flex justify-between text-sm font-medium">
                          <span className="flex items-center gap-2">
                            <DeviceIcon className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                            {device.name}
                          </span>
                          <span>{device.value}%</span>
                        </div>
                        <Progress value={device.value} tone={device.tone} label={`${device.name} share`} />
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Busiest Hours */}
            <Card>
              <CardHeader>
                <CardTitle>Busiest Hours</CardTitle>
              </CardHeader>
              <CardBody>
                <ChartContainer config={HOURS_CONFIG} className="h-[220px] w-full">
                  <Recharts.BarChart data={MOCK_HOURS_HEATMAP}>
                    <Recharts.XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} stroke="var(--st-text-secondary)" />
                    <ChartTooltip cursor={{ fill: "var(--st-bg-secondary)" }} content={<ChartTooltipContent />} />
                    <Recharts.Bar dataKey="h12" name="h12" fill={CHART_PALETTE[1]} radius={[2, 2, 0, 0]} stackId="a" />
                    <Recharts.Bar dataKey="h15" name="h15" fill={CHART_PALETTE[0]} radius={[2, 2, 0, 0]} stackId="a" />
                  </Recharts.BarChart>
                </ChartContainer>
              </CardBody>
            </Card>
          </div>

          {/* Agent Leaderboard */}
          <Card padding="none" className="overflow-hidden">
            <CardHeader>
              <CardTitle>Agent Performance Leaderboard</CardTitle>
              <CardDescription>
                Resolution metrics broken down by individual agent.
              </CardDescription>
            </CardHeader>
            <Table>
              <THead>
                <Tr>
                  <Th>Agent</Th>
                  <Th align="right">Chats Resolved</Th>
                  <Th align="right">Avg Response Time</Th>
                  <Th align="right">CSAT</Th>
                </Tr>
              </THead>
              <TBody>
                {MOCK_AGENTS.map((agent) => (
                  <Tr key={agent.email}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-[var(--st-text)]">{agent.name}</div>
                          <div className="text-xs text-[var(--st-text-secondary)]">{agent.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td align="right" className="font-medium">{agent.chats}</Td>
                    <Td align="right" className="text-[var(--st-text-secondary)]">{agent.time}</Td>
                    <Td align="right">
                      <Badge tone={agent.csat >= 90 ? "success" : "warning"}>{agent.csat}%</Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
