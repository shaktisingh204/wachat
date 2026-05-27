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
  Dialog, 
  ZoruDialogContent, 
  ZoruDialogHeader, 
  ZoruDialogTitle, 
  ZoruDialogDescription 
} from "@/components/zoruui";
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

function RealConnectionStatuses({ rows, isPinging }: { rows: ProviderRow[], isPinging: boolean }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {rows.map(r => {
        let borderColor = "border-zoru-line";
        let bgColor = "bg-zoru-surface-2/30";
        let icon = <CheckCircle2 className="h-5 w-5 text-zoru-ink" />;
        let iconBg = "bg-zoru-surface-2";
        let statusBadge = "Unknown";
        let badgeColor = "bg-zoru-surface-2 text-zoru-ink border-zoru-line";

        if (r.status === "active") {
          borderColor = "border-zoru-line";
          bgColor = "bg-zoru-surface-2/30";
          icon = <CheckCircle2 className="h-5 w-5 text-zoru-ink" />;
          iconBg = "bg-zoru-surface-2";
          statusBadge = "Operational";
          badgeColor = "bg-zoru-surface-2 text-zoru-ink border-zoru-line";
        } else if (r.status === "degraded") {
          borderColor = "border-zoru-line";
          bgColor = "bg-zoru-surface-2/30";
          icon = <AlertCircle className="h-5 w-5 text-zoru-ink" />;
          iconBg = "bg-zoru-surface-2";
          statusBadge = "Degraded";
          badgeColor = "bg-zoru-surface-2 text-zoru-ink border-zoru-line";
        } else if (r.status === "outage") {
          borderColor = "border-zoru-line";
          bgColor = "bg-zoru-surface-2/30";
          icon = <XCircle className="h-5 w-5 text-zoru-ink" />;
          iconBg = "bg-zoru-surface-2";
          statusBadge = "Outage";
          badgeColor = "bg-zoru-surface-2 text-zoru-ink border-zoru-line";
        }

        return (
          <Card key={r.id} className={`p-4 flex items-center justify-between ${borderColor} ${bgColor} transition-opacity ${isPinging ? 'opacity-50' : 'opacity-100'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${iconBg}`}>
                {icon}
              </div>
              <div>
                <div className="text-sm font-medium text-zoru-ink">{r.provider}</div>
                <div className="text-xs text-zoru-ink">
                  {r.status === "active" ? "Latency: <50ms" : r.lastError || "Connection Issues"}
                </div>
              </div>
            </div>
            <Badge className={`${badgeColor} hover:${badgeColor}`}>
              {statusBadge}
            </Badge>
          </Card>
        );
      })}
    </div>
  );
}

