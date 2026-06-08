"use client";

import React from "react";
import {
  PageHeader,
  PageHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  StatCard,
  Badge,
  Switch,
  Card,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from "@/components/sabcrm/20ui";
import {
  Plus,
  Webhook,
  Activity,
  AlertTriangle,
  MoreVertical,
  PenTool,
  Trash2,
  TerminalSquare,
  Link as LinkIcon,
  ShieldCheck,
  Zap,
} from "lucide-react";

const mockWebhooks = [
  {
    id: "wh-1",
    url: "https://api.acmecorp.com/webhooks/sabshop",
    topics: ["orders/create", "orders/paid", "orders/cancelled"],
    status: "active",
    secretPrefix: "whsec_8f92...",
    lastDelivery: "2 mins ago",
    failures: 0,
  },
  {
    id: "wh-2",
    url: "https://inventory-sync.render.com/webhook",
    topics: ["products/update", "inventory_levels/update"],
    status: "active",
    secretPrefix: "whsec_2a1b...",
    lastDelivery: "15 mins ago",
    failures: 0,
  },
  {
    id: "wh-3",
    url: "https://hook.eu1.make.com/abc123xyz",
    topics: ["customers/create"],
    status: "failing",
    secretPrefix: "whsec_9c4d...",
    lastDelivery: "1 hour ago",
    failures: 12,
  },
];

const mockLogs = [
  { id: "log-1", endpoint: "wh-1", topic: "orders/create", status: 200, time: "Oct 24, 11:42 AM" },
  { id: "log-2", endpoint: "wh-2", topic: "inventory_levels/update", status: 200, time: "Oct 24, 11:30 AM" },
  { id: "log-3", endpoint: "wh-3", topic: "customers/create", status: 500, time: "Oct 24, 11:15 AM" },
  { id: "log-4", endpoint: "wh-3", topic: "customers/create", status: 500, time: "Oct 24, 11:10 AM" },
];

export default function WebhooksPage() {
  return (
    <div className="flex flex-col gap-8 pb-12 w-full">
      <PageHeader>
        <PageHeading>
          <PageEyebrow>Developer tools</PageEyebrow>
          <PageTitle>Webhooks</PageTitle>
          <PageDescription>
            Subscribe to store events and receive real-time HTTP payloads in your external services and custom apps.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" iconLeft={TerminalSquare}>
            View documentation
          </Button>
          <Button variant="primary" iconLeft={Plus}>
            Add endpoint
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid gap-4 px-1 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active endpoints"
          value={<span className="tabular-nums">3</span>}
          icon={Webhook}
          accent="#3b7af5"
          delta={{ value: "+1 added this month", tone: "up" }}
        />
        <StatCard
          label="Events processed (24h)"
          value={<span className="tabular-nums">1,248</span>}
          icon={Activity}
          accent="#1f9d55"
          delta={{ value: "+12.5% vs previous day", tone: "up" }}
        />
        <StatCard
          label="Delivery failures (24h)"
          value={<span className="tabular-nums">12</span>}
          icon={AlertTriangle}
          accent="#c13c2c"
          delta={{ value: "+2 vs previous day", tone: "down" }}
        />
      </div>

      <div className="flex flex-col gap-6 px-1 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">Configured endpoints</h2>
            <p className="text-sm text-[var(--st-text-secondary)]">Manage webhook subscriptions for this storefront.</p>
          </div>
        </div>

        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th width={300}>Endpoint</Th>
                  <Th>Topics</Th>
                  <Th>Status</Th>
                  <Th className="hidden lg:table-cell">Secret</Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {mockWebhooks.map((webhook) => (
                  <Tr key={webhook.id} className="group">
                    <Td>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="h-4 w-4 text-[var(--st-text-secondary)] shrink-0" aria-hidden="true" />
                          <span
                            className="font-medium text-sm text-[var(--st-text)] truncate max-w-[200px] sm:max-w-[300px]"
                            title={webhook.url}
                          >
                            {webhook.url}
                          </span>
                        </div>
                        <div className="ml-6 flex items-center gap-2 text-xs text-[var(--st-text-tertiary)]">
                          <span>Last delivery {webhook.lastDelivery}</span>
                          {webhook.failures > 0 && (
                            <span className="text-[var(--st-danger)] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                              {webhook.failures} failures
                            </span>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                        {webhook.topics.slice(0, 2).map((topic) => (
                          <Badge key={topic} tone="neutral" kind="outline" className="font-mono text-[10px]">
                            {topic}
                          </Badge>
                        ))}
                        {webhook.topics.length > 2 && (
                          <Badge tone="neutral" kind="soft" className="text-[10px]">
                            +{webhook.topics.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={webhook.status === "active"}
                          aria-label={`Toggle ${webhook.url}`}
                        />
                        {webhook.status === "active" ? (
                          <Badge tone="success" kind="soft" className="text-[10px] uppercase tracking-wider">
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="danger" kind="soft" className="text-[10px] uppercase tracking-wider">
                            Failing
                          </Badge>
                        )}
                      </div>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] px-2 py-1 rounded-[var(--st-radius)] w-fit">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        {webhook.secretPrefix}
                      </div>
                    </Td>
                    <Td align="right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton
                            label="Endpoint actions"
                            icon={MoreVertical}
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem iconLeft={PenTool}>Edit endpoint</DropdownMenuItem>
                          <DropdownMenuItem iconLeft={Zap}>Send test event</DropdownMenuItem>
                          <DropdownMenuItem iconLeft={TerminalSquare}>View delivery logs</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="danger" iconLeft={Trash2}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-6 px-1 mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">Recent deliveries</h2>
            <p className="text-sm text-[var(--st-text-secondary)]">Recent webhook attempts across all endpoints.</p>
          </div>
          <Button variant="outline" size="sm">
            View all logs
          </Button>
        </div>

        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Topic</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">Time</Th>
                  <Th align="right">
                    <span className="sr-only">Action</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {mockLogs.map((log) => (
                  <Tr key={log.id}>
                    <Td className="font-mono text-xs text-[var(--st-text)]">{log.topic}</Td>
                    <Td>
                      {log.status === 200 ? (
                        <Badge tone="success" kind="soft" className="font-mono text-[10px]">
                          {log.status} OK
                        </Badge>
                      ) : (
                        <Badge tone="danger" kind="soft" className="font-mono text-[10px]">
                          {log.status} ERR
                        </Badge>
                      )}
                    </Td>
                    <Td className="hidden text-sm text-[var(--st-text-secondary)] md:table-cell">{log.time}</Td>
                    <Td align="right">
                      <Button variant="ghost" size="sm">
                        View payload
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
