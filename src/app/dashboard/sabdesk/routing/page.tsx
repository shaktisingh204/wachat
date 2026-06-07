"use client";

import React, { useState } from "react";
import {
  Settings,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Route,
  Users,
  Zap,
  CheckCircle,
  Clock,
  Trash2,
  Edit,
  Save,
  Activity,
  Network,
  Play,
  Cpu,
  Sliders,
  GripVertical,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  PlusCircle,
  XSquare,
  GitBranch,
  Maximize2,
  MousePointer2,
  Move,
  GitMerge,
} from "lucide-react";
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  StatCard,
  Field,
  Input,
  Badge,
  Dot,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/sabcrm/20ui";

const mockQueues = [
  {
    id: "q1",
    name: "L1 Support",
    agents: 45,
    active: true,
    strategy: "Round Robin",
    avgWait: "2m 15s",
  },
  {
    id: "q2",
    name: "L2 Technical",
    agents: 12,
    active: true,
    strategy: "Skill Based",
    avgWait: "15m 30s",
  },
  {
    id: "q3",
    name: "Billing Specialists",
    agents: 8,
    active: true,
    strategy: "Least Loaded",
    avgWait: "5m 10s",
  },
  {
    id: "q4",
    name: "Escalation Team",
    agents: 5,
    active: false,
    strategy: "Manual",
    avgWait: "N/A",
  },
  {
    id: "q5",
    name: "VIP Enterprise",
    agents: 15,
    active: true,
    strategy: "Dedicated",
    avgWait: "30s",
  },
];

const mockRules = [
  {
    id: "r1",
    name: "Route High Priority to Escalation",
    condition: "Priority equals Urgent",
    action: "Assign to Escalation Team",
    status: "active",
    matches: 1240,
  },
  {
    id: "r2",
    name: "Billing Inquiries",
    condition: "Category equals Billing",
    action: "Assign to Billing Specialists",
    status: "active",
    matches: 8432,
  },
  {
    id: "r3",
    name: "Spanish Language Support",
    condition: "Language equals Spanish",
    action: "Require Skill: Spanish",
    status: "inactive",
    matches: 0,
  },
  {
    id: "r4",
    name: "VIP Customers",
    condition: "Organization equals Enterprise VIP",
    action: "Assign to VIP Enterprise",
    status: "active",
    matches: 342,
  },
  {
    id: "r5",
    name: "Password Resets",
    condition: "Subject contains Password",
    action: "Auto-reply Macro: Password Reset",
    status: "active",
    matches: 12053,
  },
];

const flowNodes = [
  {
    id: "start",
    type: "trigger",
    title: "Ticket Created",
    icon: Play,
    x: 50,
    y: 150,
  },
  {
    id: "cond1",
    type: "condition",
    title: "Is VIP Customer?",
    icon: GitBranch,
    x: 300,
    y: 150,
  },
  {
    id: "act1",
    type: "action",
    title: "Route to VIP Queue",
    icon: Users,
    x: 600,
    y: 50,
  },
  {
    id: "cond2",
    type: "condition",
    title: "Category = Technical?",
    icon: GitBranch,
    x: 600,
    y: 250,
  },
  {
    id: "act2",
    type: "action",
    title: "Assign to L2 Tech",
    icon: Cpu,
    x: 900,
    y: 150,
  },
  {
    id: "act3",
    type: "action",
    title: "Assign to L1 General",
    icon: Users,
    x: 900,
    y: 350,
  },
];

const queueStats = [
  { label: "Total Queues", value: "12", icon: Route, accent: "var(--st-accent)" },
  { label: "Active Agents", value: "84", icon: Users, accent: "var(--st-status-ok)" },
  { label: "Avg Queue Time", value: "4m 20s", icon: Clock, accent: "var(--st-warn)" },
  { label: "Routing Errors", value: "0.02%", icon: AlertTriangle, accent: "var(--st-danger)" },
];

const componentGroups = [
  {
    title: "Triggers",
    icon: Play,
    items: ["Ticket Created", "Ticket Updated", "Email Received", "API Event"],
  },
  {
    title: "Conditions",
    icon: GitBranch,
    items: ["Property Check", "Time Based", "Agent Online", "Sentiment Score"],
  },
  {
    title: "Actions",
    icon: Zap,
    items: [
      "Assign to Queue",
      "Assign to Agent",
      "Add Tags",
      "Trigger Webhook",
      "Send Auto-reply",
    ],
  },
];