function FeatureGrid() {
  return (
    <Card className="overflow-hidden mt-6 border-zoru-line shadow-sm">
      <div className="p-6 bg-gradient-to-r from-zoru-ink to-zoru-ink text-white">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-zoru-ink-muted" />
          Provider Capabilities Matrix
        </h3>
        <p className="text-sm text-zoru-ink-muted mt-1">Detailed comparison of feature support across primary SMS gateways.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse min-w-[600px]">
          <thead className="bg-zoru-surface-2 border-b border-zoru-line">
            <tr>
              <th className="p-4 font-semibold text-zoru-ink border-r border-zoru-line w-1/3">Capability</th>
              <th className="p-4 font-semibold text-zoru-ink border-r border-zoru-line w-1/3">Twilio</th>
              <th className="p-4 font-semibold text-zoru-ink w-1/3">Nexmo (Vonage)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zoru-line">
            <tr className="hover:bg-zoru-surface-2 transition-colors">
              <td className="p-4 border-r border-zoru-line font-medium flex items-center gap-2">
                <Globe className="h-4 w-4 text-zoru-ink-muted" /> Global SMS
              </td>
              <td className="p-4 border-r border-zoru-line"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Supported</Badge></td>
              <td className="p-4"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Supported</Badge></td>
            </tr>
            <tr className="hover:bg-zoru-surface-2 transition-colors">
              <td className="p-4 border-r border-zoru-line font-medium flex items-center gap-2">
                <ActivitySquare className="h-4 w-4 text-zoru-ink-muted" /> WhatsApp Business
              </td>
              <td className="p-4 border-r border-zoru-line"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Supported</Badge></td>
              <td className="p-4"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Supported</Badge></td>
            </tr>
            <tr className="hover:bg-zoru-surface-2 transition-colors">
              <td className="p-4 border-r border-zoru-line font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-zoru-ink-muted" /> 10DLC Registration
              </td>
              <td className="p-4 border-r border-zoru-line"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Native API</Badge></td>
              <td className="p-4"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Manual Process</Badge></td>
            </tr>
            <tr className="hover:bg-zoru-surface-2 transition-colors">
              <td className="p-4 border-r border-zoru-line font-medium flex items-center gap-2">
                <ServerCog className="h-4 w-4 text-zoru-ink-muted" /> Alphanumeric Sender ID
              </td>
              <td className="p-4 border-r border-zoru-line"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Supported</Badge></td>
              <td className="p-4"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Supported</Badge></td>
            </tr>
            <tr className="hover:bg-zoru-surface-2 transition-colors">
              <td className="p-4 border-r border-zoru-line font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-zoru-ink-muted" /> Delivery Receipts
              </td>
              <td className="p-4 border-r border-zoru-line"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Real-time Webhooks</Badge></td>
              <td className="p-4"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Real-time Webhooks</Badge></td>
            </tr>
            <tr className="hover:bg-zoru-surface-2 transition-colors">
              <td className="p-4 border-r border-zoru-line font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-zoru-ink-muted" /> Omnichannel Routing
              </td>
              <td className="p-4 border-r border-zoru-line"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Conversations API</Badge></td>
              <td className="p-4"><Badge className="bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 border-zoru-line">Messages API</Badge></td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ProvidersClient({ 
  initialRows, 
  catalog 
}: { 
  initialRows: ProviderRow[], 
  catalog: ProviderCatalogItem[] 
}) {
  const [rows, setRows] = useState<ProviderRow[]>(initialRows);
  const [selectedProvider, setSelectedProvider] = useState<ProviderRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    // Background job to ping statuses every 30 seconds
    const interval = setInterval(async () => {
      handleRefreshStatuses();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const columns: SabsmsColumn<ProviderRow>[] = [
    {
      id: "provider",
      header: "Provider",
      render: (r) => (
         <div className="font-medium flex items-center gap-2">
            {r.provider}
            {r.isDefault && <Badge variant="secondary">Default</Badge>}
         </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
         <Badge variant={r.status === "active" ? "default" : (r.status === "degraded" ? "secondary" : "destructive")}>
           {r.status}
         </Badge>
      )
    },
    {
      id: "region",
      header: "Region",
      render: (r) => r.region || "Global"
    },
    {
      id: "volume",
      header: "24h Volume",
      render: (r) => r.sendVolume24h?.toLocaleString() || "0"
    },
    {
      id: "lastSuccess",
      header: "Last Success",
      render: (r) => r.lastSuccessfulSend || "Never"
    }
  ];

  const rowActions = [
    {
      label: "Test connection",
      onSelect: () => alert("Testing connection...")
    },
    {
      label: "Edit credentials",
      onSelect: () => alert("Edit dialog...")
    },
    {
      label: "Set as default",
      onSelect: () => alert("Set as default...")
    },
    {
      label: "Disable account",
      destructive: true,
      onSelect: () => alert("Disable...")
    }
  ];

  const filteredRows = rows.filter(r => 
     r.provider.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <SabsmsPageShell
      title="Providers"
      eyebrow="Infrastructure"
      description="Connected SMS gateways for outbound routing."
      breadcrumbs={[ { label: "Providers" } ]}
      primaryAction={{
        label: "Add Provider",
        onClick: () => setAddDialogOpen(true)
      }}
      secondaryActions={[
        { label: "Refresh Status", icon: <RefreshCw className={`h-4 w-4 ${isPinging ? 'animate-spin' : ''}`}/>, onSelectAction: handleRefreshStatuses },
        { label: "Failover priority", icon: <ActivitySquare className="h-4 w-4"/>, onSelectAction: () => alert("Failover priority modal") },
        { label: "Audit log", onSelectHref: "/sabsms/logs?type=audit" }
      ]}
      helpTitle="Provider accounts"
      helpBody="Manage your SMS gateway credentials. Phase 1 supports Twilio. Multi-provider routing in Phase 7."
    >
       <RealConnectionStatuses rows={rows} isPinging={isPinging} />

       <Card className="p-4 flex flex-col gap-4 border-zoru-line shadow-sm mb-6">
         <div className="flex items-center justify-between px-2">
           <div>
             <h2 className="text-lg font-semibold text-zoru-ink">Configured Accounts</h2>
             <p className="text-sm text-zoru-ink">Active and disabled SMS gateway connections.</p>
           </div>
         </div>
         <SabsmsFilterBar
            searchKey="q"
            searchPlaceholder="Search providers..."
         />
         <div>
             <SabsmsDataTable
                rows={filteredRows}
                columns={columns}
                rowKey={r => r.id}
                rowActions={rowActions}
                onRowClick={(r) => { setSelectedProvider(r); setDrawerOpen(true); }}
                emptyIcon={<ServerCog className="h-10 w-10 text-zoru-ink-muted" />}
                emptyTitle="No providers configured"
                emptyDescription="Add a provider account to start sending messages."
                emptyAction={{ label: "Add Provider", onClick: () => setAddDialogOpen(true) }}
             />
         </div>
       </Card>

       <Card className="p-4 flex flex-col gap-4 border-zoru-line shadow-sm">
         <div className="flex items-center justify-between px-2 mb-2">
           <div>
             <h2 className="text-lg font-semibold text-zoru-ink flex items-center gap-2">
               <ShoppingBag className="h-5 w-5 text-zoru-ink" />
               Aggregator Marketplace
             </h2>
             <p className="text-sm text-zoru-ink">Discover and configure new SMS and communication providers for your workspace.</p>
           </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
           {catalog.map(p => (
              <div key={p.id} className="border border-zoru-line rounded-md p-4 flex flex-col justify-between hover:border-zoru-line transition-colors bg-white">
                 <div>
                   <div className="flex justify-between items-start mb-2">
                     <div className="font-semibold text-zoru-ink">{p.name}</div>
                     <Badge variant={p.available ? "default" : "secondary"}>
                       {p.available ? "Available" : "Coming Soon"}
                     </Badge>
                   </div>
                   <div className="text-xs text-zoru-ink mb-6 flex items-center gap-1">
                     <Globe className="h-3 w-3" /> {p.region}
                   </div>
                 </div>
                 <Button variant={p.available ? "default" : "outline"} disabled={!p.available} size="sm" className="w-full" onClick={() => alert(`Configure ${p.name}`)}>
                   {p.available ? "Configure" : "Join Waitlist"}
                 </Button>
              </div>
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
                  <div className="font-medium text-zoru-ink mb-1">Status</div>
                  <Badge variant={selectedProvider.status === "active" ? "default" : (selectedProvider.status === "degraded" ? "secondary" : "destructive")}>
                     {selectedProvider.status}
                  </Badge>
                </div>
                <div>
                  <div className="font-medium text-zoru-ink mb-1">Pricing Tier</div>
                  <div>{selectedProvider.pricingTier || "Standard"}</div>
                </div>
                <div>
                  <div className="font-medium text-zoru-ink mb-1">Last Error</div>
                  <div className={selectedProvider.lastError ? "text-zoru-ink" : ""}>{selectedProvider.lastError || "None"}</div>
                </div>
                <div>
                  <div className="font-medium text-zoru-ink mb-1">Webhook URL</div>
                  <div className="font-mono text-xs">{selectedProvider.webhookUrl || `https://api.sabsms.io/webhooks/${selectedProvider.provider}`}</div>
                </div>
              </div>
              <div className="border border-zoru-line rounded-md p-4">
                 <div className="font-medium mb-4 flex items-center justify-between">
                   Cost vs Margin
                   <Activity className="h-4 w-4 text-zoru-ink-muted" />
                 </div>
                 <div className="h-32 bg-zoru-surface-2 rounded border border-zoru-line flex items-center justify-center text-zoru-ink-muted text-sm">
                    Chart placeholder (S16)
                 </div>
              </div>
              <div className="flex flex-col gap-2">
                 <Button variant="outline" className="w-full justify-between" onClick={() => alert("Routing override...")}>
                    Per-country routing override
                    <ChevronRight className="h-4 w-4" />
                 </Button>
                 <Button variant="outline" className="w-full justify-between" onClick={() => alert("Docs link")}>
                    Provider documentation
                    <ExternalLink className="h-4 w-4" />
                 </Button>
                 <Button variant="outline" className="w-full justify-between" onClick={() => alert("Health monitor")}>
                    Health monitor
                    <ActivitySquare className="h-4 w-4" />
                 </Button>
              </div>
            </div>
          )}
       </SabsmsDetailDrawer>

       <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
         <ZoruDialogContent className="max-w-2xl">
           <ZoruDialogHeader>
             <ZoruDialogTitle>Provider Catalog</ZoruDialogTitle>
             <ZoruDialogDescription>Select a provider to configure your workspace credentials.</ZoruDialogDescription>
           </ZoruDialogHeader>
           <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
             {catalog.map(p => (
                <div key={p.id} className="border border-zoru-line rounded-md p-3 flex flex-col justify-between hover:border-zoru-line transition-colors">
                   <div className="flex justify-between items-start mb-2">
                     <div className="font-medium">{p.name}</div>
                     <Badge variant={p.available ? "default" : "secondary"}>
                       {p.available ? "Available" : "Phase 7"}
                     </Badge>
                   </div>
                   <div className="text-xs text-zoru-ink mb-4">{p.region}</div>
                   <Button disabled={!p.available} size="sm" className="w-full" onClick={() => alert(`Add ${p.name}`)}>
                     Configure
                   </Button>
                </div>
             ))}
           </div>
         </ZoruDialogContent>
       </Dialog>
    </SabsmsPageShell>
  );
}
