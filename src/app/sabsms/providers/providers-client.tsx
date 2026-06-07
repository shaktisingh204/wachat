"use client";

import React, { useState, useEffect } from "react";
import { ChevronRight, ServerCog, Activity, ExternalLink, ActivitySquare, CheckCircle2, XCircle, AlertCircle, Zap, Globe, ShieldCheck, RefreshCw, ShoppingBag } from "lucide-react";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { SabsmsDataTable, SabsmsColumn } from "@/components/sabsms/page-toolkit/sabsms-data-table";
import { SabsmsDetailDrawer } from "@/components/sabsms/page-toolkit/sabsms-detail-drawer";
import { SabsmsFilterBar } from "@/components/sabsms/page-toolkit/sabsms-filter-bar";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/sabcrm/20ui";
import type { LucideIcon } from "lucide-react";
import { pingProvidersAction } from "./actions";

export interface ProviderRow {
  id: string;
  provider: string;
  region?: string;
  isDefault: boolean;
  status: string;
  lastError?: string;
  lastSuccessfulSend?: string;
  sendVolume24h?: number;
  pricingTier?: string;
  webhookUrl?: string;
}

export interface ProviderCatalogItem {
  id: string;
  name: string;
  available: boolean;
  region: string;
}

type StatusTone = "success" | "warning" | "danger" | "neutral";

function statusPresentation(status: string): { icon: LucideIcon; label: string; tone: StatusTone } {
  if (status === "active") return { icon: CheckCircle2, label: "Operational", tone: "success" };
  if (status === "degraded") return { icon: AlertCircle, label: "Degraded", tone: "warning" };
  if (status === "outage") return { icon: XCircle, label: "Outage", tone: "danger" };
  return { icon: CheckCircle2, label: "Unknown", tone: "neutral" };
}

function RealConnectionStatuses({ rows, isPinging }: { rows: ProviderRow[]; isPinging: boolean }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {rows.map((r) => {
        const { icon: Icon, label, tone } = statusPresentation(r.status);
        return (
          <Card
            key={r.id}
            padding="none"
            className={`p-4 flex items-center justify-between transition-opacity ${isPinging ? "opacity-50" : "opacity-100"}`}
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]" aria-hidden="true">
                <Icon className="h-5 w-5 text-[var(--st-text)]" />
              </span>
              <div>
                <div className="text-sm font-medium text-[var(--st-text)]">{r.provider}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  {r.status === "active" ? "Latency: <50ms" : r.lastError || "Connection issues"}
                </div>
              </div>
            </div>
            <Badge tone={tone}>{label}</Badge>
          </Card>
        );
      })}
    </div>
  );
}

interface CapabilityRow {
  icon: LucideIcon;
  capability: string;
  twilio: string;
  nexmo: string;
}

const CAPABILITY_ROWS: CapabilityRow[] = [
  { icon: Globe, capability: "Global SMS", twilio: "Supported", nexmo: "Supported" },
  { icon: ActivitySquare, capability: "WhatsApp Business", twilio: "Supported", nexmo: "Supported" },
  { icon: ShieldCheck, capability: "10DLC Registration", twilio: "Native API", nexmo: "Manual Process" },
  { icon: ServerCog, capability: "Alphanumeric Sender ID", twilio: "Supported", nexmo: "Supported" },
  { icon: Activity, capability: "Delivery Receipts", twilio: "Real-time Webhooks", nexmo: "Real-time Webhooks" },
  { icon: Zap, capability: "Omnichannel Routing", twilio: "Conversations API", nexmo: "Messages API" },
];