export default function RoutingPage() {
  const [activeTab, setActiveTab] = useState("flow");
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);

  return (
    <div className="ui20 dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle className="flex items-center gap-3">
              <Network className="w-7 h-7 text-[var(--st-accent)]" aria-hidden="true" />
              Routing and Assignment
            </PageTitle>
            <PageDescription>
              Manage queues, skill-based routing, and visual workflows.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="secondary" iconLeft={Activity}>
              Routing Logs
            </Button>
            <Button variant="primary" iconLeft={Plus}>
              Create Route
            </Button>
          </PageActions>
        </PageHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="flow">
              <GitMerge className="w-4 h-4" aria-hidden="true" />
              Flow Builder
            </TabsTrigger>
            <TabsTrigger value="queues">
              <Users className="w-4 h-4" aria-hidden="true" />
              Queues and Pools
            </TabsTrigger>
            <TabsTrigger value="rules">
              <Sliders className="w-4 h-4" aria-hidden="true" />
              Routing Rules
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4" aria-hidden="true" />
              Global Settings
            </TabsTrigger>
          </TabsList>

          {/* Flow Builder Tab */}
          <TabsContent value="flow">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[800px]">
              {/* Sidebar Tools */}
              <Card padding="none" className="col-span-1 flex flex-col overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                    Components
                  </CardTitle>
                </CardHeader>
                <CardBody className="space-y-6 overflow-y-auto flex-1">
                  {componentGroups.map((group) => (
                    <div key={group.title}>
                      <h4 className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-3">
                        {group.title}
                      </h4>
                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item}
                            className="p-3 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] flex items-center gap-3 cursor-grab hover:bg-[var(--st-bg-muted)] transition-colors"
                          >
                            <GripVertical
                              className="w-4 h-4 text-[var(--st-text-tertiary)]"
                              aria-hidden="true"
                            />
                            <group.icon
                              className="w-4 h-4 text-[var(--st-accent)]"
                              aria-hidden="true"
                            />
                            <span className="text-sm">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              {/* Canvas */}
              <Card
                padding="none"
                className="col-span-1 lg:col-span-3 relative overflow-hidden flex flex-col bg-[var(--st-bg-secondary)]"
              >
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
                  <div className="bg-[var(--st-bg)] px-4 py-2 rounded-[var(--st-radius)] border border-[var(--st-border)] pointer-events-auto flex items-center gap-3">
                    <Dot tone="success" pulse aria-label="Flow is live" />
                    <span className="text-sm font-medium">Main Routing Flow v2.4</span>
                  </div>
                  <div className="flex gap-2 pointer-events-auto">
                    <IconButton label="Select tool" icon={MousePointer2} variant="secondary" />
                    <IconButton label="Pan tool" icon={Move} variant="secondary" />
                    <IconButton label="Fit to screen" icon={Maximize2} variant="secondary" />
                  </div>
                </div>

                {/* Mock Canvas Area */}
                <div className="flex-1 w-full h-full relative [background-size:40px_40px] [background-image:radial-gradient(circle,var(--st-border)_1px,transparent_1px)]">
                  {/* Lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <path
                      d="M 230 180 L 300 180"
                      stroke="var(--st-border-strong)"
                      strokeWidth="2"
                      fill="none"
                      markerEnd="url(#arrow)"
                    />
                    <path
                      d="M 500 180 C 550 180, 550 80, 600 80"
                      stroke="var(--st-status-ok)"
                      strokeWidth="2"
                      fill="none"
                      markerEnd="url(#arrow-green)"
                    />
                    <text
                      x="530"
                      y="120"
                      fill="var(--st-status-ok)"
                      fontSize="12"
                      className="font-medium"
                    >
                      Yes
                    </text>
                    <path
                      d="M 500 180 C 550 180, 550 280, 600 280"
                      stroke="var(--st-danger)"
                      strokeWidth="2"
                      fill="none"
                      markerEnd="url(#arrow-red)"
                    />
                    <text
                      x="530"
                      y="240"
                      fill="var(--st-danger)"
                      fontSize="12"
                      className="font-medium"
                    >
                      No
                    </text>
                    <path
                      d="M 800 280 C 850 280, 850 180, 900 180"
                      stroke="var(--st-status-ok)"
                      strokeWidth="2"
                      fill="none"
                      markerEnd="url(#arrow-green)"
                    />
                    <path
                      d="M 800 280 C 850 280, 850 380, 900 380"
                      stroke="var(--st-danger)"
                      strokeWidth="2"
                      fill="none"
                      markerEnd="url(#arrow-red)"
                    />

                    <defs>
                      <marker
                        id="arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--st-border-strong)" />
                      </marker>
                      <marker
                        id="arrow-green"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--st-status-ok)" />
                      </marker>
                      <marker
                        id="arrow-red"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--st-danger)" />
                      </marker>
                    </defs>
                  </svg>

                  {/* Nodes */}
                  {flowNodes.map((node) => (
                    <div
                      key={node.id}
                      className="absolute p-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] w-[200px] bg-[var(--st-bg)] shadow-sm transition-transform hover:scale-105 cursor-pointer flex flex-col gap-3"
                      style={{ left: node.x, top: node.y }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)]">
                          <node.icon className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <span className="font-semibold text-sm">{node.title}</span>
                      </div>
                      {node.type === "condition" && (
                        <div className="flex justify-between px-1">
                          <Badge tone="success">Yes</Badge>
                          <Badge tone="danger">No</Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bottom Bar */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
                  <div className="bg-[var(--st-bg)] px-4 py-2 rounded-[var(--st-radius)] border border-[var(--st-border)] pointer-events-auto text-xs text-[var(--st-text-secondary)]">
                    Auto-saved 2 mins ago
                  </div>
                  <div className="flex gap-3 pointer-events-auto">
                    <Button variant="secondary">Discard Changes</Button>
                    <Button variant="primary" iconLeft={Save}>
                      Publish Flow
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Queues Tab */}
          <TabsContent value="queues">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {queueStats.map((stat) => (
                  <StatCard
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    icon={stat.icon}
                    accent={stat.accent}
                  />
                ))}
              </div>

              <Card padding="none" className="overflow-hidden">
                <div className="p-6 border-b border-[var(--st-border)] flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="w-full sm:w-96">
                    <Field label="Search queues">
                      <Input
                        type="text"
                        placeholder="Search queues..."
                        iconLeft={Search}
                      />
                    </Field>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button variant="secondary" iconLeft={Filter} className="flex-1 sm:flex-none">
                      Filter
                    </Button>
                    <Button variant="primary" iconLeft={Plus} className="flex-1 sm:flex-none">
                      New Queue
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <Tr>
                        <Th>Queue Name</Th>
                        <Th>Status</Th>
                        <Th>Assigned Agents</Th>
                        <Th>Routing Strategy</Th>
                        <Th>Avg Wait Time</Th>
                        <Th align="right">Actions</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {mockQueues.map((queue) => (
                        <Tr
                          key={queue.id}
                          selected={selectedQueue === queue.id}
                          className="group cursor-pointer"
                          onClick={() => setSelectedQueue(queue.id)}
                        >
                          <Td>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] flex items-center justify-center text-[var(--st-accent)] font-bold border border-[var(--st-border)]">
                                {queue.name.charAt(0)}
                              </div>
                              <span className="font-medium">{queue.name}</span>
                            </div>
                          </Td>
                          <Td>
                            {queue.active ? (
                              <Badge tone="success">
                                <CheckCircle className="w-3 h-3" aria-hidden="true" />
                                Active
                              </Badge>
                            ) : (
                              <Badge tone="neutral">
                                <XSquare className="w-3 h-3" aria-hidden="true" />
                                Inactive
                              </Badge>
                            )}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <Users
                                className="w-4 h-4 text-[var(--st-text-tertiary)]"
                                aria-hidden="true"
                              />
                              <span>{queue.agents} agents</span>
                            </div>
                          </Td>
                          <Td>
                            <Badge tone="neutral" kind="outline">
                              {queue.strategy}
                            </Badge>
                          </Td>
                          <Td className="text-[var(--st-text-secondary)] font-medium">
                            {queue.avgWait}
                          </Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <IconButton
                                label={`Edit ${queue.name}`}
                                icon={Edit}
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <IconButton
                                label={`Delete ${queue.name}`}
                                icon={Trash2}
                                size="sm"
                                variant="danger"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <IconButton
                                label={`More options for ${queue.name}`}
                                icon={MoreVertical}
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules">
            <div className="space-y-6">
              <Card padding="none" className="overflow-hidden">
                <div className="p-6 border-b border-[var(--st-border)] flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Sliders className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                    Pre-Routing Rules
                  </CardTitle>
                  <Button variant="primary" size="sm" iconLeft={Plus}>
                    Add Rule
                  </Button>
                </div>

                <div>
                  {mockRules.map((rule, index) => (
                    <div
                      key={rule.id}
                      className="p-6 border-b border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)] transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center"
                    >
                      <div className="flex items-center gap-4 w-12 justify-center">
                        <GripVertical
                          className="w-5 h-5 text-[var(--st-text-tertiary)] cursor-grab"
                          aria-hidden="true"
                        />
                        <span className="text-[var(--st-text-tertiary)] font-mono text-sm">
                          #{index + 1}
                        </span>
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{rule.name}</h3>
                          {rule.status === "active" ? (
                            <Badge tone="success">Active</Badge>
                          ) : (
                            <Badge tone="neutral">Inactive</Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="text-[var(--st-text-secondary)]">IF</span>
                          <div className="px-3 py-1.5 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)] text-[var(--st-text)] font-mono">
                            {rule.condition}
                          </div>
                          <span className="text-[var(--st-text-secondary)]">THEN</span>
                          <div className="px-3 py-1.5 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] border border-[var(--st-border)] text-[var(--st-accent)] font-mono flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                            {rule.action}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row items-end md:items-center gap-6">
                        <div className="text-right">
                          <p className="text-2xl font-light text-[var(--st-text)]">
                            {rule.matches.toLocaleString()}
                          </p>
                          <p className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider">
                            Executions
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {rule.status === "active" ? (
                            <IconButton
                              label={`Deactivate ${rule.name}`}
                              icon={ToggleRight}
                              variant="ghost"
                            />
                          ) : (
                            <IconButton
                              label={`Activate ${rule.name}`}
                              icon={ToggleLeft}
                              variant="ghost"
                            />
                          )}
                          <IconButton
                            label={`Edit ${rule.name}`}
                            icon={Edit}
                            size="sm"
                          />
                          <IconButton
                            label={`Delete ${rule.name}`}
                            icon={Trash2}
                            size="sm"
                            variant="danger"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Global Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                  Global Settings
                </CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-[var(--st-text-secondary)]">
                  Global routing settings will appear here.
                </p>
              </CardBody>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
