"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Download, RefreshCw, Terminal, Activity, Server, Circle } from "lucide-react";

import { DataTable, type DataTableColumn } from '@/components/sabcrm/20ui';
import { Badge, type BadgeTone } from '@/components/sabcrm/20ui';
import { Button } from '@/components/sabcrm/20ui';
import { Input } from '@/components/sabcrm/20ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import { Card } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';

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

// ── Columns ───────────────────────────────────────────────────────────────────

const SEVERITY_TONE: Record<LogSeverity, BadgeTone> = {
  info: "info",
  warning: "warning",
  error: "danger",
  debug: "neutral",
  critical: "danger",
};

const columns: DataTableColumn<SystemLog>[] = [
  {
    key: "timestamp",
    header: "Timestamp",
    render: (row) => {
      const date = new Date(row.timestamp);
      return (
        <span className="font-mono text-xs text-[var(--st-text-secondary)] whitespace-nowrap">
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
    key: "severity",
    header: "Severity",
    render: (row) => (
      <Badge tone={SEVERITY_TONE[row.severity]} className="uppercase text-[10px] tracking-widest font-semibold px-2 py-0.5">
        {row.severity}
      </Badge>
    ),
  },
  {
    key: "node",
    header: "Node",
    render: (row) => (
      <div className="flex items-center gap-2">
        <Server className="w-3.5 h-3.5 text-[var(--st-text-tertiary)]" />
        <span className="font-medium text-sm text-[var(--st-text)]">{row.node}</span>
      </div>
    ),
  },
  {
    key: "message",
    header: "Message",
    render: (row) => (
      <div
        className="max-w-[400px] truncate text-sm text-[var(--st-text)] font-medium"
        title={row.message}
      >
        {row.message}
      </div>
    ),
  },
  {
    key: "metadata",
    header: "Metadata",
    render: (row) => (
      <div className="flex flex-wrap gap-1.5 max-w-[300px]">
        {Object.entries(row.metadata).map(([k, v]) => (
          <span
            key={k}
            className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--st-bg-secondary)] border border-[var(--st-border)] text-[var(--st-text-secondary)] font-mono whitespace-nowrap"
          >
            <span className="opacity-60">{k}:</span> <span className="text-[var(--st-text)]">{v as string}</span>
          </span>
        ))}
      </div>
    ),
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveTail, setLiveTail] = useState(false);
  const liveTailRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [nodeFilter, setNodeFilter] = useState<string>("all");
  const [messageFilter, setMessageFilter] = useState<string>("");

  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sabflow/logs?limit=300', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as {
        logs?: SystemLog[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load logs');
      setLogs(json.logs ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Start/stop live tail polling
  useEffect(() => {
    if (liveTail) {
      // Fetch immediately then poll every 3 seconds
      fetchLogs();
      liveTailRef.current = setInterval(() => {
        fetchLogs();
      }, 3000);
    } else {
      if (liveTailRef.current !== null) {
        clearInterval(liveTailRef.current);
        liveTailRef.current = null;
      }
    }
    return () => {
      if (liveTailRef.current !== null) {
        clearInterval(liveTailRef.current);
        liveTailRef.current = null;
      }
    };
  }, [liveTail, fetchLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredData = useMemo(() => {
    const query = messageFilter.trim().toLowerCase();
    return logs.filter((item) => {
      if (severityFilter !== "all" && item.severity !== severityFilter) return false;
      if (nodeFilter !== "all" && item.node !== nodeFilter) return false;
      if (query && !item.message.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [logs, severityFilter, nodeFilter, messageFilter]);

  const nodeOptions = useMemo(
    () => [...new Set(logs.map((l) => l.node))].sort(),
    [logs],
  );

  const exportCsv = useCallback(() => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      'timestamp,severity,node,message,metadata',
      ...filteredData.map((l) =>
        [
          l.timestamp,
          l.severity,
          esc(l.node),
          esc(l.message),
          esc(Object.entries(l.metadata).map(([k, v]) => `${k}=${v}`).join(' ')),
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sabflow-logs-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredData]);

  return (
    <SabflowPage
      breadcrumb={[...SABFLOW_CRUMBS, { label: 'Logs' }]}
      eyebrow={
        <span className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" aria-hidden="true" />
          Observability
        </span>
      }
      title="System Logs"
      description="Execution and node-level log lines derived from your flow runs — filter by severity, node type, or message."
      actions={
        <>
          <Button variant="outline" onClick={fetchLogs} disabled={loading || liveTail}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
          <Button
            variant={liveTail ? "default" : "outline"}
            onClick={() => setLiveTail((prev) => !prev)}
          >
            {liveTail ? (
              <Circle className="mr-2 h-4 w-4 animate-pulse fill-current" />
            ) : (
              <Terminal className="mr-2 h-4 w-4" />
            )}
            {liveTail ? "Stop Tail" : "Live Tail"}
          </Button>
        </>
      }
    >
      <div>
        {/* Count summary — shows real fetched total and how many pass current filters */}
        <div className="flex items-center gap-4 mb-3 px-1 text-xs text-[var(--st-text-secondary)]">
          <span>
            Showing <span className="font-semibold text-[var(--st-text)]">{filteredData.length}</span> log
            {filteredData.length !== 1 ? "s" : ""}
            {filteredData.length !== logs.length ? (
              <> (filtered from <span className="font-semibold text-[var(--st-text)]">{logs.length}</span> total)</>
            ) : (
              <> total</>
            )}
          </span>
          {liveTail && (
            <span className="flex items-center gap-1 text-[var(--st-status-ok)] font-medium">
              <Circle className="w-2.5 h-2.5 animate-pulse fill-current" />
              Live — refreshing every 3s
            </span>
          )}
        </div>

        <Card className="p-0 border-[var(--st-border)] overflow-hidden shadow-[var(--st-shadow-sm)]">
          <div className="flex flex-wrap items-center gap-3 p-5 pb-0">
            <Input
              className="w-[240px]"
              value={messageFilter}
              onChange={(e) => setMessageFilter(e.target.value)}
              placeholder="Search logs by message..."
              aria-label="Search logs by message"
            />

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>

            <Select value={nodeFilter} onValueChange={setNodeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Node" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Nodes</SelectItem>
                {nodeOptions.map((node) => (
                  <SelectItem key={node} value={node}>
                    {node}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="w-px h-6 bg-[var(--st-border)] mx-1" />

            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex"
              onClick={exportCsv}
              disabled={filteredData.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {error ? (
            <div className="p-8 text-center text-sm text-[var(--st-danger)]">
              {error}
            </div>
          ) : (
            <DataTable
              className="p-5"
              columns={columns}
              rows={filteredData}
              getRowId={(row) => row.id}
            />
          )}
        </Card>
      </div>
    </SabflowPage>
  );
}