function FeatureGrid() {
  return (
    <Card padding="none" className="overflow-hidden mt-6">
      <CardHeader className="p-6 bg-[var(--st-bg-secondary)]">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
          Provider Capabilities Matrix
        </CardTitle>
        <CardDescription>Detailed comparison of feature support across primary SMS gateways.</CardDescription>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <THead>
            <Tr>
              <Th width="33.33%">Capability</Th>
              <Th width="33.33%">Twilio</Th>
              <Th width="33.33%">Nexmo (Vonage)</Th>
            </Tr>
          </THead>
          <TBody>
            {CAPABILITY_ROWS.map((row) => {
              const RowIcon = row.icon;
              return (
                <Tr key={row.capability}>
                  <Td>
                    <span className="font-medium flex items-center gap-2">
                      <RowIcon className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                      {row.capability}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone="neutral">{row.twilio}</Badge>
                  </Td>
                  <Td>
                    <Badge tone="neutral">{row.nexmo}</Badge>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}

export function ProvidersClient({
  initialRows,
  catalog,
}: {
  initialRows: ProviderRow[];
  catalog: ProviderCatalogItem[];
}) {
  const [rows, setRows] = useState<ProviderRow[]>(initialRows);
  const [selectedProvider, setSelectedProvider] = useState<ProviderRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [query] = useState("");
  const [isPinging, setIsPinging] = useState(false);

  const handleRefreshStatuses = async () => {
    setIsPinging(true);
    try {
      const res = await pingProvidersAction();
      if (res.success && res.rows) {
        setRows(res.rows);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    // Background job to ping statuses every 30 seconds.
    const interval = setInterval(() => {
      handleRefreshStatuses();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: SabsmsColumn<ProviderRow>[] = [
    {
      id: "provider",
      header: "Provider",
      render: (r) => (
        <div className="font-medium flex items-center gap-2">
          {r.provider}
          {r.isDefault && <Badge tone="accent">Default</Badge>}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (r) => {
        const { tone } = statusPresentation(r.status);
        return <Badge tone={tone}>{r.status}</Badge>;
      },
    },
    {
      id: "region",
      header: "Region",
      render: (r) => r.region || "Global",
    },
    {
      id: "volume",
      header: "24h Volume",
      render: (r) => r.sendVolume24h?.toLocaleString() || "0",
    },
    {
      id: "lastSuccess",
      header: "Last Success",
      render: (r) => r.lastSuccessfulSend || "Never",
    },
  ];

  const rowActions = [
    {
      label: "Test connection",
      onSelect: () => alert("Testing connection..."),
    },
    {
      label: "Edit credentials",
      onSelect: () => alert("Edit dialog..."),
    },
    {
      label: "Set as default",
      onSelect: () => alert("Set as default..."),
    },
    {
      label: "Disable account",
      destructive: true,
      onSelect: () => alert("Disable..."),
    },
  ];

  const filteredRows = rows.filter((r) => r.provider.toLowerCase().includes(query.toLowerCase()));

  return (
    <SabsmsPageShell
      title="Providers"
      eyebrow="Infrastructure"
      description="Connected SMS gateways for outbound routing."
      breadcrumbs={[{ label: "Providers" }]}
      primaryAction={{
        label: "Add Provider",
        onClick: () => setAddDialogOpen(true),
      }}
      secondaryActions={[
        { label: "Refresh Status", icon: <RefreshCw className={`h-4 w-4 ${isPinging ? "animate-spin" : ""}`} aria-hidden="true" />, onSelectAction: handleRefreshStatuses },
        { label: "Failover priority", icon: <ActivitySquare className="h-4 w-4" aria-hidden="true" />, onSelectAction: () => alert("Failover priority modal") },
        { label: "Audit log", onSelectHref: "/sabsms/logs?type=audit" },
      ]}
      helpTitle="Provider accounts"
      helpBody="Manage your SMS gateway credentials. Phase 1 supports Twilio. Multi-provider routing in Phase 7."
    >
      <RealConnectionStatuses rows={rows} isPinging={isPinging} />

      <Card padding="none" className="p-4 flex flex-col gap-4 mb-6">
        <CardHeader className="px-2">
          <CardTitle className="text-lg font-semibold">Configured Accounts</CardTitle>
          <CardDescription>Active and disabled SMS gateway connections.</CardDescription>
        </CardHeader>
        <SabsmsFilterBar searchKey="q" searchPlaceholder="Search providers..." />
        <div>
          <SabsmsDataTable
            rows={filteredRows}
            columns={columns}
            rowKey={(r) => r.id}
            rowActions={rowActions}
            onRowClick={(r) => {
              setSelectedProvider(r);
              setDrawerOpen(true);
            }}
            emptyIcon={<ServerCog className="h-10 w-10 text-[var(--st-text-secondary)]" aria-hidden="true" />}
            emptyTitle="No providers configured"
            emptyDescription="Add a provider account to start sending messages."
            emptyAction={{ label: "Add Provider", onClick: () => setAddDialogOpen(true) }}
          />
        </div>
      </Card>

      <Card padding="none" className="p-4 flex flex-col gap-4">
        <CardHeader className="px-2 mb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[var(--st-text)]" aria-hidden="true" />
            Aggregator Marketplace
          </CardTitle>
          <CardDescription>Discover and configure new SMS and communication providers for your workspace.</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
          {catalog.map((p) => (
            <Card key={p.id} variant="interactive" padding="none" className="p-4 flex flex-col justify-between">
              <CardBody className="p-0">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-[var(--st-text)]">{p.name}</div>
                  <Badge tone={p.available ? "success" : "neutral"}>{p.available ? "Available" : "Coming Soon"}</Badge>
                </div>
                <div className="text-xs text-[var(--st-text-secondary)] mb-6 flex items-center gap-1">
                  <Globe className="h-3 w-3" aria-hidden="true" /> {p.region}
                </div>
              </CardBody>
              <CardFooter className="p-0">
                <Button
                  variant={p.available ? "primary" : "outline"}
                  disabled={!p.available}
                  size="sm"
                  block
                  onClick={() => alert(`Configure ${p.name}`)}
                >
                  {p.available ? "Configure" : "Join Waitlist"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </Card>

      <FeatureGrid />

      <SabsmsDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={selectedProvider?.provider || "Provider Details"}
        description={`Workspace ID mapping for ${selectedProvider?.provider}`}
      >
        {selectedProvider && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-[var(--st-text)] mb-1">Status</div>
                <Badge tone={statusPresentation(selectedProvider.status).tone}>{selectedProvider.status}</Badge>
              </div>
              <div>
                <div className="font-medium text-[var(--st-text)] mb-1">Pricing Tier</div>
                <div className="text-[var(--st-text-secondary)]">{selectedProvider.pricingTier || "Standard"}</div>
              </div>
              <div>
                <div className="font-medium text-[var(--st-text)] mb-1">Last Error</div>
                <div className={selectedProvider.lastError ? "text-[var(--st-danger)]" : "text-[var(--st-text-secondary)]"}>
                  {selectedProvider.lastError || "None"}
                </div>
              </div>
              <div>
                <div className="font-medium text-[var(--st-text)] mb-1">Webhook URL</div>
                <div className="font-mono text-xs text-[var(--st-text-secondary)]">
                  {selectedProvider.webhookUrl || `https://api.sabsms.io/webhooks/${selectedProvider.provider}`}
                </div>
              </div>
            </div>
            <Card padding="none" className="p-4">
              <div className="font-medium mb-4 flex items-center justify-between text-[var(--st-text)]">
                Cost vs Margin
                <Activity className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              </div>
              <div className="h-32 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)] flex items-center justify-center text-[var(--st-text-secondary)] text-sm">
                Chart placeholder (S16)
              </div>
            </Card>
            <div className="flex flex-col gap-2">
              <Button variant="outline" block className="justify-between" iconRight={ChevronRight} onClick={() => alert("Routing override...")}>
                Per-country routing override
              </Button>
              <Button variant="outline" block className="justify-between" iconRight={ExternalLink} onClick={() => alert("Docs link")}>
                Provider documentation
              </Button>
              <Button variant="outline" block className="justify-between" iconRight={ActivitySquare} onClick={() => alert("Health monitor")}>
                Health monitor
              </Button>
            </div>
          </div>
        )}
      </SabsmsDetailDrawer>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Provider Catalog</DialogTitle>
            <DialogDescription>Select a provider to configure your workspace credentials.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {catalog.map((p) => (
              <Card key={p.id} variant="interactive" padding="none" className="p-3 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-[var(--st-text)]">{p.name}</div>
                  <Badge tone={p.available ? "success" : "neutral"}>{p.available ? "Available" : "Phase 7"}</Badge>
                </div>
                <div className="text-xs text-[var(--st-text-secondary)] mb-4">{p.region}</div>
                <Button disabled={!p.available} size="sm" block onClick={() => alert(`Add ${p.name}`)}>
                  Configure
                </Button>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}
