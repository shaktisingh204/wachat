"use client";

import React from "react";
import {
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
  type BadgeTone,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/sabcrm/20ui";
import {
  Plus,
  Repeat,
  Settings,
  CalendarRange,
  CheckCircle2,
  PlayCircle,
  Target,
} from "lucide-react";

type SprintStatus = "Active" | "Completed" | "Planned";

interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  points: number;
}

const STATUS_TONE: Record<SprintStatus, BadgeTone> = {
  Active: "success",
  Completed: "neutral",
  Planned: "info",
};

export default function SabSprintsSprintsPage() {
  const sprints: Sprint[] = [
    { id: "1", name: "Sprint 42", startDate: "2026-06-01", endDate: "2026-06-14", status: "Active", points: 45 },
    { id: "2", name: "Sprint 41", startDate: "2026-05-18", endDate: "2026-05-31", status: "Completed", points: 52 },
    { id: "3", name: "Sprint 43", startDate: "2026-06-15", endDate: "2026-06-28", status: "Planned", points: 38 },
  ];

  const activeCount = sprints.filter((s) => s.status === "Active").length;
  const plannedCount = sprints.filter((s) => s.status === "Planned").length;
  const completedCount = sprints.filter((s) => s.status === "Completed").length;
  const totalPoints = sprints.reduce((sum, s) => sum + s.points, 0);

  return (
    <TooltipProvider>
      <div className="20ui p-6 space-y-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Sprints</PageTitle>
            <PageDescription>Manage your agile sprints and iterations.</PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="primary" iconLeft={Plus}>
              New Sprint
            </Button>
          </PageActions>
        </PageHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active sprints" value={activeCount} icon={PlayCircle} />
          <StatCard label="Planned" value={plannedCount} icon={CalendarRange} />
          <StatCard label="Completed" value={completedCount} icon={CheckCircle2} />
          <StatCard label="Total points" value={totalPoints} icon={Target} />
        </div>

        <Card padding="none">
          <CardHeader>
            <CardTitle>All Sprints</CardTitle>
            <CardDescription>Every iteration across your team, newest planning first.</CardDescription>
          </CardHeader>
          <CardBody>
            {sprints.length === 0 ? (
              <EmptyState
                icon={Repeat}
                title="No sprints yet"
                description="Plan your first iteration to start tracking scope, dates, and points."
                action={
                  <Button variant="primary" iconLeft={Plus}>
                    New Sprint
                  </Button>
                }
              />
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Sprint Name</Th>
                    <Th>Start Date</Th>
                    <Th>End Date</Th>
                    <Th>Status</Th>
                    <Th align="right">Total Points</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {sprints.map((sprint) => (
                    <Tr key={sprint.id}>
                      <Td>
                        <span className="inline-flex items-center gap-2 font-medium text-[var(--st-text)]">
                          <Repeat className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                          {sprint.name}
                        </span>
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">{sprint.startDate}</Td>
                      <Td className="text-[var(--st-text-secondary)]">{sprint.endDate}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[sprint.status]} dot>
                          {sprint.status}
                        </Badge>
                      </Td>
                      <Td align="right" className="tabular-nums text-[var(--st-text)]">
                        {sprint.points}
                      </Td>
                      <Td align="right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <IconButton label={`Configure ${sprint.name}`} icon={Settings} size="sm" />
                          </TooltipTrigger>
                          <TooltipContent>Sprint settings</TooltipContent>
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
