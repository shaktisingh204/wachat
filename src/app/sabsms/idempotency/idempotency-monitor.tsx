"use client";

import * as React from "react";
import { 
  BarChart3, 
  BrainCircuit, 
  Database, 
  Download, 
  Eye, 
  History, 
  Link as LinkIcon, 
  Play, 
  RefreshCcw, 
  Save, 
  ShieldAlert, 
  Trash2 
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  StatCard,
} from "@/components/zoruui";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { SabsmsFilterBar, type SabsmsFacet } from "@/components/sabsms/page-toolkit/sabsms-filter-bar";
import { SabsmsDataTable, type SabsmsColumn } from "@/components/sabsms/page-toolkit/sabsms-data-table";

interface IdempotencyKey {
  id: string;
  key: string;
  route: string;
  apiKey: string;
  firstSeen: string;
  lastSeen: string;
  hash: string;
  cached: boolean;
  ttl: string;
  failures: number;
}

const mockData: IdempotencyKey[] = [
  {
    id: "idk_1",
    key: "req_xyz789",
    route: "POST /v1/messages",
    apiKey: "pk_test_123",
    firstSeen: "2026-05-22T10:00:00Z",
    lastSeen: "2026-05-22T10:00:05Z",
    hash: "sha256:abc123def456",
    cached: true,
    ttl: "23h 59m",
    failures: 0,
  },
  {
    id: "idk_2",
    key: "req_abc456",
    route: "POST /v1/campaigns",
    apiKey: "pk_prod_999",
    firstSeen: "2026-05-22T09:15:00Z",
    lastSeen: "2026-05-22T09:15:00Z",
    hash: "sha256:fed654cba321",
    cached: false,
    ttl: "23h 14m",
    failures: 2,
  },
  {
    id: "idk_3",
    key: "req_foo123",
    route: "POST /v1/messages",
    apiKey: "pk_prod_999",
    firstSeen: "2026-05-22T08:30:00Z",
    lastSeen: "2026-05-22T08:31:00Z",
    hash: "sha256:111222333444",
    cached: true,
    ttl: "22h 30m",
    failures: 0,
  },
];

const facets: SabsmsFacet[] = [
  {
    key: "route",
    label: "Route",
    multi: true,
    options: [
      { value: "POST /v1/messages", label: "POST /v1/messages" },
      { value: "POST /v1/campaigns", label: "POST /v1/campaigns" },
      { value: "POST /v1/drips", label: "POST /v1/drips" },
    ],
  },
  {
    key: "apiKey",
    label: "API Key",
    multi: true,
    options: [
      { value: "pk_test_123", label: "pk_test_123" },
      { value: "pk_prod_999", label: "pk_prod_999" },
    ],
  },
];

