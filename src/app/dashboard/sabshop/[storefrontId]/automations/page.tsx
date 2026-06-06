"use client";

import React from "react";
import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
} from "@/components/zoruui/page-header";
import { Button } from "@/components/zoruui/button";
import { StatCard } from "@/components/zoruui/stat-card";
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent, ZoruCardFooter } from "@/components/zoruui/card";
import { Badge } from "@/components/zoruui/badge";
import { Switch } from "@/components/zoruui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/zoruui/dropdown-menu";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/zoruui/table";
import {
  Play,
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
  PenTool
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const mockAutomations = [
  {
    id: "wf-1",
    name: "Abandoned Checkout Recovery",
    description: "Send a reminder email to customers who leave items in their cart.",
    icon: <ShoppingCart className="h-5 w-5 text-[var(--st-text-secondary)]" />,
    status: "active",
    lastRun: "2 mins ago",
    successRate: 98,
    type: "Email Marketing",
  },
  {
    id: "wf-2",
    name: "High-Risk Order Alert",
    description: "Flag and notify support team when a high-value or suspicious order is placed.",
    icon: <AlertCircle className="h-5 w-5 text-[var(--st-danger)]" />,
    status: "active",
    lastRun: "1 hour ago",
    successRate: 100,
    type: "Fraud Prevention",
  },
  {
    id: "wf-3",
    name: "Low Inventory Warning",
    description: "Send Slack notification to inventory manager when stock drops below 10.",
    icon: <Box className="h-5 w-5 text-[var(--st-text-secondary)]" />,
    status: "inactive",
    lastRun: "3 days ago",
    successRate: 100,
    type: "Operations",
  },
  {
    id: "wf-4",
    name: "New Customer Onboarding",
    description: "Welcome series with a 10% discount code for first-time buyers.",
    icon: <Mail className="h-5 w-5 text-[var(--st-text-secondary)]" />,
    status: "active",
    lastRun: "15 mins ago",
    successRate: 95,
    type: "Email Marketing",
  },
];

const mockHistory = [
  { id: "run-9021", workflow: "Abandoned Checkout Recovery", status: "success", trigger: "Checkout Updated", time: "1.2s", date: "Oct 24, 10:42 AM" },
  { id: "run-9020", workflow: "New Customer Onboarding", status: "success", trigger: "Customer Created", time: "2.4s", date: "Oct 24, 10:30 AM" },
  { id: "run-9019", workflow: "High-Risk Order Alert", status: "failed", trigger: "Order Created", time: "0.8s", date: "Oct 24, 09:15 AM" },
  { id: "run-9018", workflow: "Abandoned Checkout Recovery", status: "success", trigger: "Checkout Updated", time: "1.1s", date: "Oct 24, 08:50 AM" },
  { id: "run-9017", workflow: "Abandoned Checkout Recovery", status: "success", trigger: "Checkout Updated", time: "1.3s", date: "Oct 23, 11:20 PM" },
];

export default function AutomationsPage() {
  return (
    <div className="flex flex-col gap-8 pb-12 w-full">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageEyebrow>SabShop Engine</ZoruPageEyebrow>
          <ZoruPageTitle>Automations</ZoruPageTitle>
          <ZoruPageDescription>
            Build visual workflows to automate tasks like order routing, inventory alerts, and cart recovery.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline">Browse Templates</Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 px-1">
        <StatCard
          label="Active Workflows"
          value="12"
          icon={<Zap className="text-amber-500" />}
          delta={15}
          period="vs last month"
        />
        <StatCard
          label="Tasks Automated"
          value="45.2k"
          icon={<Activity className="text-[var(--st-status-ok)]" />}
          delta={8.2}
          period="this month"
        />
        <StatCard
          label="Avg Run Time"
          value="1.4s"
          icon={<Clock />}
          delta={-5}
          period="ms faster"
          invertDelta
        />
        <StatCard
          label="Error Rate"
          value="0.4%"
          icon={<AlertCircle />}
          delta={-1.2}
          period="vs last week"
          invertDelta
        />
      </div>

      <Tabs defaultValue="workflows" className="w-full">
        <div className="px-1 border-b border-[var(--st-border)] mb-6">
          <TabsList className="bg-transparent border-0 rounded-none w-full justify-start h-auto p-0">
            <TabsTrigger 
              value="workflows" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--st-text)] data-[state=active]:bg-transparent px-4 pb-3 pt-2 font-medium"
            >
              Your Workflows
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--st-text)] data-[state=active]:bg-transparent px-4 pb-3 pt-2 font-medium"
            >
              Run History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="workflows" className="space-y-6 mt-0">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 px-1">
            {mockAutomations.map((workflow) => (
              <Card key={workflow.id} className="flex flex-col transition-all hover:border-[var(--st-border-strong)] hover:shadow-sm">
                <ZoruCardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius-md)] bg-[var(--st-bg-muted)]">
                      {workflow.icon}
                    </div>
                    <div>
                      <ZoruCardTitle className="text-base">{workflow.name}</ZoruCardTitle>
                      <div className="text-xs text-[var(--st-text-tertiary)] mt-0.5">{workflow.type}</div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                      <DropdownMenuItem>
                        <PenTool className="mr-2 h-4 w-4" /> Edit Flow
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <BarChart2 className="mr-2 h-4 w-4" /> View Analytics
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-[var(--st-danger)] focus:text-[var(--st-danger)] focus:bg-red-50 dark:focus:bg-red-950/50">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ZoruCardHeader>
                <ZoruCardContent className="flex-1 pb-4">
                  <ZoruCardDescription className="text-sm line-clamp-2">
                    {workflow.description}
                  </ZoruCardDescription>
                </ZoruCardContent>
                <div className="mt-auto border-t border-[var(--st-border)]/50 p-4 flex items-center justify-between bg-[var(--st-bg-muted)]/30">
                  <div className="flex items-center gap-4 text-xs text-[var(--st-text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {workflow.lastRun}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--st-status-ok)]" />
                      {workflow.successRate}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--st-text)]">
                      {workflow.status === 'active' ? 'Active' : 'Paused'}
                    </span>
                    <Switch checked={workflow.status === 'active'} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <Card className="px-1 border-0 shadow-none bg-transparent sm:bg-[var(--st-bg)] sm:border sm:shadow-sm">
            <div className="rounded-[var(--zoru-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--st-bg-muted)]/50 hover:bg-[var(--st-bg-muted)]/50">
                    <TableHead className="w-[100px]">Run ID</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Trigger</TableHead>
                    <TableHead className="hidden sm:table-cell">Time</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockHistory.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-xs text-[var(--st-text-secondary)]">
                        {run.id}
                      </TableCell>
                      <TableCell className="font-medium text-[var(--st-text)]">
                        {run.workflow}
                      </TableCell>
                      <TableCell>
                        {run.status === "success" ? (
                          <Badge variant="success" className="gap-1 rounded-full px-2 py-0.5 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="danger" className="gap-1 rounded-full px-2 py-0.5 text-[10px]">
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-[var(--st-text-secondary)]">
                        <div className="flex items-center gap-1.5">
                          <GitMerge className="h-3.5 w-3.5" />
                          {run.trigger}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-[var(--st-text-secondary)]">
                        {run.time}
                      </TableCell>
                      <TableCell className="text-right text-sm text-[var(--st-text-secondary)]">
                        {run.date}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
