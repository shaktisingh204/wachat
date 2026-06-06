"use client";

import React from "react";
import {
  PageHeader,
  PageHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Badge,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
  IconButton,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/sabcrm/20ui";
import {
  Settings,
  MoreVertical,
  Zap,
  Activity,
  CheckCircle2,
  AlertCircle,
  GitMerge,
  Mail,
  Box,
  ShoppingCart,
  Plus,
  BarChart2,
  Clock,
  Trash2,
  Copy,
  PenTool,
  type LucideIcon,
} from "lucide-react";

type WorkflowStatus = "active" | "inactive";

interface Workflow {
  id: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  iconTone: "neutral" | "danger";
  status: WorkflowStatus;
  lastRun: string;
  successRate: number;
  type: string;
}

const mockAutomations: Workflow[] = [
  {
    id: "wf-1",
    name: "Abandoned Checkout Recovery",
    description: "Send a reminder email to customers who leave items in their cart.",
    Icon: ShoppingCart,
    iconTone: "neutral",
    status: "active",
    lastRun: "2 mins ago",
    successRate: 98,
    type: "Email Marketing",
  },
  {
    id: "wf-2",
    name: "High-Risk Order Alert",
    description: "Flag and notify the support team when a high-value or suspicious order is placed.",
    Icon: AlertCircle,
    iconTone: "danger",
    status: "active",
    lastRun: "1 hour ago",
    successRate: 100,
    type: "Fraud Prevention",
  },
  {
    id: "wf-3",
    name: "Low Inventory Warning",
    description: "Send a Slack notification to the inventory manager when stock drops below 10.",
    Icon: Box,
    iconTone: "neutral",
    status: "inactive",
    lastRun: "3 days ago",
    successRate: 100,
    type: "Operations",
  },
  {
    id: "wf-4",
    name: "New Customer Onboarding",
    description: "Welcome series with a 10% discount code for first-time buyers.",
    Icon: Mail,
    iconTone: "neutral",
    status: "active",
    lastRun: "15 mins ago",
    successRate: 95,
    type: "Email Marketing",
  },
];

interface HistoryRun {
  id: string;
  workflow: string;
  status: "success" | "failed";
  trigger: string;
  time: string;
  date: string;
}

const mockHistory: HistoryRun[] = [
  { id: "run-9021", workflow: "Abandoned Checkout Recovery", status: "success", trigger: "Checkout Updated", time: "1.2s", date: "Oct 24, 10:42 AM" },
  { id: "run-9020", workflow: "New Customer Onboarding", status: "success", trigger: "Customer Created", time: "2.4s", date: "Oct 24, 10:30 AM" },
  { id: "run-9019", workflow: "High-Risk Order Alert", status: "failed", trigger: "Order Created", time: "0.8s", date: "Oct 24, 09:15 AM" },
  { id: "run-9018", workflow: "Abandoned Checkout Recovery", status: "success", trigger: "Checkout Updated", time: "1.1s", date: "Oct 24, 08:50 AM" },
  { id: "run-9017", workflow: "Abandoned Checkout Recovery", status: "success", trigger: "Checkout Updated", time: "1.3s", date: "Oct 23, 11:20 PM" },
];

function WorkflowCard({ workflow }: { workflow: Workflow }): React.JSX.Element {
  const { Icon } = workflow;
  const isActive = workflow.status === "active";
  return (
    <Card variant="outlined" padding="none" className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]"
            aria-hidden="true"
          >
            <Icon
              size={18}
              className={
                workflow.iconTone === "danger"
                  ? "text-[var(--st-danger)]"
                  : "text-[var(--st-text-secondary)]"
              }
            />
          </span>
          <div>
            <CardTitle className="text-base">{workflow.name}</CardTitle>
            <div className="mt-0.5 text-xs text-[var(--st-text-tertiary)]">{workflow.type}</div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Workflow actions" icon={MoreVertical} variant="ghost" size="sm" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Workflow</DropdownMenuLabel>
            <DropdownMenuItem iconLeft={PenTool}>Edit flow</DropdownMenuItem>
            <DropdownMenuItem iconLeft={BarChart2}>View analytics</DropdownMenuItem>
            <DropdownMenuItem iconLeft={Copy}>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" iconLeft={Trash2}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardBody className="flex-1">
        <p className="line-clamp-2 text-sm text-[var(--st-text-secondary)]">
          {workflow.description}
        </p>
      </CardBody>

      <CardFooter className="mt-auto flex items-center justify-between border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <div className="flex items-center gap-4 text-xs text-[var(--st-text-secondary)]">
          <span className="flex items-center gap-1.5">
            <Clock size={14} aria-hidden="true" />
            {workflow.lastRun}
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-[var(--st-success)]" aria-hidden="true" />
            {workflow.successRate}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--st-text)]">
            {isActive ? "Active" : "Paused"}
          </span>
          <Switch
            checked={isActive}
            aria-label={`${isActive ? "Pause" : "Activate"} ${workflow.name}`}
          />
        </div>
      </CardFooter>
    </Card>
  );
}