export function IdempotencyMonitor() {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  
  const columns: SabsmsColumn<IdempotencyKey>[] = [
    {
      id: "key",
      header: "Idempotency Key",
      render: (r) => <span className="font-mono text-sm">{r.key}</span>,
    },
    {
      id: "route",
      header: "Route",
      render: (r) => <Badge variant="outline">{r.route}</Badge>,
    },
    {
      id: "apiKey",
      header: "API Key",
      render: (r) => <span className="text-slate-600">{r.apiKey}</span>,
    },
    {
      id: "firstSeen",
      header: "First / Last Seen",
      render: (r) => (
        <div className="flex flex-col text-xs text-slate-500">
          <span>First: {new Date(r.firstSeen).toLocaleTimeString()}</span>
          <span>Last: {new Date(r.lastSeen).toLocaleTimeString()}</span>
        </div>
      ),
    },
    {
      id: "hash",
      header: "Request Hash",
      render: (r) => (
        <span className="font-mono text-xs text-slate-500 max-w-[120px] truncate block" title={r.hash}>
          {r.hash}
        </span>
      ),
    },
    {
      id: "cached",
      header: "Cached",
      render: (r) => (
        r.cached ? <Badge variant="default" className="bg-emerald-500">Hit</Badge> : <Badge variant="secondary">Miss</Badge>
      ),
    },
    {
      id: "ttl",
      header: "TTL",
      render: (r) => <span className="text-sm">{r.ttl}</span>,
    },
    {
      id: "failures",
      header: "Replay Failures",
      render: (r) => (
        r.failures > 0 ? (
          <Badge variant="destructive" className="flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" />
            {r.failures}
          </Badge>
        ) : (
          <span className="text-slate-400">-</span>
        )
      ),
    },
  ];

  return (
    <SabsmsPageShell
      title="Idempotency Monitor"
      eyebrow="Infrastructure"
      description="Monitor active idempotency keys, request hashes, TTLs, and replay-protection failures across all API endpoints."
      breadcrumbs={[{ label: "Infrastructure" }, { label: "Idempotency", href: "/sabsms/idempotency" }]}
      helpTitle="What is this page?"
      helpBody="This monitor tracks all requests bearing an Idempotency-Key header. It caches the original request hash and response to prevent duplicate executions (e.g. double-sends on network retry)."
      primaryAction={{
        label: "AI: Find Risky Patterns",
        onClick: () => alert("Analysing idempotency patterns..."),
      }}
      secondaryActions={[
        { label: "Export CSV", icon: <Download className="h-4 w-4" /> },
        { label: "Save View", icon: <Save className="h-4 w-4" /> },
        { label: "Share URL", icon: <LinkIcon className="h-4 w-4" /> },
      ]}
      toolbar={
        <SabsmsFilterBar
          searchKey="key"
          searchPlaceholder="Search idempotency keys or hashes..."
          facets={facets}
          sortOptions={[
            { value: "newest", label: "Newest First" },
            { value: "oldest", label: "Oldest First" },
            { value: "failures", label: "Most Failures" },
          ]}
          defaultSort="newest"
        />
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
        <StatCard label="Hit / Miss Ratio" value="94.2%" period="Last 24h" />
        <StatCard label="Active Keys" value="14,239" period="TTL active" />
        <StatCard label="Storage Utilisation" value="84 MB" period="Redis cache" />
        <StatCard label="Replay Blocks" value="128" period="Failures prevented" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="flex items-center gap-2"><Database className="h-4 w-4 text-slate-500" /> Per-API-key Usage</ZoruCardTitle>
            <ZoruCardDescription>Top API keys by idempotency requests</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-mono">pk_prod_999</span>
                <span className="font-medium">12,045 reqs</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-mono">pk_test_123</span>
                <span className="font-medium">2,194 reqs</span>
              </div>
            </div>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-slate-500" /> Per-endpoint Usage</ZoruCardTitle>
            <ZoruCardDescription>Top routes by idempotency requests</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <Badge variant="outline">POST /v1/messages</Badge>
                <span className="font-medium">10,500 reqs</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <Badge variant="outline">POST /v1/campaigns</Badge>
                <span className="font-medium">3,739 reqs</span>
              </div>
            </div>
          </ZoruCardContent>
        </Card>
      </div>

      <SabsmsDataTable
        rows={mockData}
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={[
          {
            label: "Bulk Invalidate",
            icon: <Trash2 className="h-4 w-4" />,
            destructive: true,
            onSelect: () => alert("Invalidated selected keys"),
          },
        ]}
        rowActions={[
          {
            label: "Sample payload viewer",
            icon: <Eye className="h-4 w-4" />,
            onSelect: (r) => alert(`Viewing payload for ${r.key}`),
          },
          {
            label: "Cache-warm test",
            icon: <Play className="h-4 w-4" />,
            onSelect: (r) => alert(`Testing cache warm for ${r.route}`),
          },
          {
            label: "Per-key audit",
            icon: <History className="h-4 w-4" />,
            onSelect: (r) => alert(`Audit log for ${r.key}`),
          },
          {
            label: "Invalidate Key",
            icon: <RefreshCcw className="h-4 w-4" />,
            destructive: true,
            onSelect: (r) => alert(`Invalidated ${r.key}`),
          },
        ]}
        page={1}
        pageSize={25}
        total={mockData.length}
      />
    </SabsmsPageShell>
  );
}
