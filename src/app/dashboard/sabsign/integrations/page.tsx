"use client";

import React, { useState } from "react";
import {
  Activity, Webhook, Key, Shield, Settings, Plus, Search,
  CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Copy, Trash2, Edit2, Play, Code2,
  Terminal, Globe, Zap,
  ChevronRight, Box, Layers,
  HardDrive, CreditCard,
  Users, FileText, ShieldAlert,
  Clock, ArrowRight, ArrowUpRight, Filter, Download,
  Cloud, type LucideIcon,
} from "lucide-react";

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  StatCard,
  Badge,
  Field,
  Input,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  Switch,
  Alert,
  Separator,
  SegmentedControl,
  Pagination,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from "@/components/sabcrm/20ui";

// ==========================================
// MOCK DATA GENERATION
// ==========================================

const EVENT_CATEGORIES = [
  {
    name: "Envelope",
    events: ["envelope.created", "envelope.sent", "envelope.delivered", "envelope.completed", "envelope.declined", "envelope.voided", "envelope.deleted", "envelope.expired"],
  },
  {
    name: "Recipient",
    events: ["recipient.delivered", "recipient.completed", "recipient.declined", "recipient.authentication_failed", "recipient.reassigned", "recipient.delegated"],
  },
  {
    name: "Document",
    events: ["document.viewed", "document.modified", "document.deleted", "document.downloaded", "document.watermarked"],
  },
  {
    name: "Template",
    events: ["template.created", "template.modified", "template.deleted", "template.shared", "template.version_created"],
  },
  {
    name: "Account",
    events: ["account.billing_updated", "account.subscription_changed", "account.user_added", "account.user_removed", "account.settings_changed"],
  },
  {
    name: "Security",
    events: ["security.login_failed", "security.mfa_enabled", "security.mfa_disabled", "security.api_key_created", "security.api_key_revoked"],
  },
];

const MOCK_ENDPOINTS = [
  { id: "ep_1", url: "https://api.acmecorp.com/webhooks/sabsign", status: "active", secret: "whsec_8f9a2b4c6d8e0f1a3b5c7d9e1f3a5b7", createdAt: "2025-10-12T10:00:00Z", events: ["envelope.completed", "envelope.declined"], successRate: 99.8, failures: 2, totalDelivered: 14502 },
  { id: "ep_2", url: "https://hooks.slack.com/services/invalid/webhook/placeholder", status: "active", secret: "whsec_2a4b6c8d0e2f4a6b8c0d2e4f6a8b0", createdAt: "2025-11-05T14:30:00Z", events: ["envelope.sent", "recipient.declined"], successRate: 100, failures: 0, totalDelivered: 3201 },
  { id: "ep_3", url: "https://internal.dashboard.app/api/webhooks/signatures", status: "failing", secret: "whsec_1b3c5d7e9f1a3b5c7d9e1f3a5b7c9", createdAt: "2026-01-20T09:15:00Z", events: ["*"], successRate: 85.4, failures: 124, totalDelivered: 850 },
  { id: "ep_4", url: "https://zapier.com/hooks/catch/123456/abcdef/", status: "disabled", secret: "whsec_5a5b5c5d5e5f5g5h5i5j5k5l5m5n5", createdAt: "2026-02-10T11:45:00Z", events: ["document.viewed"], successRate: 0, failures: 0, totalDelivered: 0 },
];

const MOCK_API_KEYS = [
  { id: "key_1", name: "Production Backend Integration", prefix: "sk_live_8f9a...", createdAt: "2025-08-01T00:00:00Z", lastUsed: "2026-06-03T10:45:00Z", expiresAt: null, scopes: ["envelope:write", "envelope:read", "document:read"] },
  { id: "key_2", name: "Staging Environment", prefix: "sk_test_2b4c...", createdAt: "2026-01-15T00:00:00Z", lastUsed: "2026-06-02T18:20:00Z", expiresAt: "2027-01-15T00:00:00Z", scopes: ["*"] },
  { id: "key_3", name: "Zapier Automation", prefix: "sk_live_1d3e...", createdAt: "2026-03-10T00:00:00Z", lastUsed: "2026-06-03T19:00:00Z", expiresAt: null, scopes: ["envelope:read", "template:read", "recipient:read"] },
  { id: "key_4", name: "Developer Laptop (Harsh)", prefix: "sk_test_9f8e...", createdAt: "2026-05-20T00:00:00Z", lastUsed: "2026-06-01T09:10:00Z", expiresAt: "2026-06-20T00:00:00Z", scopes: ["envelope:write", "envelope:read"] },
];

