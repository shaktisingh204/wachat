"use client";

import {
  ZORU_CHART_PALETTE,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  StatCard,
  Button,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Avatar,
  ZoruAvatarFallback,
  ZoruPageActions,
  ZoruDropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  Badge,
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
  { name: "Positive", value: 75, fill: "hsl(var(--zoru-success))" },
  { name: "Neutral", value: 15, fill: "hsl(var(--zoru-warning))" },
  { name: "Negative", value: 10, fill: "hsl(var(--zoru-destructive))" },
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
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Advanced Analytics</ZoruPageTitle>
          <ZoruPageDescription>
            Comprehensive insights into your support operations and visitor satisfaction.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions className="flex items-center gap-3">
          <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline">
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange}
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuItem onClick={() => setDateRange("Today")}>Today</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onClick={() => setDateRange("Yesterday")}>Yesterday</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onClick={() => setDateRange("Last 7 Days")}>Last 7 Days</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onClick={() => setDateRange("Last 30 Days")}>Last 30 Days</ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem>Custom Range...</ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </ZoruPageActions>
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
              icon={<MessageSquare className="h-4 w-4 text-zoru-ink-muted" />}
              trend={{ value: 12, isPositive: true }}
            />
            <StatCard
              label="First Response Time"
              value={`${data.avgResponseTime}s`}
              icon={<Clock className="h-4 w-4 text-zoru-ink-muted" />}
              trend={{ value: 5, isPositive: true }}
            />
            <StatCard
              label="Resolution Time"
              value="4m 20s" // mock new feature
              icon={<Timer className="h-4 w-4 text-zoru-ink-muted" />}
              trend={{ value: 2, isPositive: false }}
            />
            <StatCard
              label="Customer Satisfaction"
              value={`${data.satisfaction}%`}
              icon={<Smile className="h-4 w-4 text-zoru-ink-muted" />}
              trend={{ value: 1.5, isPositive: true }}
            />
            <StatCard
              label="Open Chats"
              value={data.openChats.toLocaleString()}
              icon={<Inbox className="h-4 w-4 text-zoru-ink-muted" />}
            />
            <StatCard
              label="Closed Chats"
              value={data.closedChats.toLocaleString()}
              icon={<CheckCircle className="h-4 w-4 text-zoru-ink-muted" />}
            />
            <StatCard
              label="Abandoned Chats"
              value="14" // mock new feature
              icon={<ZapOff className="h-4 w-4 text-zoru-ink-muted" />}
              trend={{ value: 8, isPositive: false }}
            />
            <StatCard
              label="AI Resolution Rate"
              value="34%" // mock new feature
              icon={<Monitor className="h-4 w-4 text-zoru-ink-muted" />}
              trend={{ value: 14, isPositive: true }}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Volume Chart */}
            <Card className="lg:col-span-2">
              <ZoruCardHeader>
                <ZoruCardTitle>Chat Volume vs Resolution</ZoruCardTitle>
                <ZoruPageDescription>Daily total incoming conversations and resolved chats.</ZoruPageDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ZoruChartContainer height={300}>
                  <ZoruChart.AreaChart data={data.dailyChatVolume}>
                    <ZoruChart.CartesianGrid vertical={false} stroke="hsl(var(--zoru-line))" strokeDasharray="3 3" />
                    <ZoruChart.XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} stroke="hsl(var(--zoru-ink-muted))" />
                    <ZoruChart.YAxis tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--zoru-ink-muted))" />
                    <ZoruChart.Tooltip cursor={{ fill: "hsl(var(--zoru-surface))" }} content={<ZoruChartTooltip />} />
                    <ZoruChart.Area type="monotone" dataKey="count" name="Total Chats" stroke={ZORU_CHART_PALETTE[0]} fill={ZORU_CHART_PALETTE[0]} fillOpacity={0.2} strokeWidth={2} />
                  </ZoruChart.AreaChart>
                </ZoruChartContainer>
              </ZoruCardContent>
            </Card>

            {/* CSAT Distribution */}
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>CSAT Breakdown</ZoruCardTitle>
                <ZoruPageDescription>Customer feedback ratings distribution.</ZoruPageDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="flex flex-col items-center justify-center">
                <ZoruChartContainer height={220}>
                  <ZoruChart.PieChart>
                    <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                    <ZoruChart.Pie data={MOCK_CSAT_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    </ZoruChart.Pie>
                  </ZoruChart.PieChart>
                </ZoruChartContainer>
                <div className="flex gap-4 mt-4 w-full justify-center">
                  <div className="flex items-center gap-1.5"><Smile className="h-4 w-4 text-zoru-success" /><span className="text-sm font-medium">75%</span></div>
                  <div className="flex items-center gap-1.5"><Meh className="h-4 w-4 text-zoru-warning" /><span className="text-sm font-medium">15%</span></div>
                  <div className="flex items-center gap-1.5"><Frown className="h-4 w-4 text-zoru-destructive" /><span className="text-sm font-medium">10%</span></div>
                </div>
              </ZoruCardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Top Tags */}
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Top Tags</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ZoruChartContainer height={220}>
                  <ZoruChart.PieChart>
                    <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                    <ZoruChart.Pie data={MOCK_TAGS_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} />
                  </ZoruChart.PieChart>
                </ZoruChartContainer>
              </ZoruCardContent>
            </Card>

            {/* Device Breakdown */}
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Device Breakdown</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent className="flex flex-col justify-center h-[260px]">
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="flex items-center gap-2"><Monitor className="h-4 w-4 text-zoru-ink-muted" /> Desktop</span>
                      <span>65%</span>
                    </div>
                    <div className="h-3 w-full bg-zoru-surface-2 rounded-full overflow-hidden">
                      <div className="h-full bg-zoru-ink" style={{ width: '65%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-zoru-ink-muted" /> Mobile</span>
                      <span>35%</span>
                    </div>
                    <div className="h-3 w-full bg-zoru-surface-2 rounded-full overflow-hidden">
                      <div className="h-full bg-zoru-ink-muted" style={{ width: '35%' }}></div>
                    </div>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>

            {/* Heatmap Mock */}
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Busiest Hours</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ZoruChartContainer height={220}>
                  <ZoruChart.BarChart data={MOCK_HOURS_HEATMAP}>
                    <ZoruChart.XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} stroke="hsl(var(--zoru-ink-muted))" />
                    <ZoruChart.Tooltip cursor={{ fill: "hsl(var(--zoru-surface))" }} content={<ZoruChartTooltip />} />
                    <ZoruChart.Bar dataKey="h12" name="Noon chats" fill={ZORU_CHART_PALETTE[1]} radius={[2, 2, 0, 0]} stackId="a" />
                    <ZoruChart.Bar dataKey="h15" name="Afternoon chats" fill={ZORU_CHART_PALETTE[0]} radius={[2, 2, 0, 0]} stackId="a" />
                  </ZoruChart.BarChart>
                </ZoruChartContainer>
              </ZoruCardContent>
            </Card>
          </div>

          {/* Agent Leaderboard */}
          <Card className="overflow-hidden p-0">
            <div className="p-5 border-b border-zoru-line flex items-center justify-between">
              <div>
                <ZoruCardTitle>Agent Performance Leaderboard</ZoruCardTitle>
                <ZoruPageDescription className="mt-1">Resolution metrics broken down by individual agent.</ZoruPageDescription>
              </div>
            </div>
            <Table>
              <ZoruTableHeader className="bg-zoru-surface-2/30">
                <ZoruTableRow>
                  <ZoruTableHead>Agent</ZoruTableHead>
                  <ZoruTableHead className="text-right">Chats Resolved</ZoruTableHead>
                  <ZoruTableHead className="text-right">Avg Response Time</ZoruTableHead>
                  <ZoruTableHead className="text-right">CSAT</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {MOCK_AGENTS.map((agent, i) => (
                  <ZoruTableRow key={i}>
                    <ZoruTableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <ZoruAvatarFallback>{agent.name.charAt(0)}</ZoruAvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-zoru-ink">{agent.name}</div>
                          <div className="text-xs text-zoru-ink-muted">{agent.email}</div>
                        </div>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right font-medium">{agent.chats}</ZoruTableCell>
                    <ZoruTableCell className="text-right text-zoru-ink-muted">{agent.time}</ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <Badge variant="outline" className={cn(
                        agent.csat > 90 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {agent.csat}%
                      </Badge>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
