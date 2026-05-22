"use client";

import React, { use, useState } from "react";
import { m } from "motion/react";
import {
  Globe,
  Database,
  Code2,
  Server,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  ArrowRight,
  ArrowLeft,
  TerminalSquare,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type NodeStatus = "success" | "running" | "error" | "pending";

interface NodeData {
  id: string;
  type: string;
  title: string;
  description: string;
  status: NodeStatus;
  duration: string;
  startTime: string;
  icon: React.ElementType;
  input: any;
  output: any;
  error?: string;
}

const MOCK_NODES: NodeData[] = [
  {
    id: "node-1",
    type: "trigger",
    title: "Webhook Trigger",
    description: "Received payload from Stripe checkout",
    status: "success",
    duration: "12ms",
    startTime: "10:00:00.000",
    icon: Globe,
    input: {
      headers: {
        "x-stripe-signature": "t=123,v1=abc",
        "content-type": "application/json",
      },
      body: {
        id: "evt_123",
        type: "checkout.session.completed",
        data: {
          object: { customer_email: "test@example.com", amount_total: 9900 },
        },
      },
    },
    output: {
      validated: true,
      extracted: { email: "test@example.com", amount: 9900 },
    },
  },
  {
    id: "node-2",
    type: "db-lookup",
    title: "Find User",
    description: "Query database for user by email",
    status: "success",
    duration: "45ms",
    startTime: "10:00:00.012",
    icon: Database,
    input: { email: "test@example.com" },
    output: {
      found: true,
      user: { id: "usr_999", name: "Alice Test", plan: "free" },
    },
  },
  {
    id: "node-3",
    type: "logic",
    title: "Check Plan Upgrade",
    description: "Evaluate if user needs plan upgrade",
    status: "success",
    duration: "5ms",
    startTime: "10:00:00.057",
    icon: Code2,
    input: { currentPlan: "free", purchasedPlan: "pro", amount: 9900 },
    output: { upgradeRequired: true, newPlan: "pro" },
  },
  {
    id: "node-4",
    type: "api-call",
    title: "Update Subscription",
    description: "Call external API to update billing status",
    status: "error",
    duration: "1200ms",
    startTime: "10:00:00.062",
    icon: Server,
    input: { userId: "usr_999", newPlan: "pro" },
    output: null,
    error: "API Timeout: Billing service did not respond within 1000ms.",
  },
  {
    id: "node-5",
    type: "email",
    title: "Send Welcome Email",
    description: "Send confirmation to user",
    status: "pending",
    duration: "-",
    startTime: "-",
    icon: Mail,
    input: { to: "test@example.com", template: "welcome_pro" },
    output: null,
  },
];

const statusToVariant = (
  status: NodeStatus
): "success" | "info" | "destructive" | "secondary" => {
  switch (status) {
    case "success":
      return "success";
    case "running":
      return "info";
    case "error":
      return "destructive";
    case "pending":
    default:
      return "secondary";
  }
};

const statusIcon = (status: NodeStatus) => {
  switch (status) {
    case "success":
      return <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline-block" />;
    case "running":
      return <Activity className="w-3.5 h-3.5 mr-1 inline-block animate-pulse" />;
    case "error":
      return <XCircle className="w-3.5 h-3.5 mr-1 inline-block" />;
    case "pending":
    default:
      return <Clock className="w-3.5 h-3.5 mr-1 inline-block" />;
  }
};

export default function ExecutionReplayPage({
  params,
}: {
  params: Promise<{ executionId: string }>;
}) {
  const resolvedParams = use(params);
  const [selectedNode, setSelectedNode] = useState<NodeData>(MOCK_NODES[0]);

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader
        title="Execution Replay"
        subtitle={`Execution ID: ${resolvedParams.executionId}`}
        icon={TerminalSquare}
        breadcrumb={
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Dashboard</span>
            <span className="text-xs">&bull;</span>
            <span>Sabflow</span>
            <span className="text-xs">&bull;</span>
            <span className="text-foreground font-medium">Replay</span>
          </div>
        }
        actions={
          <Badge variant="outline" className="text-sm py-1 px-3 shadow-sm">
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
              Failed Execution
            </span>
          </Badge>
        }
      />

      <div className="flex flex-1 gap-6 min-h-[600px] overflow-hidden">
        {/* Left Pane - Visual Timeline */}
        <div className="w-1/3 flex flex-col shrink-0">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 pl-1">
            Execution Path
          </h2>
          <ScrollArea className="flex-1 pr-4">
            <div className="relative space-y-4 pb-10">
              {/* Vertical line connecting nodes */}
              <div className="absolute left-[1.35rem] top-8 bottom-4 w-[2px] bg-border z-0" />

              {MOCK_NODES.map((node) => {
                const isSelected = selectedNode.id === node.id;
                return (
                  <m.div
                    key={node.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      interactive
                      variant={isSelected ? "interactive" : "default"}
                      onClick={() => setSelectedNode(node)}
                      className={cn(
                        "relative z-10 transition-all border-l-4",
                        isSelected
                          ? "border-l-indigo-500 ring-1 ring-indigo-500/20"
                          : "border-l-transparent",
                        node.status === "error" && !isSelected && "border-l-destructive",
                        node.status === "success" && !isSelected && "border-l-emerald-500"
                      )}
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-xl shadow-sm",
                                isSelected
                                  ? "bg-indigo-500 text-white"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              <node.icon className="w-4 h-4" />
                            </div>
                            <div>
                              <CardTitle className="text-[15px]">
                                {node.title}
                              </CardTitle>
                              <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 inline-block">
                                {node.type}
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant={statusToVariant(node.status)}
                            className="capitalize shrink-0 text-[10px] px-2 py-0"
                          >
                            {statusIcon(node.status)}
                            {node.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-1">
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {node.description}
                        </p>
                      </CardContent>
                    </Card>
                  </m.div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Pane - Raw JSON Logs */}
        <div className="w-2/3 flex flex-col bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="bg-muted/40 border-b p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <selectedNode.icon className="w-5 h-5 text-indigo-500" />
                  {selectedNode.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedNode.description}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline" className="font-mono text-xs shadow-sm">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  {selectedNode.duration}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">
                  Start: {selectedNode.startTime}
                </span>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-6 bg-zinc-50 dark:bg-zinc-950/50">
            {selectedNode.error && (
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-4 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-xl flex items-start gap-3 shadow-sm"
              >
                <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-semibold mb-1">Execution Error</span>
                  <span className="text-destructive/90">{selectedNode.error}</span>
                </div>
              </m.div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {/* Input Log */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80 uppercase tracking-wider">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  Input Payload
                </h4>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative bg-[#0d1117] border border-border/50 rounded-xl p-4 overflow-x-auto shadow-inner">
                    <pre className="text-[13px] font-mono leading-relaxed text-[#7ee787]">
                      {JSON.stringify(selectedNode.input, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Output Log */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80 uppercase tracking-wider">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md">
                    <ArrowLeft className="w-4 h-4" />
                  </div>
                  Output Result
                </h4>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative bg-[#0d1117] border border-border/50 rounded-xl p-4 overflow-x-auto shadow-inner min-h-[100px] flex flex-col justify-center">
                    {selectedNode.output ? (
                      <pre className="text-[13px] font-mono leading-relaxed text-[#79c0ff]">
                        {JSON.stringify(selectedNode.output, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-center text-muted-foreground/60 italic text-sm">
                        {selectedNode.status === "pending"
                          ? "Node has not executed yet"
                          : "No output generated"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
