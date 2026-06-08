"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  StatCard,
  Button,
  IconButton,
  Badge,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  Recharts,
  type ChartConfig,
} from "@/components/sabcrm/20ui";
import {
  Activity,
  Clock,
  TrendingUp,
  Users,
  Download,
  ExternalLink,
  MoreHorizontal,
  Presentation,
} from "lucide-react";

const { AreaChart, Area, CartesianGrid, XAxis, YAxis, RadialBarChart, RadialBar, PolarAngleAxis } =
  Recharts;

type WebinarStatus = "completed" | "live" | "scheduled";

interface TopWebinar {
  id: string;
  title: string;
  host: string;
  date: string;
  registered: number;
  attended: number;
  attendanceRate: number;
  status: WebinarStatus;
}

const TOP_WEBINARS: TopWebinar[] = [
  {
    id: "wb-2041",
    title: "Scaling WhatsApp Broadcasts Without Getting Blocked",
    host: "Priya Nair",
    date: "May 28, 2026",
    registered: 1840,
    attended: 1316,
    attendanceRate: 72,
    status: "completed",
  },
  {
    id: "wb-2039",
    title: "Build Your First Automation Flow in 30 Minutes",
    host: "Arjun Mehta",
    date: "May 21, 2026",
    registered: 1207,
    attended: 781,
    attendanceRate: 65,
    status: "completed",
  },
  {
    id: "wb-2044",
    title: "Live Q&A: CRM Pipelines for Sales Teams",
    host: "Sana Kapoor",
    date: "Jun 6, 2026",
    registered: 643,
    attended: 412,
    attendanceRate: 64,
    status: "live",
  },
  {
    id: "wb-2046",
    title: "SEO Reporting Deep Dive for Agencies",
    host: "Rahul Verma",
    date: "Jun 12, 2026",
    registered: 389,
    attended: 0,
    attendanceRate: 0,
    status: "scheduled",
  },
];

const STATUS_META: Record<
  WebinarStatus,
  { label: string; tone: "success" | "info" | "neutral"; dot: boolean }
> = {
  completed: { label: "Completed", tone: "success", dot: false },
  live: { label: "Live now", tone: "info", dot: true },
  scheduled: { label: "Scheduled", tone: "neutral", dot: false },
};

const ATTENDANCE_TREND = [
  { month: "Jan", registered: 1240, attended: 812 },
  { month: "Feb", registered: 1510, attended: 1018 },
  { month: "Mar", registered: 1380, attended: 921 },
  { month: "Apr", registered: 1720, attended: 1204 },
  { month: "May", registered: 2090, attended: 1505 },
  { month: "Jun", registered: 1840, attended: 1316 },
];

const ATTENDANCE_CONFIG = {
  registered: { label: "Registered", color: "var(--st-text-tertiary)" },
  attended: { label: "Attended", color: "var(--st-accent)" },
} satisfies ChartConfig;

const ENGAGEMENT_SCORE = [{ name: "engagement", value: 74 }];

const ENGAGEMENT_CONFIG = {
  value: { label: "Engagement", color: "var(--st-accent)" },
} satisfies ChartConfig;

