"use client";

import React from "react";
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  StatCard,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  Dot,
  EmptyState,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  type BadgeTone,
} from "@/components/sabcrm/20ui";
import {
  Video,
  Plus,
  Calendar,
  Users,
  Settings,
  CalendarClock,
  Radio,
} from "lucide-react";

type WebinarStatus = "Upcoming" | "Live" | "Ended";

interface Webinar {
  id: string;
  title: string;
  status: WebinarStatus;
  date: string;
  registrations: number;
  host: string;
}

const STATUS_TONE: Record<WebinarStatus, BadgeTone> = {
  Upcoming: "info",
  Live: "danger",
  Ended: "neutral",
};

export default function WebinarsPage() {
  const webinars: Webinar[] = [
    {
      id: "web_1",
      title: "Q3 Product Launch Event",
      status: "Upcoming",
      date: "Oct 15, 2026",
      registrations: 450,
      host: "Priya Nair",
    },
    {
      id: "web_2",
      title: "Mastering React 19 Features",
      status: "Live",
      date: "Oct 10, 2026",
      registrations: 1200,
      host: "Marcus Reed",
    },
    {
      id: "web_3",
      title: "Enterprise Sales Strategy",
      status: "Ended",
      date: "Sep 28, 2026",
      registrations: 850,
      host: "Sarah Jenkins",
    },
  ];

  const totalWebinars = webinars.length;
  const liveCount = webinars.filter((w) => w.status === "Live").length;
  const upcomingCount = webinars.filter((w) => w.status === "Upcoming").length;
  const totalRegistrations = webinars.reduce(
    (sum, w) => sum + w.registrations,
    0,
  );

  return (
    <div className="ui20 flex-1 space-y-6 p-4 md:p-8 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Webinars</PageTitle>
          <PageDescription>
            Schedule, host, and track every live and on-demand session.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            Schedule webinar
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total webinars"
          value={totalWebinars}
          icon={Video}
        />
        <StatCard
          label="Live now"
          value={liveCount}
          icon={Radio}
          delta={liveCount > 0 ? { value: "On air", tone: "up" } : undefined}
        />
        <StatCard
          label="Upcoming"
          value={upcomingCount}
          icon={CalendarClock}
        />
        <StatCard
          label="Total registrations"
          value={totalRegistrations.toLocaleString()}
          icon={Users}
        />
      </div>

      <Card padding="none">
        <CardHeader>
          <CardTitle>Your webinars</CardTitle>
          <CardDescription>
            Manage and track all your scheduled and past webinars.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {webinars.length === 0 ? (
            <EmptyState
              icon={Video}
              title="No webinars yet"
              description="Schedule your first session to start collecting registrations."
              action={
                <Button variant="primary" iconLeft={Plus}>
                  Schedule webinar
                </Button>
              }
            />
          ) : (
            <TooltipProvider>
              <Table hover>
                <THead>
                  <Tr>
                    <Th>Title</Th>
                    <Th>Date</Th>
                    <Th>Host</Th>
                    <Th align="right">Registrations</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {webinars.map((webinar) => (
                    <Tr key={webinar.id}>
                      <Td>
                        <span className="font-medium text-[var(--st-text)]">
                          {webinar.title}
                        </span>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                          <Calendar
                            className="h-4 w-4 text-[var(--st-text-tertiary)]"
                            aria-hidden="true"
                          />
                          {webinar.date}
                        </span>
                      </Td>
                      <Td>{webinar.host}</Td>
                      <Td align="right">
                        <span className="tabular-nums text-[var(--st-text)]">
                          {webinar.registrations.toLocaleString()}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONE[webinar.status]}>
                          {webinar.status === "Live" ? (
                            <Dot tone="danger" pulse aria-hidden="true" />
                          ) : null}
                          {webinar.status}
                        </Badge>
                      </Td>
                      <Td align="right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <IconButton
                              icon={Settings}
                              label={`Manage ${webinar.title}`}
                              variant="ghost"
                              size="sm"
                            />
                          </TooltipTrigger>
                          <TooltipContent>Manage webinar</TooltipContent>
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TooltipProvider>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
