"use client";

import React, { useState } from "react";
import {
  SabsmsPageShell,
} from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { SabsmsDataTable } from "@/components/sabsms/page-toolkit/sabsms-data-table";
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  StatCard,
  Badge,
  Button,
  Input,
  Switch,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
} from "@/components/zoruui";
import { Zap, Bell, Settings2, RefreshCw, BarChart2, List, Shield, Download, FileText } from "lucide-react";

export default function RateLimitsClient({ workspaceId }: { workspaceId: string }) {
  const [activeView, setActiveView] = useState<"overview" | "throttled" | "overrides" | "routes">("overview");
  const [dynamicScaling, setDynamicScaling] = useState(false);
  const [balance, setBalance] = useState(150.00);
  const [isPurging, setIsPurging] = useState(false);

  const handlePurgeCache = () => {
    setIsPurging(true);
    setTimeout(() => {
      setIsPurging(false);
      alert("Rate limit cache purged successfully! Limits applied immediately.");
    }, 1000);
  };

  // Mock data for throttled request log
  const throttledLog = [
    { id: "req_1", time: "10:23:45 AM", entity: "API Key (sk_live_...9f2)", endpoint: "/v1/messages", reason: "TPS limit exceeded", cooldown: "45s" },
    { id: "req_2", time: "10:22:11 AM", entity: "Workspace", endpoint: "/v1/campaigns", reason: "Burst credit exhausted", cooldown: "2m" },
    { id: "req_3", time: "09:15:00 AM", entity: "Provider (Twilio)", endpoint: "Outbound SMS", reason: "Provider 429", cooldown: "5s" },
    { id: "req_4", time: "08:50:33 AM", entity: "IP (192.168.1.1)", endpoint: "/v1/webhooks", reason: "IP rate limit", cooldown: "15m" },
  ];

  // Mock data for route limits
  const routeLimits = [
    { id: "rt_1", route: "POST /v1/messages", limit: "100 / sec", burst: "150 / sec", scope: "Global" },
    { id: "rt_2", route: "GET /v1/messages", limit: "50 / sec", burst: "75 / sec", scope: "Global" },
    { id: "rt_3", route: "POST /v1/campaigns", limit: "10 / sec", burst: "20 / sec", scope: "Workspace" },
    { id: "rt_4", route: "Outbound SMS (Provider)", limit: "500 / sec", burst: "—", scope: "Provider" },
  ];

  // Mock data for overrides
  const overrides = [
    { id: "ov_1", target: "sk_live_12345", type: "API Key", limit: "500 / sec", active: true },
    { id: "ov_2", target: "203.0.113.42", type: "IP Address", limit: "10 / sec", active: false },
  ];

  return (
    <SabsmsPageShell
      title="Rate Limits Monitor"
      description="Monitor API consumption, view throttled requests, and configure limit overrides."
      breadcrumbs={[{ label: "Infrastructure" }, { label: "Rate Limits" }]}
      primaryAction={{ label: "Bulk Reset", onClick: () => alert("Bulk reset limits") }}
      secondaryActions={[
        { label: "Notification Settings", icon: <Bell className="h-4 w-4" /> },
        { label: "Webhook Config", icon: <Settings2 className="h-4 w-4" /> },
        { label: "Export Audit Log", icon: <Download className="h-4 w-4" /> },
      ]}
      toolbar={
        <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-4">
          <Button variant={activeView === "overview" ? "default" : "outline"} onClick={() => setActiveView("overview")} size="sm">
            <BarChart2 className="mr-2 h-4 w-4" />
            Overview
          </Button>
          <Button variant={activeView === "routes" ? "default" : "outline"} onClick={() => setActiveView("routes")} size="sm">
            <List className="mr-2 h-4 w-4" />
            Per-Route Limits
          </Button>
          <Button variant={activeView === "throttled" ? "default" : "outline"} onClick={() => setActiveView("throttled")} size="sm">
            <Shield className="mr-2 h-4 w-4" />
            Throttled Log
          </Button>
          <Button variant={activeView === "overrides" ? "default" : "outline"} onClick={() => setActiveView("overrides")} size="sm">
            <Settings2 className="mr-2 h-4 w-4" />
            Overrides
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="bg-white">Saved View: Default</Badge>
            <Button variant="outline" size="sm" onClick={handlePurgeCache} disabled={isPurging}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isPurging ? "animate-spin" : ""}`} />
              {isPurging ? "Purging Cache..." : "Purge Cache"}
            </Button>
          </div>
        </div>
      }
    >
      {activeView === "overview" && (
        <div className="space-y-6">
          <Alert>
            <Zap className="h-4 w-4" />
            <ZoruAlertTitle>Auto-adjust suggestion</ZoruAlertTitle>
            <ZoruAlertDescription className="flex items-center justify-between">
              <span>Your current burst credit is consistently exhausted during peak hours (10:00 AM - 11:00 AM). Consider increasing your API key TPS limit.</span>
              <Button size="sm" variant="outline">Apply Suggestion</Button>
            </ZoruAlertDescription>
          </Alert>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Global Limit" value="10,000 / sec" period="Across all endpoints" />
            <StatCard label="Per-Workspace Limit" value="1,000 / sec" period="Default workspace limit" />
            <StatCard label="Active Burst Credits" value="500 reqs" period="Available pool" />
            <StatCard label="429 Responses (1h)" value="142" period="2.4% of total traffic" />
          </div>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Dynamic Limit Scaling</ZoruCardTitle>
              <ZoruCardDescription>Automatically adjust rate limits based on your account balance to prevent unexpected overage.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex items-center justify-between p-4 border rounded-md">
                <div>
                  <p className="font-medium text-sm">Enable Balance-Based Limits</p>
                  <p className="text-xs text-[var(--st-text)]">Current Balance: ${balance.toFixed(2)}</p>
                </div>
                <Switch checked={dynamicScaling} onCheckedChange={setDynamicScaling} />
              </div>
              {dynamicScaling && (
                <div className="mt-4 p-3 bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded-md text-sm text-[var(--st-text)] flex items-start gap-2">
                  <Zap className="h-4 w-4 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-1">Dynamic Scaling is Active</span>
                    If balance drops below $50.00, your global limit will be reduced by 50% to conserve credits.
                  </div>
                </div>
              )}
            </ZoruCardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Current Consumption</ZoruCardTitle>
                <ZoruCardDescription>API requests over the last 60 minutes</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <div className="relative flex h-[200px] items-end gap-1 px-2 pt-8">
                  {/* Visual limit line */}
                  <div className="absolute left-0 right-0 border-t-2 border-dashed border-[var(--st-border)] z-10 flex items-center pointer-events-none" style={{ bottom: "75%" }}>
                    <span className="absolute -top-6 right-2 text-xs font-semibold text-[var(--st-text)] bg-white px-1 py-0.5 rounded border border-[var(--st-border)] shadow-sm">Limit (10k/s)</span>
                  </div>
                  {/* Mock bar chart */}
                  {Array.from({ length: 30 }).map((_, i) => {
                    const height = Math.random() * 80 + 10;
                    const isOverLimit = height > 75;
                    return (
                      <div
                        key={i}
                        className={`w-full rounded-t-sm transition-colors ${isOverLimit ? "bg-[var(--st-text)]" : "bg-[var(--st-text)]/80 hover:bg-[var(--st-text)]"}`}
                        style={{ height: height + "%" }}
                      />
                    );
                  })}
                </div>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>429 Response Rate</ZoruCardTitle>
                <ZoruCardDescription>Throttled requests over the last 60 minutes</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <div className="flex h-[200px] items-end gap-1 px-2">
                  {/* Mock bar chart */}
                  {Array.from({ length: 30 }).map((_, i) => {
                    const height = Math.random() * 30;
                    return (
                      <div
                        key={i}
                        className="w-full rounded-t-sm bg-[var(--st-text)]/80 hover:bg-[var(--st-text)] transition-colors"
                        style={{ height: height + "%" }}
                      />
                    );
                  })}
                </div>
              </ZoruCardContent>
            </Card>
          </div>
        </div>
      )}

      {activeView === "routes" && (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Per-Route Limits</ZoruCardTitle>
            <ZoruCardDescription>Default rate limits applied per route and scope.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <SabsmsDataTable
              rows={routeLimits}
              rowKey={(r) => r.id}
              columns={[
                { id: "route", header: "Route", render: (r) => <span className="font-mono text-sm">{r.route}</span> },
                { id: "scope", header: "Scope", render: (r) => r.scope },
                { id: "limit", header: "Base Limit", render: (r) => r.limit },
                { id: "burst", header: "Burst Capacity", render: (r) => r.burst },
              ]}
              selectable={false}
            />
          </ZoruCardContent>
        </Card>
      )}

      {activeView === "throttled" && (
        <Card>
          <ZoruCardHeader>
            <div className="flex items-center justify-between">
              <div>
                <ZoruCardTitle>Throttled Request Log</ZoruCardTitle>
                <ZoruCardDescription>Log of requests that hit a 429 rate limit.</ZoruCardDescription>
              </div>
              <Button variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Audit Log
              </Button>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <SabsmsDataTable
              rows={throttledLog}
              rowKey={(r) => r.id}
              columns={[
                { id: "time", header: "Time", render: (r) => r.time },
                { id: "entity", header: "Entity", render: (r) => r.entity },
                { id: "endpoint", header: "Endpoint", render: (r) => <span className="font-mono text-xs">{r.endpoint}</span> },
                { id: "reason", header: "Reason", render: (r) => <Badge variant="destructive">{r.reason}</Badge> },
                { id: "cooldown", header: "Cool-down", render: (r) => r.cooldown },
              ]}
              selectable={false}
            />
          </ZoruCardContent>
        </Card>
      )}

      {activeView === "overrides" && (
        <Card>
          <ZoruCardHeader>
            <div className="flex items-center justify-between">
              <div>
                <ZoruCardTitle>Rate Limit Overrides</ZoruCardTitle>
                <ZoruCardDescription>Custom per-key or per-IP rate limits overriding defaults.</ZoruCardDescription>
              </div>
              <Button size="sm">Add Override</Button>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <SabsmsDataTable
              rows={overrides}
              rowKey={(r) => r.id}
              columns={[
                { id: "target", header: "Target", render: (r) => <span className="font-mono text-sm">{r.target}</span> },
                { id: "type", header: "Type", render: (r) => r.type },
                { id: "limit", header: "Custom Limit", render: (r) => r.limit },
                { 
                  id: "active", 
                  header: "Status", 
                  render: (r) => (
                    <div className="flex items-center gap-2">
                      <Switch checked={r.active} />
                      <span className="text-sm text-[var(--st-text)]">{r.active ? "Active" : "Disabled"}</span>
                    </div>
                  ) 
                },
              ]}
              rowActions={[
                { label: "Edit Override", onSelect: () => {} },
                { label: "Remove", destructive: true, onSelect: () => {} }
              ]}
              selectable={true}
              selectedIds={[]}
              onSelectionChange={() => {}}
            />
          </ZoruCardContent>
        </Card>
      )}
    </SabsmsPageShell>
  );
}