export default function AutomationsPage(): React.JSX.Element {
  const hasWorkflows = mockAutomations.length > 0;
  const hasHistory = mockHistory.length > 0;

  return (
    <TooltipProvider>
      <div className="ui20 flex w-full flex-col gap-8 pb-12">
        <PageHeader>
          <PageHeading>
            <PageEyebrow>SabShop Engine</PageEyebrow>
            <PageTitle>Automations</PageTitle>
            <PageDescription>
              Build visual workflows to automate tasks like order routing, inventory alerts, and cart recovery.
            </PageDescription>
          </PageHeading>
          <PageActions>
            <Button variant="outline" iconLeft={Settings}>
              Browse Templates
            </Button>
            <Button variant="primary" iconLeft={Plus}>
              Create Workflow
            </Button>
          </PageActions>
        </PageHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Workflows"
            value="12"
            icon={Zap}
            delta={{ value: "+15%", tone: "up" }}
          />
          <StatCard
            label="Tasks Automated"
            value="45.2k"
            icon={Activity}
            delta={{ value: "+8.2%", tone: "up" }}
          />
          <StatCard
            label="Avg Run Time"
            value="1.4s"
            icon={Clock}
            delta={{ value: "-5ms", tone: "up" }}
          />
          <StatCard
            label="Error Rate"
            value="0.4%"
            icon={AlertCircle}
            delta={{ value: "-1.2pts", tone: "up" }}
          />
        </div>

        <Tabs defaultValue="workflows" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="workflows">Your Workflows</TabsTrigger>
            <TabsTrigger value="history">Run History</TabsTrigger>
          </TabsList>

          <TabsContent value="workflows">
            {hasWorkflows ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {mockAutomations.map((workflow) => (
                  <WorkflowCard key={workflow.id} workflow={workflow} />
                ))}
              </div>
            ) : (
              <Card variant="outlined" padding="lg">
                <EmptyState
                  icon={Zap}
                  title="No workflows yet"
                  description="Create your first automation to route orders, recover carts, and alert your team without lifting a finger."
                  action={
                    <Button variant="primary" iconLeft={Plus}>
                      Create Workflow
                    </Button>
                  }
                />
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card variant="outlined" padding="none">
              {hasHistory ? (
                <Table>
                  <THead>
                    <Tr>
                      <Th width={120}>Run ID</Th>
                      <Th>Workflow</Th>
                      <Th>Status</Th>
                      <Th className="hidden md:table-cell">Trigger</Th>
                      <Th className="hidden sm:table-cell">Time</Th>
                      <Th align="right">Date</Th>
                      <Th align="right" width={64}>
                        <span className="sr-only">Actions</span>
                      </Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {mockHistory.map((run) => (
                      <Tr key={run.id}>
                        <Td className="font-mono text-xs text-[var(--st-text-secondary)]">
                          {run.id}
                        </Td>
                        <Td className="font-medium text-[var(--st-text)]">{run.workflow}</Td>
                        <Td>
                          {run.status === "success" ? (
                            <Badge tone="success" dot>
                              Success
                            </Badge>
                          ) : (
                            <Badge tone="danger" dot>
                              Failed
                            </Badge>
                          )}
                        </Td>
                        <Td className="hidden text-sm text-[var(--st-text-secondary)] md:table-cell">
                          <span className="flex items-center gap-1.5">
                            <GitMerge size={14} aria-hidden="true" />
                            {run.trigger}
                          </span>
                        </Td>
                        <Td className="hidden text-sm text-[var(--st-text-secondary)] sm:table-cell">
                          {run.time}
                        </Td>
                        <Td align="right" className="text-sm text-[var(--st-text-secondary)]">
                          {run.date}
                        </Td>
                        <Td align="right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <IconButton
                                label={`View run ${run.id}`}
                                icon={Activity}
                                variant="ghost"
                                size="sm"
                              />
                            </TooltipTrigger>
                            <TooltipContent>View run details</TooltipContent>
                          </Tooltip>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <div className="p-4">
                  <EmptyState
                    icon={Clock}
                    title="No runs recorded yet"
                    description="Once your workflows start firing, every run will show up here with its trigger, duration, and result."
                  />
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
