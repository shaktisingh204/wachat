"use client";

import React from "react";
import { PageHeader, PageHeading, PageEyebrow, PageTitle, PageDescription, PageActions } from '@/components/sabcrm/20ui/compat';
import { Button } from '@/components/sabcrm/20ui/compat';
import { StatCard } from '@/components/sabcrm/20ui/compat';
import { Badge } from '@/components/sabcrm/20ui/compat';
import { Switch } from '@/components/sabcrm/20ui/compat';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/sabcrm/20ui/compat';
import { Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui/compat';
import {
  Plus,
  Webhook,
  Activity,
  AlertTriangle,
  MoreVertical,
  PenTool,
  Trash2,
  TerminalSquare,
  Link,
  ShieldCheck,
  Zap
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/sabcrm/20ui/compat';

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
          <PageEyebrow>Developer Tools</PageEyebrow>
          <PageTitle>Webhooks</PageTitle>
          <PageDescription>
            Subscribe to store events and receive real-time HTTP payloads to your external services and custom apps.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline">
            <TerminalSquare className="mr-2 h-4 w-4" />
            View Documentation
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Endpoint
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 px-1">
        <StatCard
          label="Active Endpoints"
          value="3"
          icon={<Webhook className="text-[var(--st-text-secondary)]" />}
          delta={1}
          period="added this month"
        />
        <StatCard
          label="Events Processed (24h)"
          value="1,248"
          icon={<Activity className="text-[var(--st-status-ok)]" />}
          delta={12.5}
          period="vs previous day"
        />
        <StatCard
          label="Delivery Failures (24h)"
          value="12"
          icon={<AlertTriangle className="text-amber-500" />}
          delta={2}
          period="vs previous day"
          invertDelta
        />
      </div>

      <div className="flex flex-col gap-6 px-1 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">Configured Endpoints</h2>
            <p className="text-sm text-[var(--st-text-secondary)]">Manage webhook subscriptions for this storefront.</p>
          </div>
        </div>

        <Card className="border-0 shadow-none bg-transparent sm:bg-[var(--st-bg)] sm:border sm:shadow-sm overflow-hidden">
          <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] overflow-x-auto">
            <Table>
              <THead>
                <Tr className="bg-[var(--st-bg-muted)]/50 hover:bg-[var(--st-bg-muted)]/50">
                  <Th className="w-[300px]">Endpoint</Th>
                  <Th>Topics</Th>
                  <Th>Status</Th>
                  <Th className="hidden lg:table-cell">Secret</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {mockWebhooks.map((webhook) => (
                  <Tr key={webhook.id} className="group">
                    <Td>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Link className="h-4 w-4 text-[var(--st-text-secondary)] shrink-0" />
                          <span className="font-medium text-sm text-[var(--st-text)] truncate max-w-[200px] sm:max-w-[300px]" title={webhook.url}>
                            {webhook.url}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--st-text-tertiary)] ml-6 flex items-center gap-2">
                          <span>Last delivery: {webhook.lastDelivery}</span>
                          {webhook.failures > 0 && (
                            <span className="text-[var(--st-danger)] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {webhook.failures} failures
                            </span>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                        {webhook.topics.map((topic, i) => (
                          i < 2 ? (
                            <Badge key={topic} variant="outline" className="text-[10px] py-0 font-mono bg-[var(--st-bg-muted)]/50">
                              {topic}
                            </Badge>
                          ) : null
                        ))}
                        {webhook.topics.length > 2 && (
                          <Badge variant="ghost" className="text-[10px] py-0">
                            +{webhook.topics.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Switch checked={webhook.status === 'active'} />
                        {webhook.status === 'active' ? (
                          <Badge variant="success" className="text-[10px] uppercase tracking-wider py-0 rounded-full h-5 px-2">Active</Badge>
                        ) : (
                          <Badge variant="danger" className="text-[10px] uppercase tracking-wider py-0 rounded-full h-5 px-2">Failing</Badge>
                        )}
                      </div>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] px-2 py-1 rounded w-fit">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {webhook.secretPrefix}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <PenTool className="mr-2 h-4 w-4" /> Edit Endpoint
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Zap className="mr-2 h-4 w-4" /> Send Test Event
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <TerminalSquare className="mr-2 h-4 w-4" /> View Delivery Logs
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-[var(--st-danger)] focus:text-[var(--st-danger)]">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
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
            <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">Recent Deliveries</h2>
            <p className="text-sm text-[var(--st-text-secondary)]">View recent webhook attempts across all endpoints.</p>
          </div>
          <Button variant="outline" size="sm">View All Logs</Button>
        </div>

        <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] overflow-x-auto">
          <Table>
            <THead>
              <Tr className="bg-[var(--st-bg-muted)]/50 hover:bg-[var(--st-bg-muted)]/50">
                <Th>Topic</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Time</Th>
                <Th className="text-right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {mockLogs.map((log) => (
                <Tr key={log.id}>
                  <Td className="font-mono text-xs text-[var(--st-text)]">
                    {log.topic}
                  </Td>
                  <Td>
                    {log.status === 200 ? (
                      <Badge variant="success" className="font-mono text-[10px] py-0">{log.status} OK</Badge>
                    ) : (
                      <Badge variant="danger" className="font-mono text-[10px] py-0">{log.status} ERR</Badge>
                    )}
                  </Td>
                  <Td className="hidden md:table-cell text-sm text-[var(--st-text-secondary)]">
                    {log.time}
                  </Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      View Payload
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
