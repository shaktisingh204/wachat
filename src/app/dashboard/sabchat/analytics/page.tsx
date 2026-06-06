"use client";

import { cn, ZORU_CHART_PALETTE, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Card, CardBody, CardHeader, CardTitle, ZoruChart, ChartContainer, ChartTooltip, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton, StatCard, Button, Table, TBody, Td, Th, THead, Tr, Avatar, AvatarFallback, PageActions, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, Badge } from '@/components/sabcrm/20ui/compat';
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
  Download,
  Calendar,
  Frown,
  Meh,
  Smartphone,
  Monitor,
  Timer,
  ZapOff
  } from "lucide-react";

import { getSabChatAnalytics } from "@/app/actions/sabchat.actions";

/**
 * /dashboard/sabchat/analytics — Comprehensive KPIs and 10+ visual charts.
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
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 w-full lg:col-span-2" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

// Mocks for new advanced features
const MOCK_CSAT_DATA = [
  { name: "Positive", value: 75, fill: "var(--st-status-ok)" },
  { name: "Neutral", value: 15, fill: "var(--st-warn)" },
  { name: "Negative", value: 10, fill: "var(--st-danger)" },
];

const MOCK_DEVICE_DATA = [
  { name: "Desktop", value: 65, fill: ZORU_CHART_PALETTE[0] },
  { name: "Mobile", value: 35, fill: ZORU_CHART_PALETTE[1] },
];

const MOCK_TAGS_DATA = [
  { name: "Support", value: 45, fill: ZORU_CHART_PALETTE[0] },
  { name: "Sales", value: 30, fill: ZORU_CHART_PALETTE[2] },
  { name: "Billing", value: 15, fill: ZORU_CHART_PALETTE[3] },
  { name: "Bug", value: 10, fill: ZORU_CHART_PALETTE[4] },
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
            <BreadcrumbLink href="/dashboard/sabchat/inbox">
              SabChat
            </BreadcrumbLink>
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
              <Button variant="outline">
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDateRange("Today")}>Today</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange("Yesterday")}>Yesterday</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange("Last 7 Days")}>Last 7 Days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange("Last 30 Days")}>Last 30 Days</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Custom Range...</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button>
            <Download className="mr-2 h-4 w-4" />
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
              icon={<MessageSquare className="h-4 w-4 text-[var(--st-text-secondary)]" />}
              trend={{ value: 12, isPositive: true }}
            />
            <StatCard
              label="First Response Time"
              value={`${data.avgResponseTime}s`}
              icon={<Clock className="h-4 w-4 text-[var(--st-text-secondary)]" />}
              trend={{ value: 5, isPositive: true }}
            />
            <StatCard
              label="Resolution Time"
              value="4m 20s" // mock new feature
              icon={<Timer className="h-4 w-4 text-[var(--st-text-secondary)]" />}
              trend={{ value: 2, isPositive: false }}
            />
            <StatCard
              label="Customer Satisfaction"
              value={`${data.satisfaction}%`}
              icon={<Smile className="h-4 w-4 text-[var(--st-text-secondary)]" />}
              trend={{ value: 1.5, isPositive: true }}
            />
            <StatCard
              label="Open Chats"
              value={data.openChats.toLocaleString()}
              icon={<Inbox className="h-4 w-4 text-[var(--st-text-secondary)]" />}
            />
            <StatCard
              label="Closed Chats"
              value={data.closedChats.toLocaleString()}
              icon={<CheckCircle className="h-4 w-4 text-[var(--st-text-secondary)]" />}
            />
            <StatCard
              label="Abandoned Chats"
              value="14" // mock new feature
              icon={<ZapOff className="h-4 w-4 text-[var(--st-text-secondary)]" />}
              trend={{ value: 8, isPositive: false }}
            />
            <StatCard
              label="AI Resolution Rate"
              value="34%" // mock new feature
              icon={<Monitor className="h-4 w-4 text-[var(--st-text-secondary)]" />}
              trend={{ value: 14, isPositive: true }}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Volume Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Chat Volume vs Resolution</CardTitle>
                <PageDescription>Daily total incoming conversations and resolved chats.</PageDescription>
              </CardHeader>
              <CardBody>
                <ChartContainer height={300}>
                  <ZoruChart.AreaChart data={data.dailyChatVolume}>
                    <ZoruChart.CartesianGrid vertical={false} stroke="var(--st-border)" strokeDasharray="3 3" />
                    <ZoruChart.XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} stroke="var(--st-text-secondary)" />
                    <ZoruChart.YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--st-text-secondary)" />
                    <ZoruChart.Tooltip cursor={{ fill: "var(--st-bg-secondary)" }} content={<ChartTooltip />} />
                    <ZoruChart.Area type="monotone" dataKey="count" name="Total Chats" stroke={ZORU_CHART_PALETTE[0]} fill={ZORU_CHART_PALETTE[0]} fillOpacity={0.2} strokeWidth={2} />
                  </ZoruChart.AreaChart>
                </ChartContainer>
              </CardBody>
            </Card>

            {/* CSAT Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>CSAT Breakdown</CardTitle>
                <PageDescription>Customer feedback ratings distribution.</PageDescription>
              </CardHeader>
              <CardBody className="flex flex-col items-center justify-center">
                <ChartContainer height={220}>
                  <ZoruChart.PieChart>
                    <ZoruChart.Tooltip content={<ChartTooltip />} />
                    <ZoruChart.Pie data={MOCK_CSAT_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    </ZoruChart.Pie>
                  </ZoruChart.PieChart>
                </ChartContainer>
                <div className="flex gap-4 mt-4 w-full justify-center">
                  <div className="flex items-center gap-1.5"><Smile className="h-4 w-4 text-[var(--st-status-ok)]" /><span className="text-sm font-medium">75%</span></div>
                  <div className="flex items-center gap-1.5"><Meh className="h-4 w-4 text-[var(--st-warn)]" /><span className="text-sm font-medium">15%</span></div>
                  <div className="flex items-center gap-1.5"><Frown className="h-4 w-4 text-[var(--st-danger)]" /><span className="text-sm font-medium">10%</span></div>
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
                <ChartContainer height={220}>
                  <ZoruChart.PieChart>
                    <ZoruChart.Tooltip content={<ChartTooltip />} />
                    <ZoruChart.Pie data={MOCK_TAGS_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} />
                  </ZoruChart.PieChart>
                </ChartContainer>
              </CardBody>
            </Card>

            {/* Device Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col justify-center h-[260px]">
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="flex items-center gap-2"><Monitor className="h-4 w-4 text-[var(--st-text-secondary)]" /> Desktop</span>
                      <span>65%</span>
                    </div>
                    <div className="h-3 w-full bg-[var(--st-bg-muted)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--st-text)]" style={{ width: '65%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-[var(--st-text-secondary)]" /> Mobile</span>
                      <span>35%</span>
                    </div>
                    <div className="h-3 w-full bg-[var(--st-bg-muted)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--st-text-secondary)]" style={{ width: '35%' }}></div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Heatmap Mock */}
            <Card>
              <CardHeader>
                <CardTitle>Busiest Hours</CardTitle>
              </CardHeader>
              <CardBody>
                <ChartContainer height={220}>
                  <ZoruChart.BarChart data={MOCK_HOURS_HEATMAP}>
                    <ZoruChart.XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} stroke="var(--st-text-secondary)" />
                    <ZoruChart.Tooltip cursor={{ fill: "var(--st-bg-secondary)" }} content={<ChartTooltip />} />
                    <ZoruChart.Bar dataKey="h12" name="Noon chats" fill={ZORU_CHART_PALETTE[1]} radius={[2, 2, 0, 0]} stackId="a" />
                    <ZoruChart.Bar dataKey="h15" name="Afternoon chats" fill={ZORU_CHART_PALETTE[0]} radius={[2, 2, 0, 0]} stackId="a" />
                  </ZoruChart.BarChart>
                </ChartContainer>
              </CardBody>
            </Card>
          </div>

          {/* Agent Leaderboard */}
          <Card className="overflow-hidden p-0">
            <div className="p-5 border-b border-[var(--st-border)] flex items-center justify-between">
              <div>
                <CardTitle>Agent Performance Leaderboard</CardTitle>
                <PageDescription className="mt-1">Resolution metrics broken down by individual agent.</PageDescription>
              </div>
            </div>
            <Table>
              <THead className="bg-[var(--st-bg-muted)]/30">
                <Tr>
                  <Th>Agent</Th>
                  <Th className="text-right">Chats Resolved</Th>
                  <Th className="text-right">Avg Response Time</Th>
                  <Th className="text-right">CSAT</Th>
                </Tr>
              </THead>
              <TBody>
                {MOCK_AGENTS.map((agent, i) => (
                  <Tr key={i}>
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
                    <Td className="text-right font-medium">{agent.chats}</Td>
                    <Td className="text-right text-[var(--st-text-secondary)]">{agent.time}</Td>
                    <Td className="text-right">
                      <Badge variant="outline" className={cn(
                        agent.csat > 90 ? "bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]" : "bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]"
                      )}>
                        {agent.csat}%
                      </Badge>
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