const MOCK_APPS = [
  { id: "app_1", name: "Salesforce", category: "CRM", status: "connected", icon: Cloud, syncStatus: "synced", lastSync: "10 mins ago" },
  { id: "app_2", name: "HubSpot", category: "CRM", status: "disconnected", icon: Globe, syncStatus: "none", lastSync: "Never" },
  { id: "app_3", name: "Google Drive", category: "Storage", status: "connected", icon: HardDrive, syncStatus: "syncing", lastSync: "Just now" },
  { id: "app_4", name: "Dropbox", category: "Storage", status: "error", icon: Box, syncStatus: "failed", lastSync: "2 hours ago" },
  { id: "app_5", name: "Slack", category: "Communication", status: "connected", icon: Webhook, syncStatus: "synced", lastSync: "5 mins ago" },
  { id: "app_6", name: "Microsoft Teams", category: "Communication", status: "disconnected", icon: Users, syncStatus: "none", lastSync: "Never" },
  { id: "app_7", name: "Zapier", category: "Automation", status: "connected", icon: Zap, syncStatus: "synced", lastSync: "1 min ago" },
  { id: "app_8", name: "Stripe", category: "Billing", status: "connected", icon: CreditCard, syncStatus: "synced", lastSync: "1 hour ago" },
];

const generateMockLogs = () => {
  const logs = [];
  const events = ["envelope.completed", "envelope.sent", "document.viewed", "recipient.declined"];
  const statuses = [200, 200, 200, 201, 400, 500, 503, 200, 200];

  for (let i = 0; i < 150; i++) {
    const event = events[Math.floor(Math.random() * events.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const date = new Date(Date.now() - Math.floor(Math.random() * 10000000000));

    logs.push({
      id: `evt_${Math.random().toString(36).substr(2, 9)}`,
      event: event,
      endpoint: MOCK_ENDPOINTS[Math.floor(Math.random() * MOCK_ENDPOINTS.length)].url,
      status: status,
      timestamp: date.toISOString(),
      duration: Math.floor(Math.random() * 500) + 50,
      payload: {
        id: `env_${Math.random().toString(36).substr(2, 9)}`,
        status: event.split(".")[1],
        created_at: new Date(date.getTime() - 86400000).toISOString(),
        recipients: [
          { name: "John Doe", email: "john@example.com", status: "completed" },
        ],
      },
      response: status === 200 ? { success: true, message: "Processed" } : { error: "Internal Server Error", code: status },
    });
  }
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const MOCK_LOGS = generateMockLogs();

type EndpointStatus = "active" | "failing" | "disabled" | (string & {});

const endpointTone = (status: EndpointStatus) =>
  status === "active" ? "success" : status === "failing" ? "warning" : "neutral";

const EndpointStatusIcon = ({ status }: { status: EndpointStatus }) =>
  status === "active" ? (
    <CheckCircle2 size={12} aria-hidden="true" />
  ) : status === "failing" ? (
    <AlertCircle size={12} aria-hidden="true" />
  ) : (
    <XCircle size={12} aria-hidden="true" />
  );

// ==========================================
// UTILITY COMPONENTS
// ==========================================

const JsonViewer = ({ data }: { data: unknown }) => (
  <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
    <pre className="font-mono text-xs leading-relaxed text-[var(--st-text-secondary)]">
      {JSON.stringify(data, null, 2).split("\n").map((line, i) => (
        <div key={i} className="flex">
          <span className="mr-4 inline-block w-8 select-none border-r border-[var(--st-border)] pr-4 text-right text-[var(--st-text-tertiary)]">
            {i + 1}
          </span>
          <span className="text-[var(--st-text)]">{line}</span>
        </div>
      ))}
    </pre>
  </div>
);

// ==========================================
// VIEWS
// ==========================================

const WebhooksView = () => {
  const { toast } = useToast();
  const [endpoints] = useState(MOCK_ENDPOINTS);
  const [isCreating, setIsCreating] = useState(false);

  const stats: { title: string; value: React.ReactNode; icon: LucideIcon; accent: string }[] = [
    { title: "Active Endpoints", value: endpoints.filter((e) => e.status === "active").length, icon: Webhook, accent: "var(--st-accent)" },
    { title: "Total Events Delivered", value: "18,553", icon: Activity, accent: "var(--st-status-ok)" },
    { title: "Avg Latency", value: "142ms", icon: Zap, accent: "var(--st-warn)" },
    { title: "Failed Deliveries", value: "126", icon: AlertCircle, accent: "var(--st-danger)" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} label={stat.title} value={stat.value} icon={stat.icon} accent={stat.accent} />
        ))}
      </div>

      {isCreating ? (
        <CreateWebhookForm onCancel={() => setIsCreating(false)} />
      ) : (
        <Card padding="none">
          <CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Webhook Endpoints</CardTitle>
              <CardDescription>Configure endpoints to receive real-time event payloads.</CardDescription>
            </div>
            <Button variant="primary" iconLeft={Plus} onClick={() => setIsCreating(true)}>
              Add Endpoint
            </Button>
          </CardHeader>

          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>URL &amp; Secret</Th>
                  <Th>Status</Th>
                  <Th>Events Subscribed</Th>
                  <Th>Delivery Rate</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {endpoints.map((ep) => (
                  <Tr key={ep.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                          <Globe size={16} aria-hidden="true" />
                        </span>
                        <div>
                          <div className="max-w-[200px] truncate font-medium text-[var(--st-text)] lg:max-w-[300px]" title={ep.url}>
                            {ep.url}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <code className="rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-0.5 font-mono text-xs text-[var(--st-text-tertiary)]">
                              {ep.secret.substring(0, 12)}...
                            </code>
                            <IconButton
                              label="Copy signing secret"
                              icon={Copy}
                              size="sm"
                              onClick={() => toast.success("Signing secret copied")}
                            />
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={endpointTone(ep.status)}>
                        <EndpointStatusIcon status={ep.status} />
                        {ep.status.charAt(0).toUpperCase() + ep.status.slice(1)}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex max-w-[250px] flex-wrap gap-1.5">
                        {ep.events[0] === "*" ? (
                          <Badge tone="info">All Events</Badge>
                        ) : (
                          <>
                            {ep.events.slice(0, 2).map((evt) => (
                              <Badge key={evt} tone="neutral">{evt}</Badge>
                            ))}
                            {ep.events.length > 2 && (
                              <Badge tone="neutral">+{ep.events.length - 2} more</Badge>
                            )}
                          </>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex w-32 flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span
                            className={
                              ep.successRate > 95
                                ? "text-[var(--st-status-ok)]"
                                : ep.successRate > 80
                                  ? "text-[var(--st-warn)]"
                                  : "text-[var(--st-danger)]"
                            }
                          >
                            {ep.successRate}%
                          </span>
                          <span className="text-[var(--st-text-tertiary)]">{ep.totalDelivered.toLocaleString()} total</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-[var(--st-radius-pill)] bg-[var(--st-bg-muted)]">
                          <div
                            className={
                              ep.successRate > 95
                                ? "h-full rounded-[var(--st-radius-pill)] bg-[var(--st-status-ok)]"
                                : ep.successRate > 80
                                  ? "h-full rounded-[var(--st-radius-pill)] bg-[var(--st-warn)]"
                                  : "h-full rounded-[var(--st-radius-pill)] bg-[var(--st-danger)]"
                            }
                            style={{ width: `${ep.successRate}%` }}
                          />
                        </div>
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        <IconButton label="Test endpoint" icon={Play} size="sm" onClick={() => toast.info("Sending test event")} />
                        <IconButton label="Edit endpoint" icon={Edit2} size="sm" />
                        <IconButton label="Delete endpoint" icon={Trash2} size="sm" variant="danger" />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

const CreateWebhookForm = ({ onCancel }: { onCancel: () => void }) => {
  const { toast } = useToast();
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const toggleEvent = (evt: string) => {
    setSelectedEvents((prev) => (prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]));
  };

  const toggleCategory = (catEvents: string[]) => {
    const allSelected = catEvents.every((e) => selectedEvents.includes(e));
    if (allSelected) {
      setSelectedEvents((prev) => prev.filter((e) => !catEvents.includes(e)));
    } else {
      setSelectedEvents((prev) => [...new Set([...prev, ...catEvents])]);
    }
  };

  return (
    <Card padding="none">
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Add Webhook Endpoint</CardTitle>
          <CardDescription>Configure a new endpoint to receive HTTP POST requests.</CardDescription>
        </div>
        <IconButton label="Close form" icon={XCircle} onClick={onCancel} />
      </CardHeader>

      <CardBody className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Config */}
        <div className="space-y-6 lg:col-span-1">
          <Field label="Endpoint URL">
            <Input placeholder="https://api.yourdomain.com/webhooks" iconLeft={Globe} />
          </Field>
          <Field label="Description (Optional)">
            <Input placeholder="e.g. Production Billing Updates" iconLeft={FileText} />
          </Field>

          <div className="space-y-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
            <h4 className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
              <Shield size={16} className="text-[var(--st-accent)]" aria-hidden="true" /> Endpoint Security
            </h4>
            <p className="text-xs leading-relaxed text-[var(--st-text-secondary)]">
              We will sign every webhook request with a unique secret. You can use this secret to verify that the request came from SabSign.
            </p>
            <Field label="Signing Secret">
              <div className="flex gap-2">
                <code className="flex flex-1 items-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 font-mono text-xs text-[var(--st-text-secondary)]">
                  whsec_******************************
                </code>
                <IconButton
                  label="Rotate signing secret"
                  icon={RefreshCw}
                  variant="secondary"
                  onClick={() => toast.success("Signing secret rotated")}
                />
              </div>
            </Field>
          </div>
        </div>

        {/* Right Column: Events Selection */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-medium text-[var(--st-text)]">Events to send</h4>
            <Button variant="ghost" size="sm" onClick={() => setSelectedEvents(EVENT_CATEGORIES.flatMap((c) => c.events))}>
              Select All
            </Button>
          </div>

          <div className="grid h-[400px] grid-cols-1 gap-4 overflow-y-auto pr-2 md:grid-cols-2">
            {EVENT_CATEGORIES.map((cat) => {
              const allSelected = cat.events.every((e) => selectedEvents.includes(e));
              const someSelected = cat.events.some((e) => selectedEvents.includes(e));
              return (
                <div key={cat.name} className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h5 className="text-sm font-medium text-[var(--st-text)]">{cat.name}</h5>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      onChange={() => toggleCategory(cat.events)}
                      aria-label={`Toggle all ${cat.name} events`}
                    />
                  </div>

                  <div className="space-y-2.5">
                    {cat.events.map((evt) => (
                      <Checkbox
                        key={evt}
                        size="sm"
                        checked={selectedEvents.includes(evt)}
                        onChange={() => toggleEvent(evt)}
                        label={<span className="font-mono text-xs text-[var(--st-text-secondary)]">{evt}</span>}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardBody>

      <CardFooter className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" iconLeft={CheckCircle2} onClick={() => { toast.success("Endpoint created"); onCancel(); }}>
          Create Endpoint
        </Button>
      </CardFooter>
    </Card>
  );
};

const ApiKeysView = () => {
  const { toast } = useToast();
  const [keys] = useState(MOCK_API_KEYS);

  return (
    <div className="space-y-8">
      <Card padding="none">
        <CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Manage API keys used to authenticate requests to the SabSign API.</CardDescription>
          </div>
          <Button variant="primary" iconLeft={Key}>Generate New Key</Button>
        </CardHeader>

        <CardBody>
          <Alert tone="info" title="Keep your keys secure" icon={ShieldAlert} className="mb-6">
            Your API keys carry many privileges. Do not share them in publicly accessible areas such as GitHub, client-side code, and so forth.
          </Alert>

          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Name &amp; Prefix</Th>
                  <Th>Scopes</Th>
                  <Th>Created</Th>
                  <Th>Last Used</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {keys.map((key) => (
                  <Tr key={key.id}>
                    <Td>
                      <div className="font-medium text-[var(--st-text)]">{key.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-0.5 font-mono text-xs text-[var(--st-text-secondary)]">
                          {key.prefix}****************
                        </code>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex max-w-[200px] flex-wrap gap-1.5">
                        {key.scopes[0] === "*" ? (
                          <Badge tone="danger">Full Access</Badge>
                        ) : (
                          key.scopes.map((scope) => (
                            <Badge key={scope} tone="neutral">{scope}</Badge>
                          ))
                        )}
                      </div>
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                        <Clock size={14} aria-hidden="true" />
                        {new Date(key.lastUsed).toLocaleDateString()}
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => toast.success("Key rolled")}>Roll Key</Button>
                        <IconButton label="Revoke key" icon={Trash2} size="sm" variant="danger" />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

const EventLogsView = () => {
  const { toast } = useToast();
  const [logs] = useState(MOCK_LOGS);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const statusTone = (status: number) => {
    if (status >= 200 && status < 300) return "success" as const;
    if (status >= 400 && status < 500) return "warning" as const;
    return "danger" as const;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full max-w-xs flex-1 sm:w-auto">
            <Field label="Search Events">
              <Input iconLeft={Search} placeholder="Search by ID or event..." />
            </Field>
          </div>
          <div className="w-full max-w-xs flex-1 sm:w-auto">
            <Field label="Endpoint">
              <Select defaultValue="all">
                <SelectTrigger aria-label="Endpoint">
                  <SelectValue placeholder="All Endpoints" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Endpoints</SelectItem>
                  {MOCK_ENDPOINTS.map((ep) => (
                    <SelectItem key={ep.id} value={ep.id}>{ep.url}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="w-full max-w-xs flex-1 sm:w-auto">
            <Field label="Status">
              <Select defaultValue="all">
                <SelectTrigger aria-label="Status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success (2xx)</SelectItem>
                  <SelectItem value="error">Error (4xx/5xx)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button variant="secondary" iconLeft={Filter}>Filter</Button>
          <IconButton label="Export CSV" icon={Download} variant="outline" onClick={() => toast.success("Export started")} />
        </div>
      </Card>

      {/* Logs Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th width={48} aria-label="Expand row"> </Th>
                <Th>Status</Th>
                <Th>Event</Th>
                <Th>Date &amp; Time</Th>
                <Th>Endpoint</Th>
                <Th align="right">Duration</Th>
              </Tr>
            </THead>
            <TBody>
              {logs.slice(0, 20).map((log) => (
                <React.Fragment key={log.id}>
                  <Tr
                    className="u-tr--clickable"
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedLogId === log.id}
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedLogId(expandedLogId === log.id ? null : log.id);
                      }
                    }}
                  >
                    <Td align="center">
                      <ChevronRight
                        size={16}
                        aria-hidden="true"
                        className={`text-[var(--st-text-tertiary)] transition-transform duration-200 ${expandedLogId === log.id ? "rotate-90" : ""}`}
                      />
                    </Td>
                    <Td>
                      <Badge tone={statusTone(log.status)} kind="outline">{log.status}</Badge>
                    </Td>
                    <Td>
                      <span className="font-mono text-[var(--st-text)]">{log.event}</span>
                    </Td>
                    <Td className="text-xs text-[var(--st-text-secondary)]">
                      {new Date(log.timestamp).toLocaleString()}
                    </Td>
                    <Td truncate className="max-w-[200px] text-xs text-[var(--st-text-secondary)]">
                      <span title={log.endpoint}>{log.endpoint}</span>
                    </Td>
                    <Td align="right" className="font-mono text-xs text-[var(--st-text-secondary)]">
                      {log.duration}ms
                    </Td>
                  </Tr>

                  {expandedLogId === log.id && (
                    <Tr>
                      <Td colSpan={6}>
                        <div className="grid grid-cols-1 gap-6 bg-[var(--st-bg-secondary)] p-2 lg:grid-cols-2">
                          {/* Request */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h5 className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
                                <ArrowUpRight size={16} className="text-[var(--st-accent)]" aria-hidden="true" /> Request Payload
                              </h5>
                              <Button variant="ghost" size="sm" iconLeft={Copy} onClick={() => toast.success("JSON copied")}>
                                Copy JSON
                              </Button>
                            </div>
                            <JsonViewer data={log.payload} />
                          </div>

                          {/* Response */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h5 className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
                                <ArrowRight size={16} className="text-[var(--st-status-ok)]" aria-hidden="true" /> Response Body
                              </h5>
                              <Button variant="ghost" size="sm" iconLeft={Copy} onClick={() => toast.success("JSON copied")}>
                                Copy JSON
                              </Button>
                            </div>
                            <JsonViewer data={log.response} />
                          </div>
                        </div>
                      </Td>
                    </Tr>
                  )}
                </React.Fragment>
              ))}
            </TBody>
          </Table>
        </div>
        <Separator />
        <div className="flex items-center justify-between p-4 text-sm text-[var(--st-text-secondary)]">
          <div>Showing 1 to 20 of {logs.length} results</div>
          <Pagination page={1} pageCount={Math.ceil(logs.length / 20)} onPageChange={() => undefined} />
        </div>
      </Card>
    </div>
  );
};

const ConnectedAppsView = () => {
  const { toast } = useToast();

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-[var(--st-text)]">App Integrations</h2>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">Connect SabSign with your favorite tools to automate your workflows.</p>
        </div>
        <div className="w-full sm:w-64">
          <Input iconLeft={Search} placeholder="Search apps..." aria-label="Search apps" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MOCK_APPS.map((app) => (
          <Card key={app.id} variant="interactive" padding="none" className="flex flex-col">
            <div className="relative flex flex-1 flex-col items-start p-6">
              {app.status === "connected" && (
                <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-[var(--st-radius-pill)] bg-[var(--st-status-ok)]" aria-label="Connected" />
              )}
              {app.status === "error" && (
                <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-[var(--st-radius-pill)] bg-[var(--st-danger)]" aria-label="Error" />
              )}

              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
                <app.icon size={24} aria-hidden="true" />
              </span>

              <h3 className="text-lg font-medium text-[var(--st-text)]">{app.name}</h3>
              <p className="mt-1 text-xs text-[var(--st-text-tertiary)]">{app.category}</p>

              <div className="mt-6 w-full flex-1">
                {app.status === "connected" ? (
                  <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--st-text-secondary)]">Sync Status</span>
                      <span className="flex items-center gap-1 text-[var(--st-status-ok)]">
                        <CheckCircle2 size={12} aria-hidden="true" /> Active
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-[var(--st-text-secondary)]">Last Sync</span>
                      <span className="text-[var(--st-text)]">{app.lastSync}</span>
                    </div>
                  </div>
                ) : app.status === "error" ? (
                  <div className="rounded-[var(--st-radius)] border border-[var(--st-danger)] bg-[var(--st-danger-soft)] p-3">
                    <div className="flex items-center gap-1 text-xs text-[var(--st-danger)]">
                      <AlertCircle size={14} aria-hidden="true" /> Authentication Failed
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--st-text-secondary)]">
                    Connect {app.name} to automatically sync documents and data.
                  </p>
                )}
              </div>
            </div>

            <CardFooter className="flex items-center justify-between">
              {app.status === "connected" ? (
                <>
                  <Button variant="ghost" size="sm" iconLeft={Settings}>Configure</Button>
                  <Button variant="ghost" size="sm" onClick={() => toast.info(`Disconnected ${app.name}`)}>Disconnect</Button>
                </>
              ) : app.status === "error" ? (
                <Button variant="primary" size="sm" block onClick={() => toast.info(`Reconnecting ${app.name}`)}>Reconnect</Button>
              ) : (
                <Button variant="secondary" size="sm" block onClick={() => toast.success(`Connected ${app.name}`)}>Connect</Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

const SettingsView = () => {
  const { toast } = useToast();
  const [ipWhitelisting, setIpWhitelisting] = useState(true);
  const [strictMode, setStrictMode] = useState(false);
  const [rateLimitHeaders, setRateLimitHeaders] = useState(true);

  return (
    <div className="max-w-4xl space-y-8">
      <Card>
        <CardBody className="space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-[var(--st-text)]">Advanced API Settings</h2>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">Configure global behavior for API requests and integrations.</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Switch checked={ipWhitelisting} onCheckedChange={setIpWhitelisting} aria-label="Toggle IP whitelisting" />
              <div>
                <h4 className="text-base font-medium text-[var(--st-text)]">IP Whitelisting</h4>
                <p className="mb-3 mt-1 text-sm text-[var(--st-text-secondary)]">Restrict API access to specific IP addresses or CIDR blocks.</p>
                <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 font-mono text-sm text-[var(--st-text-secondary)]">
                  192.168.1.1/24<br />
                  10.0.0.0/8
                </div>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => toast.info("Editing allowed IPs")}>Edit Allowed IPs</Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-4">
              <Switch checked={strictMode} onCheckedChange={setStrictMode} aria-label="Toggle strict mode validation" />
              <div>
                <h4 className="text-base font-medium text-[var(--st-text)]">Strict Mode Validation</h4>
                <p className="mt-1 text-sm text-[var(--st-text-secondary)]">Reject API requests containing unknown JSON properties. By default, extra properties are ignored.</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-4">
              <Switch checked={rateLimitHeaders} onCheckedChange={setRateLimitHeaders} aria-label="Toggle rate limit headers" />
              <div>
                <h4 className="text-base font-medium text-[var(--st-text)]">Rate Limit Headers</h4>
                <p className="mt-1 text-sm text-[var(--st-text-secondary)]">Include X-RateLimit-* headers in all API responses to track your usage in real-time.</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div>
            <h2 className="text-xl font-semibold text-[var(--st-danger)]">Danger Zone</h2>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">Irreversible actions for your integrations.</p>
          </div>
          <div className="mt-6 flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
            <div>
              <h4 className="text-sm font-medium text-[var(--st-text)]">Revoke All API Keys</h4>
              <p className="mt-1 text-xs text-[var(--st-text-tertiary)]">Immediately invalidates all active API keys. This will break all current integrations.</p>
            </div>
            <Button variant="danger" onClick={() => toast.error("All API keys revoked")}>Revoke All</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

// ==========================================
// MAIN PAGE LAYOUT
// ==========================================

type TabId = "webhooks" | "apikeys" | "logs" | "apps" | "settings";

export default function SabSignIntegrations() {
  const [activeTab, setActiveTab] = useState<TabId>("webhooks");

  const TABS: { value: TabId; label: string; icon: LucideIcon }[] = [
    { value: "webhooks", label: "Webhooks", icon: Webhook },
    { value: "apikeys", label: "API Keys", icon: Key },
    { value: "logs", label: "Event Logs", icon: Terminal },
    { value: "apps", label: "Connected Apps", icon: Layers },
    { value: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="20ui min-h-screen bg-[var(--st-bg)] p-4 pb-24 text-[var(--st-text)] md:p-8">
      <div className="relative mx-auto max-w-[1400px] space-y-8">
        <PageHeader>
          <PageHeaderHeading>
            <PageEyebrow>SabSign</PageEyebrow>
            <PageTitle>Integrations &amp; API</PageTitle>
            <PageDescription>
              Connect SabSign to your existing tools, manage API authentication, and configure real-time webhooks for seamless data sync.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="outline" iconLeft={Code2}>API Docs</Button>
            <Button variant="primary" iconLeft={Plus}>New Integration</Button>
          </PageActions>
        </PageHeader>

        {/* Navigation */}
        <SegmentedControl
          items={TABS}
          value={activeTab}
          onChange={setActiveTab}
          aria-label="Integrations sections"
        />

        {/* Content Area */}
        <main className="min-h-[600px]">
          {activeTab === "webhooks" && <WebhooksView />}
          {activeTab === "apikeys" && <ApiKeysView />}
          {activeTab === "logs" && <EventLogsView />}
          {activeTab === "apps" && <ConnectedAppsView />}
          {activeTab === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
