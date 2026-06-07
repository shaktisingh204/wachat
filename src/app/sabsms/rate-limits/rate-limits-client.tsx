"use client";

import React, { useState } from "react";
import {
  SabsmsPageShell,
} from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { SabsmsDataTable } from "@/components/sabsms/page-toolkit/sabsms-data-table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Badge,
  Button,
  Switch,
  Alert,
  AlertTitle,
  AlertDescription,
  useToast,
} from "@/components/sabcrm/20ui";
import { Zap, Bell, Settings2, RefreshCw, BarChart2, List, Shield, Download, FileText } from "lucide-react";

// Deterministic, realistic-looking consumption samples (percent of the limit),
// one bar per minute across the last 30 minutes. Used for the bar widths below.
const CONSUMPTION_SAMPLES = [
  42, 55, 48, 63, 71, 58, 66, 74, 82, 79, 88, 91, 77, 69, 73, 81, 85, 92, 86, 78,
  70, 64, 59, 67, 72, 80, 76, 68, 61, 54,
];

const THROTTLE_SAMPLES = [
  4, 2, 6, 3, 1, 5, 8, 4, 2, 0, 3, 7, 11, 6, 4, 2, 9, 13, 7, 5, 3, 1, 4, 8, 6, 2,
  0, 3, 5, 1,
];

