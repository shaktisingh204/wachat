"use client";

import React from "react";
import {
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
  type BadgeTone,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/sabcrm/20ui";
import {
  Users,
  Mail,
  CheckCircle2,
  Clock,
  CalendarClock,
  Download,
} from "lucide-react";

type RegistrationStatus = "Confirmed" | "Waitlisted" | "Attended";

interface Registration {
  id: string;
  name: string;
  email: string;
  webinar: string;
  status: RegistrationStatus;
  date: string;
}

const STATUS_TONE: Record<RegistrationStatus, BadgeTone> = {
  Confirmed: "info",
  Attended: "success",
  Waitlisted: "warning",
};

export default function RegistrationsPage() {
  const registrations: Registration[] = [
    {
      id: "reg_1",
      name: "Alice Johnson",
      email: "alice.johnson@northwind.io",
      webinar: "Q3 Product Launch Event",
      status: "Confirmed",
      date: "Oct 01, 2026",
    },
    {
      id: "reg_2",
      name: "Bob Williams",
      email: "bob.w@acme.inc",
      webinar: "Mastering React 19 Features",
      status: "Waitlisted",
      date: "Oct 02, 2026",
    },
    {
      id: "reg_3",
      name: "Priya Nair",
      email: "priya.nair@brightline.co",
      webinar: "Enterprise Sales Strategy",
      status: "Attended",
      date: "Sep 25, 2026",
    },
    {
      id: "reg_4",
      name: "Diego Ramirez",
      email: "diego.ramirez@vantage.dev",
      webinar: "Q3 Product Launch Event",
      status: "Confirmed",
      date: "Oct 03, 2026",
    },
  ];

  const total = registrations.length;
  const confirmed = registrations.filter((r) => r.status === "Confirmed").length;
  const attended = registrations.filter((r) => r.status === "Attended").length;
  const waitlisted = registrations.filter((r) => r.status === "Waitlisted").length;

  return (
    <TooltipProvider>
      <div className="ui20 flex-1 space-y-6 p-4 md:p-8 pt-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Registrations</PageTitle>
            <PageDescription>
              View and manage attendee registrations across all webinars.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="primary" iconLeft={Download}>
              Export CSV
            </Button>
          </PageActions>
        </PageHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total registrations"
            value={total.toLocaleString()}
            icon={Users}
          />
          <StatCard
            label="Confirmed"
            value={confirmed.toLocaleString()}
            icon={CheckCircle2}
          />
          <StatCard
            label="Attended"
            value={attended.toLocaleString()}
            icon={CalendarClock}
          />
          <StatCard
            label="Waitlisted"
            value={waitlisted.toLocaleString()}
            icon={Clock}
          />
        </div>

        <Card padding="none">
          <CardHeader>
            <CardTitle>Recent registrations</CardTitle>
            <CardDescription>
              The latest attendees who signed up across your webinars.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {registrations.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No registrations yet"
                description="When attendees sign up for a webinar, they will appear here."
                action={
                  <Button variant="primary" iconLeft={Download}>
                    Export CSV
                  </Button>
                }
              />
            ) : (
              <Table hover>
                <THead>
                  <Tr>
                    <Th>Attendee name</Th>
                    <Th>Email</Th>
                    <Th>Webinar</Th>
                    <Th>Registration date</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {registrations.map((reg) => (
                    <Tr key={reg.id}>
                      <Td>
                        <span className="font-medium text-[var(--st-text)]">
                          {reg.name}
                        </span>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-2 text-[var(--st-text-secondary)]">
                          <Mail
                            size={14}
                            aria-hidden="true"
                            className="text-[var(--st-text-tertiary)]"
                          />
                          {reg.email}
                        </span>
                      </Td>
                      <Td>{reg.webinar}</Td>
                      <Td>
                        <span className="text-[var(--st-text-secondary)]">
                          {reg.date}
                        </span>
                      </Td>
                      <Td>
                        <Badge
                          tone={STATUS_TONE[reg.status]}
                          dot
                          kind="soft"
                        >
                          {reg.status}
                        </Badge>
                      </Td>
                      <Td align="right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <IconButton
                              label={`Email ${reg.name}`}
                              icon={Mail}
                              variant="ghost"
                              size="sm"
                            />
                          </TooltipTrigger>
                          <TooltipContent>Email attendee</TooltipContent>
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </TooltipProvider>
  );
}
