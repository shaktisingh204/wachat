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
  Badge,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/sabcrm/20ui";
import {
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Target,
  Download,
  BarChart3,
  ExternalLink,
} from "lucide-react";

type Trend = "up" | "down" | "neutral";

interface VelocityStat {
  label: string;
  value: string;
  icon: typeof Gauge;
  delta: { value: string; tone: Trend };
}

interface SprintRow {
  id: string;
  name: string;
  committed: number;
  completed: number;
  spillover: number;
}

const stats: VelocityStat[] = [
  {
    label: "Average velocity",
    value: "48 pts",
    icon: Gauge,
    delta: { value: "+12% vs prior 3 sprints", tone: "up" },
  },
  {
    label: "Completed last sprint",
    value: "52 pts",
    icon: CheckCircle2,
    delta: { value: "+4 pts", tone: "up" },
  },
  {
    label: "Spillover rate",
    value: "15%",
    icon: AlertTriangle,
    delta: { value: "-3 pts", tone: "down" },
  },
  {
    label: "Predictability",
    value: "92%",
    icon: Target,
    delta: { value: "Steady", tone: "neutral" },
  },
];

const sprints: SprintRow[] = [
  { id: "s-32", name: "Sprint 32 - Billing polish", committed: 50, completed: 52, spillover: 0 },
  { id: "s-31", name: "Sprint 31 - Onboarding rev", committed: 48, completed: 44, spillover: 4 },
  { id: "s-30", name: "Sprint 30 - Search rework", committed: 46, completed: 47, spillover: 0 },
  { id: "s-29", name: "Sprint 29 - Mobile pass", committed: 44, completed: 38, spillover: 6 },
  { id: "s-28", name: "Sprint 28 - API hardening", committed: 42, completed: 41, spillover: 1 },
];

function spilloverBadge(spillover: number): React.JSX.Element {
  if (spillover === 0) {
    return (
      <Badge tone="success" dot>
        On target
      </Badge>
    );
  }
  if (spillover <= 4) {
    return (
      <Badge tone="warning" dot>
        {spillover} pts spilled
      </Badge>
    );
  }
  return (
    <Badge tone="danger" dot>
      {spillover} pts spilled
    </Badge>
  );
}

export default function SabSprintsVelocityPage() {
  return (
    <TooltipProvider>
      <div className="ui20 p-6 space-y-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Velocity insights</PageTitle>
            <PageDescription>
              Track team throughput and delivery predictability across recent sprints.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="primary" iconLeft={Download}>
              Export report
            </Button>
          </PageActions>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              delta={stat.delta}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Velocity chart</CardTitle>
            <CardDescription>
              Completed versus committed points over the last six sprints.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <EmptyState
              icon={BarChart3}
              title="Chart not connected yet"
              description="Once a sprint board is linked, completed-versus-committed trends render here automatically."
              action={<Button variant="secondary">Connect a board</Button>}
            />
          </CardBody>
        </Card>

        <Card padding="none">
          <CardHeader>
            <CardTitle>Recent sprints</CardTitle>
            <CardDescription>
              Per-sprint commitment, delivery, and spillover for the last five sprints.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {sprints.length === 0 ? (
              <EmptyState
                icon={Gauge}
                title="No sprint history yet"
                description="Completed sprints will appear here with their velocity breakdown."
              />
            ) : (
              <Table density="comfortable" hover>
                <THead>
                  <Tr>
                    <Th>Sprint</Th>
                    <Th align="right">Committed</Th>
                    <Th align="right">Completed</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {sprints.map((sprint) => (
                    <Tr key={sprint.id}>
                      <Td>
                        <span className="font-medium text-[var(--st-text)]">{sprint.name}</span>
                      </Td>
                      <Td align="right">
                        <span className="text-[var(--st-text-secondary)]">{sprint.committed}</span>
                      </Td>
                      <Td align="right">
                        <span className="font-medium text-[var(--st-text)]">{sprint.completed}</span>
                      </Td>
                      <Td>{spilloverBadge(sprint.spillover)}</Td>
                      <Td align="right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <IconButton
                              label={`Open ${sprint.name}`}
                              icon={ExternalLink}
                              size="sm"
                            />
                          </TooltipTrigger>
                          <TooltipContent>Open sprint</TooltipContent>
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
