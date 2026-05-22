"use client";

import React, { useMemo, useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { LuDownload, LuRefreshCw, LuTerminal, LuActivity, LuServer } from "react-icons/lu";

import { DataTable } from "@/components/zoruui/data-table";
import { Badge } from "@/components/zoruui/badge";
import { Button } from "@/components/zoruui/button";
import {
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from "@/components/zoruui/select";
import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
} from "@/components/zoruui/page-header";
import { Card } from "@/components/zoruui/card";

// ── Types ────────────────────────────────────────────────────────────────────

type LogSeverity = "info" | "warning" | "error" | "debug" | "critical";

export interface SystemLog {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  node: string;
  message: string;
  metadata: Record<string, any>;
}

// ── Mock Data Generator ───────────────────────────────────────────────────────

function generateMockLogs(count: number): SystemLog[] {
  const nodes = [
    "api-server",
    "auth-service",
    "webhook-listener",
    "db-worker",
    "sabflow-engine",
  ];
  const severities: LogSeverity[] = ["info", "info", "info", "warning", "error", "debug", "critical"];
  const messages = [
    "User authentication successful",
    "User login failed: Invalid credentials",
    "Webhook received payload successfully",
    "Worker node disconnected unexpectedly",
    "Database query execution slow",
    "Processing batch job #8372",
    "Memory usage exceeding 80% threshold",
    "SabFlow execution engine started",
    "Payment processing gateway timeout",
    "Cache miss for key user_192",
    "Disk space running low on /dev/sda1",
    "API rate limit exceeded for client_id 402",
    "Garbage collection cycle completed",
  ];

  const logs: SystemLog[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const s = severities[Math.floor(Math.random() * severities.length)];
    const node = nodes[Math.floor(Math.random() * nodes.length)];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    const timeOffset = Math.floor(Math.random() * 86400000 * 2); // past 48 hours
    const time = new Date(now - timeOffset).toISOString();

    logs.push({
      id: `log-${i}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: time,
      severity: s,
      node: node,
      message: msg,
      metadata: {
        latency: `${Math.floor(Math.random() * 500 + 10)}ms`,
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        ...(s === "error" || s === "critical"
          ? { errorCode: "E" + Math.floor(Math.random() * 9999) }
          : {}),
      },
    });
  }
  return logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ── Columns ───────────────────────────────────────────────────────────────────

const columns: ColumnDef<SystemLog>[] = [
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ row }) => {
      const date = new Date(row.original.timestamp);
      return (
        <span className="font-mono text-xs text-zoru-ink-muted whitespace-nowrap">
          {date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      );
    },
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => {
      const s = row.original.severity;
      const variantMap: Record<string, "info" | "warning" | "danger" | "ghost" | "destructive"> = {
        info: "info",
        warning: "warning",
        error: "danger",
        debug: "ghost",
        critical: "destructive",
      };
      return (
        <Badge variant={variantMap[s]} className="uppercase text-[10px] tracking-widest font-semibold px-2 py-0.5">
          {s}
        </Badge>
      );
    },
  },
  {
    accessorKey: "node",
    header: "Node",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <LuServer className="w-3.5 h-3.5 text-zoru-ink-subtle" />
        <span className="font-medium text-sm text-zoru-ink">{row.original.node}</span>
      </div>
    ),
  },
  {
    accessorKey: "message",
    header: "Message",
    cell: ({ row }) => (
      <div
        className="max-w-[400px] truncate text-sm text-zoru-ink font-medium"
        title={row.original.message}
      >
        {row.original.message}
      </div>
    ),
  },
  {
    accessorKey: "metadata",
    header: "Metadata",
    cell: ({ row }) => {
      const meta = row.original.metadata;
      return (
        <div className="flex flex-wrap gap-1.5 max-w-[300px]">
          {Object.entries(meta).map(([k, v]) => (
            <span
              key={k}
              className="px-1.5 py-0.5 rounded text-[10px] bg-zoru-surface border border-zoru-line text-zoru-ink-muted font-mono whitespace-nowrap"
            >
              <span className="opacity-60">{k}:</span> <span className="text-zoru-ink">{v as string}</span>
            </span>
          ))}
        </div>
      );
    },
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [nodeFilter, setNodeFilter] = useState<string>("all");

  const fetchLogs = () => {
    setLoading(true);
    // Simulate network delay
    setTimeout(() => {
      setLogs(generateMockLogs(150));
      setLoading(false);
    }, 600);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredData = useMemo(() => {
    return logs.filter((item) => {
      if (severityFilter !== "all" && item.severity !== severityFilter) return false;
      if (nodeFilter !== "all" && item.node !== nodeFilter) return false;
      return true;
    });
  }, [logs, severityFilter, nodeFilter]);

  return (
    <div className="min-h-screen bg-zoru-bg p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader className="mb-8">
          <ZoruPageHeading>
            <ZoruPageEyebrow className="flex items-center gap-1.5 text-blue-500">
              <LuActivity className="w-3.5 h-3.5" />
              Observability
            </ZoruPageEyebrow>
            <ZoruPageTitle>System Logs</ZoruPageTitle>
            <ZoruPageDescription>
              Monitor heavy system-level logs and activities across all infrastructure nodes. High-throughput event tracking for SabFlow execution engines and services.
            </ZoruPageDescription>
          </ZoruPageHeading>
          <ZoruPageActions>
            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <LuRefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
            <Button variant="default">
              <LuTerminal className="mr-2 h-4 w-4" />
              Live Tail
            </Button>
          </ZoruPageActions>
        </PageHeader>

        <Card className="p-0 border-zoru-line overflow-hidden shadow-[var(--zoru-shadow-sm)]">
          <DataTable
            className="p-5"
            columns={columns}
            data={filteredData}
            filterColumn="message"
            filterPlaceholder="Search logs by message..."
            pageSize={15}
            toolbar={
              <div className="flex items-center gap-3">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <ZoruSelectTrigger className="w-[140px]">
                    <ZoruSelectValue placeholder="Severity" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">All Severities</ZoruSelectItem>
                    <ZoruSelectItem value="info">Info</ZoruSelectItem>
                    <ZoruSelectItem value="warning">Warning</ZoruSelectItem>
                    <ZoruSelectItem value="error">Error</ZoruSelectItem>
                    <ZoruSelectItem value="debug">Debug</ZoruSelectItem>
                    <ZoruSelectItem value="critical">Critical</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>

                <Select value={nodeFilter} onValueChange={setNodeFilter}>
                  <ZoruSelectTrigger className="w-[160px]">
                    <ZoruSelectValue placeholder="Node" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">All Nodes</ZoruSelectItem>
                    <ZoruSelectItem value="api-server">API Server</ZoruSelectItem>
                    <ZoruSelectItem value="auth-service">Auth Service</ZoruSelectItem>
                    <ZoruSelectItem value="webhook-listener">Webhook Listener</ZoruSelectItem>
                    <ZoruSelectItem value="db-worker">DB Worker</ZoruSelectItem>
                    <ZoruSelectItem value="sabflow-engine">SabFlow Engine</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>

                <div className="w-px h-6 bg-zoru-line mx-1" />

                <Button variant="outline" size="sm" className="hidden sm:flex">
                  <LuDownload className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    </div>
  );
}
