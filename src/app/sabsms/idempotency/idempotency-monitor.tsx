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
  Trash2,
  Settings
} from "lucide-react";

import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, StatCard } from '@/components/sabcrm/20ui';

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { SabsmsFilterBar, type SabsmsFacet } from "@/components/sabsms/page-toolkit/sabsms-filter-bar";
import { SabsmsDataTable, type SabsmsColumn } from "@/components/sabsms/page-toolkit/sabsms-data-table";

import { 
  fetchIdempotencyKeys, 
  configureRetentionPolicy, 
  invalidateIdempotencyKeys,
  seedMockDataIfEmpty 
} from "./actions";

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
  const [data, setData] = React.useState<IdempotencyKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  
  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      await seedMockDataIfEmpty();
      const keys = await fetchIdempotencyKeys(searchQuery);
      setData(keys);
      setLoading(false);
    }
    loadData();
  }, [searchQuery]);

  const handleConfigureTTL = async () => {
    const ttlStr = prompt("Enter retention policy TTL in seconds (e.g., 86400 for 24 hours):", "86400");
    if (!ttlStr) return;
    const ttl = parseInt(ttlStr, 10);
    if (isNaN(ttl) || ttl <= 0) {
      alert("Invalid TTL value");
      return;
    }
    try {
      await configureRetentionPolicy(ttl);
      alert(`Successfully configured strict TTL index to ${ttl} seconds to prevent database bloat.`);
    } catch (e) {
      alert("Failed to configure retention policy");
    }
  };

  const handleInvalidate = async (ids: string[]) => {
    if (!confirm(`Are you sure you want to invalidate ${ids.length} key(s)?`)) return;
    await invalidateIdempotencyKeys(ids);
    const keys = await fetchIdempotencyKeys(searchQuery);
    setData(keys);
    setSelectedIds([]);
  };

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
      render: (r) => <span className="text-[var(--st-text)]">{r.apiKey}</span>,
    },
    {
      id: "firstSeen",
      header: "First / Last Seen",
      render: (r) => (
        <div className="flex flex-col text-xs text-[var(--st-text)]">
          <span>First: {new Date(r.firstSeen).toLocaleTimeString()}</span>
          <span>Last: {new Date(r.lastSeen).toLocaleTimeString()}</span>
        </div>
      ),
    },
    {
      id: "hash",
      header: "Request Hash",
      render: (r) => (
        <span className="font-mono text-xs text-[var(--st-text)] max-w-[120px] truncate block" title={r.hash}>
          {r.hash}
        </span>
      ),
    },
    {
      id: "cached",
      header: "Cached",
      render: (r) => (
        r.cached ? <Badge variant="default" className="bg-[var(--st-text)]">Hit</Badge> : <Badge variant="secondary">Miss</Badge>
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
          <span className="text-[var(--st-text-secondary)]">-</span>
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
        label: "Configure Retention",
        icon: <Settings className="h-4 w-4" />,
        onClick: handleConfigureTTL,
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
          onSearchChange={(val) => setSearchQuery(val)}
        />
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
        <StatCard label="Hit / Miss Ratio" value="94.2%" period="Last 24h" />
        <StatCard label="Active Keys" value={data.length.toString()} period="TTL active" />
        <StatCard label="Storage Utilisation" value="84 MB" period="Redis cache" />
        <StatCard label="Replay Blocks" value="128" period="Failures prevented" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4 text-[var(--st-text)]" /> Per-API-key Usage</CardTitle>
            <CardDescription>Top API keys by idempotency requests</CardDescription>
          </CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[var(--st-text)]" /> Per-endpoint Usage</CardTitle>
            <CardDescription>Top routes by idempotency requests</CardDescription>
          </CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>
      </div>

      <SabsmsDataTable
        rows={data}
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
            onSelect: () => handleInvalidate(selectedIds),
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
            onSelect: (r) => handleInvalidate([r.id]),
          },
        ]}
        page={1}
        pageSize={25}
        total={data.length}
      />
    </SabsmsPageShell>
  );
}