export default function RateLimitsClient({ workspaceId }: { workspaceId: string }) {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"overview" | "throttled" | "overrides" | "routes">("overview");
  const [dynamicScaling, setDynamicScaling] = useState(false);
  const [balance, setBalance] = useState(150.0);
  const [isPurging, setIsPurging] = useState(false);

  const handlePurgeCache = () => {
    setIsPurging(true);
    setTimeout(() => {
      setIsPurging(false);
      toast.success("Rate limit cache purged. Limits applied immediately.");
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
    { id: "rt_4", route: "Outbound SMS (Provider)", limit: "500 / sec", burst: "n/a", scope: "Provider" },
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
      primaryAction={{ label: "Bulk Reset", onClick: () => toast.success("Bulk reset queued for all limits.") }}
      secondaryActions={[
        { label: "Notification Settings", icon: <Bell className="h-4 w-4" aria-hidden="true" /> },
        { label: "Webhook Config", icon: <Settings2 className="h-4 w-4" aria-hidden="true" /> },
        { label: "Export Audit Log", icon: <Download className="h-4 w-4" aria-hidden="true" /> },
      ]}
      toolbar={
        <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-4">
          <Button variant={activeView === "overview" ? "primary" : "outline"} onClick={() => setActiveView("overview")} size="sm" iconLeft={BarChart2}>
            Overview
          </Button>
          <Button variant={activeView === "routes" ? "primary" : "outline"} onClick={() => setActiveView("routes")} size="sm" iconLeft={List}>
            Per-Route Limits
          </Button>
          <Button variant={activeView === "throttled" ? "primary" : "outline"} onClick={() => setActiveView("throttled")} size="sm" iconLeft={Shield}>
            Throttled Log
          </Button>
          <Button variant={activeView === "overrides" ? "primary" : "outline"} onClick={() => setActiveView("overrides")} size="sm" iconLeft={Settings2}>
            Overrides
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline">Saved View: Default</Badge>
            <Button variant="outline" size="sm" onClick={handlePurgeCache} disabled={isPurging} loading={isPurging} iconLeft={isPurging ? undefined : RefreshCw}>
              {isPurging ? "Purging Cache..." : "Purge Cache"}
            </Button>
          </div>
        </div>
      }
    >
      {activeView === "overview" && (
        <div className="space-y-6">
          <Alert tone="info" icon={Zap}>
            <AlertTitle>Auto-adjust suggestion</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>Your current burst credit is consistently exhausted during peak hours (10:00 AM - 11:00 AM). Consider increasing your API key TPS limit.</span>
              <Button size="sm" variant="outline" onClick={() => toast.success("Suggestion applied. TPS limit increased.")}>Apply Suggestion</Button>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Global Limit", value: "10,000 / sec", period: "Across all endpoints" },
              { label: "Per-Workspace Limit", value: "1,000 / sec", period: "Default workspace limit" },
              { label: "Active Burst Credits", value: "500 reqs", period: "Available pool" },
              { label: "429 Responses (1h)", value: "142", period: "2.4% of total traffic" },
            ].map((m) => (
              <Card key={m.label} padding="md">
                <span className="block text-xs font-medium text-[var(--st-text-secondary)]">{m.label}</span>
                <span className="mt-1 block text-2xl font-semibold text-[var(--st-text)]">{m.value}</span>
                <span className="mt-1 block text-xs text-[var(--st-text-tertiary)]">{m.period}</span>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Dynamic Limit Scaling</CardTitle>
              <CardDescription>Automatically adjust rate limits based on your account balance to prevent unexpected overage.</CardDescription>
            </CardHeader>
            <CardBody>
              <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text)]">Enable Balance-Based Limits</p>
                  <p className="text-xs text-[var(--st-text-secondary)]">Current Balance: ${balance.toFixed(2)}</p>
                </div>
                <Switch checked={dynamicScaling} onCheckedChange={setDynamicScaling} aria-label="Enable balance-based limits" />
              </div>
              {dynamicScaling && (
                <div className="mt-4 flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-sm text-[var(--st-text-secondary)]">
                  <Zap className="mt-0.5 h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                  <div>
                    <span className="mb-1 block font-semibold text-[var(--st-text)]">Dynamic Scaling is Active</span>
                    If balance drops below $50.00, your global limit will be reduced by 50% to conserve credits.
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Current Consumption</CardTitle>
                <CardDescription>API requests over the last 60 minutes</CardDescription>
              </CardHeader>
              <CardBody>
                <div className="relative flex h-[200px] items-end gap-1 px-2 pt-8">
                  {/* Visual limit line at 75% of the chart height */}
                  <div className="pointer-events-none absolute bottom-[75%] left-0 right-0 z-10 flex items-center border-t-2 border-dashed border-[var(--st-border)]">
                    <span className="absolute -top-6 right-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-1 py-0.5 text-xs font-semibold text-[var(--st-text)] shadow-sm">Limit (10k/s)</span>
                  </div>
                  {CONSUMPTION_SAMPLES.map((height, i) => {
                    const isOverLimit = height > 75;
                    return (
                      <div
                        key={i}
                        className={`w-full rounded-t-sm transition-colors ${isOverLimit ? "bg-[var(--st-danger)]" : "bg-[var(--st-accent)]/80 hover:bg-[var(--st-accent)]"}`}
                        style={{ height: height + "%" }}
                      />
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>429 Response Rate</CardTitle>
                <CardDescription>Throttled requests over the last 60 minutes</CardDescription>
              </CardHeader>
              <CardBody>
                <div className="flex h-[200px] items-end gap-1 px-2">
                  {THROTTLE_SAMPLES.map((height, i) => (
                    <div
                      key={i}
                      className="w-full rounded-t-sm bg-[var(--st-accent)]/80 transition-colors hover:bg-[var(--st-accent)]"
                      style={{ height: height * 3 + "%" }}
                    />
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {activeView === "routes" && (
        <Card>
          <CardHeader>
            <CardTitle>Per-Route Limits</CardTitle>
            <CardDescription>Default rate limits applied per route and scope.</CardDescription>
          </CardHeader>
          <CardBody className="p-0">
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
          </CardBody>
        </Card>
      )}

      {activeView === "throttled" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Throttled Request Log</CardTitle>
                <CardDescription>Log of requests that hit a 429 rate limit.</CardDescription>
              </div>
              <Button variant="outline" size="sm" iconLeft={FileText}>
                Audit Log
              </Button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
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
          </CardBody>
        </Card>
      )}

      {activeView === "overrides" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Rate Limit Overrides</CardTitle>
                <CardDescription>Custom per-key or per-IP rate limits overriding defaults.</CardDescription>
              </div>
              <Button size="sm" onClick={() => toast.info("Add override coming soon.")}>Add Override</Button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
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
                      <Switch checked={r.active} aria-label={`Toggle override for ${r.target}`} />
                      <span className="text-sm text-[var(--st-text-secondary)]">{r.active ? "Active" : "Disabled"}</span>
                    </div>
                  ),
                },
              ]}
              rowActions={[
                { label: "Edit Override", onSelect: () => {} },
                { label: "Remove", destructive: true, onSelect: () => {} },
              ]}
              selectable={true}
              selectedIds={[]}
              onSelectionChange={() => {}}
            />
          </CardBody>
        </Card>
      )}
    </SabsmsPageShell>
  );
}
