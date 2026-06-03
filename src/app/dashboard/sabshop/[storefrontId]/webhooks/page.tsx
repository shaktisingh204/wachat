"use client";

import React from "react";
import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
} from "@/components/zoruui/page-header";
import { Button } from "@/components/zoruui/button";
import { StatCard } from "@/components/zoruui/stat-card";
import { Badge } from "@/components/zoruui/badge";
import { Switch } from "@/components/zoruui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/zoruui/dropdown-menu";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/zoruui/table";
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
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription } from "@/components/zoruui/card";

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
        <ZoruPageHeading>
          <ZoruPageEyebrow>Developer Tools</ZoruPageEyebrow>
          <ZoruPageTitle>Webhooks</ZoruPageTitle>
          <ZoruPageDescription>
            Subscribe to store events and receive real-time HTTP payloads to your external services and custom apps.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline">
            <TerminalSquare className="mr-2 h-4 w-4" />
            View Documentation
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Endpoint
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 px-1">
        <StatCard
          label="Active Endpoints"
          value="3"
          icon={<Webhook className="text-zoru-ink-muted" />}
          delta={1}
          period="added this month"
        />
        <StatCard
          label="Events Processed (24h)"
          value="1,248"
          icon={<Activity className="text-zoru-success" />}
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
            <h2 className="text-lg font-semibold tracking-tight text-zoru-ink">Configured Endpoints</h2>
            <p className="text-sm text-zoru-ink-muted">Manage webhook subscriptions for this storefront.</p>
          </div>
        </div>

        <Card className="border-0 shadow-none bg-transparent sm:bg-zoru-bg sm:border sm:shadow-sm overflow-hidden">
          <div className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-zoru-surface-2/50 hover:bg-zoru-surface-2/50">
                  <TableHead className="w-[300px]">Endpoint</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Secret</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockWebhooks.map((webhook) => (
                  <TableRow key={webhook.id} className="group">
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Link className="h-4 w-4 text-zoru-ink-muted shrink-0" />
                          <span className="font-medium text-sm text-zoru-ink truncate max-w-[200px] sm:max-w-[300px]" title={webhook.url}>
                            {webhook.url}
                          </span>
                        </div>
                        <div className="text-xs text-zoru-ink-subtle ml-6 flex items-center gap-2">
                          <span>Last delivery: {webhook.lastDelivery}</span>
                          {webhook.failures > 0 && (
                            <span className="text-zoru-danger flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {webhook.failures} failures
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                        {webhook.topics.map((topic, i) => (
                          i < 2 ? (
                            <Badge key={topic} variant="outline" className="text-[10px] py-0 font-mono bg-zoru-surface-2/50">
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
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Switch checked={webhook.status === 'active'} />
                        {webhook.status === 'active' ? (
                          <Badge variant="success" className="text-[10px] uppercase tracking-wider py-0 rounded-full h-5 px-2">Active</Badge>
                        ) : (
                          <Badge variant="danger" className="text-[10px] uppercase tracking-wider py-0 rounded-full h-5 px-2">Failing</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-zoru-ink-muted bg-zoru-surface-2 px-2 py-1 rounded w-fit">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {webhook.secretPrefix}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
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
                          <DropdownMenuItem className="text-zoru-danger focus:text-zoru-danger">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-6 px-1 mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zoru-ink">Recent Deliveries</h2>
            <p className="text-sm text-zoru-ink-muted">View recent webhook attempts across all endpoints.</p>
          </div>
          <Button variant="outline" size="sm">View All Logs</Button>
        </div>

        <div className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-zoru-surface-2/50 hover:bg-zoru-surface-2/50">
                <TableHead>Topic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Time</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs text-zoru-ink">
                    {log.topic}
                  </TableCell>
                  <TableCell>
                    {log.status === 200 ? (
                      <Badge variant="success" className="font-mono text-[10px] py-0">{log.status} OK</Badge>
                    ) : (
                      <Badge variant="danger" className="font-mono text-[10px] py-0">{log.status} ERR</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-zoru-ink-muted">
                    {log.time}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      View Payload
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
