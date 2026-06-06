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
} from "@/components/sabcrm/20ui";
import {
  BarChart3,
  LineChart,
  Activity,
  Clock,
  TrendingUp,
  Users,
  Download,
  ExternalLink,
  MoreHorizontal,
  PresentationIcon,
} from "lucide-react";

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

export default function AnalyticsPage() {
  const [range, setRange] = React.useState("90d");

  return (
    <TooltipProvider>
      <div className="ui20 flex-1 space-y-6 p-4 md:p-8 pt-6">
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
              <ChartPlaceholder
                icon={BarChart3}
                label="Attendance chart"
                hint="Connect a data source to plot attendance trends here."
              />
            </CardBody>
          </Card>

          <Card className="lg:col-span-3" padding="none">
            <CardHeader>
              <CardTitle>Engagement score</CardTitle>
              <CardDescription>Based on polls, Q&amp;A, and chat activity.</CardDescription>
            </CardHeader>
            <CardBody>
              <ChartPlaceholder
                icon={LineChart}
                label="Engagement chart"
                hint="Engagement is calculated once a webinar has live interactions."
              />
            </CardBody>
          </Card>
        </div>

        <Card padding="none">
          <CardHeader>
            <CardTitle>Top webinars</CardTitle>
            <CardDescription>Your highest-performing sessions in the selected range.</CardDescription>
          </CardHeader>
          <CardBody style={{ paddingTop: 0 }}>
            {TOP_WEBINARS.length === 0 ? (
              <EmptyState
                icon={PresentationIcon}
                title="No webinars yet"
                description="Host your first webinar to start collecting attendance and engagement data."
                action={
                  <Button variant="primary" iconLeft={PresentationIcon}>
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

function ChartPlaceholder({
  icon: Icon,
  label,
  hint,
}: {
  icon: typeof BarChart3;
  label: string;
  hint: string;
}) {
  return (
    <div
      className="flex h-[300px] flex-col items-center justify-center gap-3 rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-6 text-center"
      role="img"
      aria-label={`${label} placeholder`}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg)] text-[var(--st-text-tertiary)]"
        aria-hidden="true"
      >
        <Icon className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--st-text-secondary)]">{label}</p>
        <p className="text-xs text-[var(--st-text-tertiary)]">{hint}</p>
      </div>
    </div>
  );
}