export default function AnalyticsPage() {
  const [range, setRange] = React.useState("90d");

  return (
    <TooltipProvider>
      <div className="20ui flex-1 space-y-6 p-4 md:p-8 pt-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Analytics</PageTitle>
            <PageDescription>
              Attendance, engagement, and retention across every webinar you have run.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger aria-label="Date range">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="primary" iconLeft={Download}>
              Export report
            </Button>
          </PageActions>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Average attendance rate"
            value="68%"
            icon={Activity}
            delta={{ value: "+5% vs last quarter", tone: "up" }}
          />
          <StatCard
            label="Average watch time"
            value="42m"
            icon={Clock}
            delta={{ value: "Per attendee", tone: "neutral" }}
          />
          <StatCard
            label="Audience retention"
            value="61%"
            icon={TrendingUp}
            delta={{ value: "Stayed past the halfway mark", tone: "neutral" }}
          />
          <StatCard
            label="Total registrants"
            value="4,079"
            icon={Users}
            delta={{ value: "+312 this period", tone: "up" }}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4" padding="none">
            <CardHeader>
              <CardTitle>Attendance overview</CardTitle>
              <CardDescription>Registrations and live attendance over the past 6 months.</CardDescription>
            </CardHeader>
            <CardBody>
              <ChartContainer config={ATTENDANCE_CONFIG} className="h-[300px] w-full">
                <AreaChart data={ATTENDANCE_TREND} margin={{ left: 4, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillAttended" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-attended)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-attended)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--st-border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    fontSize={12}
                    tickFormatter={(v: number) => `${v / 1000}k`}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    dataKey="registered"
                    type="monotone"
                    stroke="var(--color-registered)"
                    fill="transparent"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Area
                    dataKey="attended"
                    type="monotone"
                    stroke="var(--color-attended)"
                    fill="url(#fillAttended)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
            </CardBody>
          </Card>

          <Card className="lg:col-span-3" padding="none">
            <CardHeader>
              <CardTitle>Engagement score</CardTitle>
              <CardDescription>Based on polls, Q&amp;A, and chat activity.</CardDescription>
            </CardHeader>
            <CardBody className="flex items-center justify-center">
              <ChartContainer config={ENGAGEMENT_CONFIG} className="mx-auto aspect-square h-[260px]">
                <RadialBarChart
                  data={ENGAGEMENT_SCORE}
                  startAngle={90}
                  endAngle={90 - (360 * 74) / 100}
                  innerRadius={90}
                  outerRadius={120}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar
                    dataKey="value"
                    background={{ fill: "var(--st-bg-secondary)" }}
                    cornerRadius={8}
                    fill="var(--color-value)"
                  />
                  <text
                    x="50%"
                    y="48%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-[var(--st-text)] text-3xl font-semibold tabular-nums"
                  >
                    74
                  </text>
                  <text
                    x="50%"
                    y="58%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-[var(--st-text-tertiary)] text-xs"
                  >
                    out of 100
                  </text>
                </RadialBarChart>
              </ChartContainer>
            </CardBody>
          </Card>
        </div>

        <Card padding="none">
          <CardHeader>
            <CardTitle>Top webinars</CardTitle>
            <CardDescription>Your highest-performing sessions in the selected range.</CardDescription>
          </CardHeader>
          <CardBody className="!pt-0">
            {TOP_WEBINARS.length === 0 ? (
              <EmptyState
                icon={Presentation}
                title="No webinars yet"
                description="Host your first webinar to start collecting attendance and engagement data."
                action={
                  <Button variant="primary" iconLeft={Presentation}>
                    Create webinar
                  </Button>
                }
              />
            ) : (
              <Table density="comfortable" hover>
                <THead>
                  <Tr>
                    <Th>Webinar</Th>
                    <Th>Host</Th>
                    <Th>Date</Th>
                    <Th align="right">Registered</Th>
                    <Th align="right">Attended</Th>
                    <Th align="right">Attendance</Th>
                    <Th>Status</Th>
                    <Th align="right" width={88}>
                      Actions
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {TOP_WEBINARS.map((wb) => {
                    const meta = STATUS_META[wb.status];
                    return (
                      <Tr key={wb.id}>
                        <Td>
                          <span className="font-medium text-[var(--st-text)]">{wb.title}</span>
                        </Td>
                        <Td>
                          <span className="text-[var(--st-text-secondary)]">{wb.host}</span>
                        </Td>
                        <Td>
                          <span className="text-[var(--st-text-secondary)]">{wb.date}</span>
                        </Td>
                        <Td align="right">{wb.registered.toLocaleString()}</Td>
                        <Td align="right">
                          {wb.attended > 0 ? wb.attended.toLocaleString() : (
                            <span className="text-[var(--st-text-tertiary)]">Not started</span>
                          )}
                        </Td>
                        <Td align="right">
                          {wb.attendanceRate > 0 ? (
                            <span className="font-medium text-[var(--st-text)]">{wb.attendanceRate}%</span>
                          ) : (
                            <span className="text-[var(--st-text-tertiary)]">n/a</span>
                          )}
                        </Td>
                        <Td>
                          <Badge tone={meta.tone} dot={meta.dot}>
                            {meta.label}
                          </Badge>
                        </Td>
                        <Td align="right">
                          <span className="inline-flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <IconButton
                                  label={`Open ${wb.title} report`}
                                  icon={ExternalLink}
                                  variant="ghost"
                                  size="sm"
                                />
                              </TooltipTrigger>
                              <TooltipContent>Open report</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <IconButton
                                  label={`More actions for ${wb.title}`}
                                  icon={MoreHorizontal}
                                  variant="ghost"
                                  size="sm"
                                />
                              </TooltipTrigger>
                              <TooltipContent>More actions</TooltipContent>
                            </Tooltip>
                          </span>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </TooltipProvider>
  );
}
