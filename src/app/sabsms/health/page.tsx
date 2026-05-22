"use client";

import * as React from "react";
import { 
  Activity, AlertTriangle, CheckCircle2, Globe, List, Power, 
  Server, ShieldAlert, Webhook 
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Badge,
  Button,
  Table,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableBody,
  ZoruTableCell,
  StatCard,
  Progress,
  Switch,
  Label,
} from "@/components/zoruui";
import { SabsmsPageShell, SabsmsRefreshButton } from "@/components/sabsms/page-toolkit";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

const MOCK_THROUGHPUT = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i}:00`,
  msgs: Math.floor(Math.random() * 5000) + 1000,
}));

const MOCK_ERROR_HISTOGRAM = [
  { code: "30003", count: 420 },
  { code: "30005", count: 310 },
  { code: "30008", count: 215 },
  { code: "21610", count: 180 },
  { code: "21614", count: 90 },
];

export default function HealthMonitorPage() {
  return (
    <SabsmsPageShell
      title="Health Monitor"
      eyebrow="System Status"
      description="Real-time monitoring of deliverability, queues, and engine health."
      breadcrumbs={[{ label: "Health", href: "/sabsms/health" }]}
      primaryAction={{
        label: "Alert Rules",
        href: "/sabsms/health#alerts",
      }}
      toolbar={<SabsmsRefreshButton onRefresh={async () => { await new Promise(r => setTimeout(r, 800)) }} />}
    >
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Providers & Routing</TabsTrigger>
          <TabsTrigger value="alerts">Alerts & Outages</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Top Level KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard 
              title="Engine Uptime SLA" 
              value="99.99%" 
              trend={{ value: "+0.01%", label: "vs last month" }}
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            />
            <StatCard 
              title="Global DLR" 
              value="94.2%" 
              trend={{ value: "-0.5%", label: "vs yesterday" }}
              icon={<Activity className="h-4 w-4 text-blue-500" />}
            />
            <StatCard 
              title="Webhook Success" 
              value="99.8%" 
              trend={{ value: "Stable", label: "last 24h" }}
              icon={<Webhook className="h-4 w-4 text-purple-500" />}
            />
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 flex flex-col justify-center">
              <ZoruCardContent className="p-4 pt-4">
                <Button variant="destructive" className="w-full">
                  <Power className="mr-2 h-4 w-4" /> Pause All Sends
                </Button>
              </ZoruCardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Live Throughput</ZoruCardTitle>
                <ZoruCardDescription>Messages per second over the last 24h</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={MOCK_THROUGHPUT}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="msgs" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Queue & Concurrency</ZoruCardTitle>
                <ZoruCardDescription>BullMQ depth vs active workers</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2"><List className="h-4 w-4"/> Queue Depth</span>
                    <span className="text-muted-foreground">1,245 pending</span>
                  </div>
                  <Progress value={30} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2"><Server className="h-4 w-4"/> Worker Concurrency</span>
                    <span className="text-muted-foreground">42 / 50 active</span>
                  </div>
                  <Progress value={84} className="h-2" />
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="font-medium flex items-center gap-2"><Globe className="h-4 w-4"/> EU-West Region Health</span>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2"><Globe className="h-4 w-4"/> US-East Region Health</span>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Healthy</Badge>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Provider Rolling DLR</ZoruCardTitle>
                <ZoruCardDescription>Delivery rate over 1h / 24h / 7d</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow>
                      <ZoruTableHead>Provider</ZoruTableHead>
                      <ZoruTableHead>1h</ZoruTableHead>
                      <ZoruTableHead>24h</ZoruTableHead>
                      <ZoruTableHead>7d</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    <ZoruTableRow>
                      <ZoruTableCell className="font-medium">Twilio</ZoruTableCell>
                      <ZoruTableCell><Badge variant="outline" className="border-emerald-200 text-emerald-700">98.2%</Badge></ZoruTableCell>
                      <ZoruTableCell>97.5%</ZoruTableCell>
                      <ZoruTableCell>97.8%</ZoruTableCell>
                    </ZoruTableRow>
                    <ZoruTableRow>
                      <ZoruTableCell className="font-medium">Vonage</ZoruTableCell>
                      <ZoruTableCell><Badge variant="outline" className="border-amber-200 text-amber-700">89.1%</Badge></ZoruTableCell>
                      <ZoruTableCell>92.4%</ZoruTableCell>
                      <ZoruTableCell>94.1%</ZoruTableCell>
                    </ZoruTableRow>
                  </ZoruTableBody>
                </Table>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Error Code Histogram</ZoruCardTitle>
                <ZoruCardDescription>Top failure reasons across all providers</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_ERROR_HISTOGRAM} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="code" type="category" width={60} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ZoruCardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Number Health Scoreboard</ZoruCardTitle>
                <ZoruCardDescription>Flagged or degraded longcodes & shortcodes</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow>
                      <ZoruTableHead>Number</ZoruTableHead>
                      <ZoruTableHead>Status</ZoruTableHead>
                      <ZoruTableHead>DLR</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    <ZoruTableRow>
                      <ZoruTableCell className="font-mono text-sm">+1234567890</ZoruTableCell>
                      <ZoruTableCell><Badge variant="secondary" className="bg-red-100 text-red-700">High Spam</Badge></ZoruTableCell>
                      <ZoruTableCell>64%</ZoruTableCell>
                    </ZoruTableRow>
                    <ZoruTableRow>
                      <ZoruTableCell className="font-mono text-sm">+1987654321</ZoruTableCell>
                      <ZoruTableCell><Badge variant="secondary" className="bg-amber-100 text-amber-700">Throttled</Badge></ZoruTableCell>
                      <ZoruTableCell>88%</ZoruTableCell>
                    </ZoruTableRow>
                  </ZoruTableBody>
                </Table>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Carrier Deliverability</ZoruCardTitle>
                <ZoruCardDescription>Performance by destination network</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow>
                      <ZoruTableHead>Carrier</ZoruTableHead>
                      <ZoruTableHead>Latency</ZoruTableHead>
                      <ZoruTableHead>DLR</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    <ZoruTableRow>
                      <ZoruTableCell className="font-medium">AT&T (US)</ZoruTableCell>
                      <ZoruTableCell>1.2s</ZoruTableCell>
                      <ZoruTableCell>99.1%</ZoruTableCell>
                    </ZoruTableRow>
                    <ZoruTableRow>
                      <ZoruTableCell className="font-medium">T-Mobile (US)</ZoruTableCell>
                      <ZoruTableCell>2.4s</ZoruTableCell>
                      <ZoruTableCell>97.5%</ZoruTableCell>
                    </ZoruTableRow>
                  </ZoruTableBody>
                </Table>
              </ZoruCardContent>
            </Card>
          </div>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Routing & Auto-Degrade</ZoruCardTitle>
              <ZoruCardDescription>Recent automated actions</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead>Time</ZoruTableHead>
                    <ZoruTableHead>Event</ZoruTableHead>
                    <ZoruTableHead>Detail</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  <ZoruTableRow>
                    <ZoruTableCell>10 mins ago</ZoruTableCell>
                    <ZoruTableCell><Badge variant="outline">Re-route</Badge></ZoruTableCell>
                    <ZoruTableCell>Failover to Vonage for UK destinations</ZoruTableCell>
                  </ZoruTableRow>
                  <ZoruTableRow>
                    <ZoruTableCell>1 hour ago</ZoruTableCell>
                    <ZoruTableCell><Badge variant="secondary" className="bg-amber-100 text-amber-700">Auto-degrade</Badge></ZoruTableCell>
                    <ZoruTableCell>Twilio DLR dropped below 90%, paused pool B</ZoruTableCell>
                  </ZoruTableRow>
                </ZoruTableBody>
              </Table>
            </ZoruCardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Outage Timeline</ZoruCardTitle>
                <ZoruCardDescription>Recent incidents & compliance alerts</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-4">
                <div className="flex gap-4 border-l-2 border-red-200 pl-4 py-2">
                  <ShieldAlert className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Carrier Block Detected</h4>
                    <p className="text-sm text-muted-foreground">T-Mobile blocking campaign CX-992</p>
                    <span className="text-xs text-muted-foreground">Today, 14:20</span>
                  </div>
                </div>
                <div className="flex gap-4 border-l-2 border-amber-200 pl-4 py-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">High Latency</h4>
                    <p className="text-sm text-muted-foreground">Vodafone UK API response {">"} 5s</p>
                    <span className="text-xs text-muted-foreground">Yesterday, 09:15</span>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Alert Rules & Channels</ZoruCardTitle>
                <ZoruCardDescription>Configure health notifications</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Notification Channels</h4>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="slack-alerts" className="flex flex-col gap-1">
                      <span>Slack Alerts</span>
                      <span className="text-xs text-muted-foreground">Send to #sabsms-ops</span>
                    </Label>
                    <Switch id="slack-alerts" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-alerts" className="flex flex-col gap-1">
                      <span>Email Alerts</span>
                      <span className="text-xs text-muted-foreground">Send to on-call</span>
                    </Label>
                    <Switch id="email-alerts" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sabflow-alerts" className="flex flex-col gap-1">
                      <span>SabFlow Trigger</span>
                      <span className="text-xs text-muted-foreground">Trigger 'Incident' flow</span>
                    </Label>
                    <Switch id="sabflow-alerts" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="webhook-alerts" className="flex flex-col gap-1">
                      <span>Health Webhook Publisher</span>
                      <span className="text-xs text-muted-foreground">Post to PagerDuty</span>
                    </Label>
                    <Switch id="webhook-alerts" defaultChecked />
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Active Rules</h4>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-3 text-sm flex justify-between items-center">
                    <span>If <strong>DLR %</strong> &lt; <strong>90%</strong> over <strong>15m</strong></span>
                    <Badge variant="outline">Active</Badge>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Audit Log & Failures</ZoruCardTitle>
              <ZoruCardDescription>System actions and sample failed sends</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead>Timestamp</ZoruTableHead>
                    <ZoruTableHead>Type</ZoruTableHead>
                    <ZoruTableHead>Actor / Resource</ZoruTableHead>
                    <ZoruTableHead>Details</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  <ZoruTableRow>
                    <ZoruTableCell className="whitespace-nowrap">2026-05-22 14:00:21</ZoruTableCell>
                    <ZoruTableCell><Badge variant="secondary">Failed Send</Badge></ZoruTableCell>
                    <ZoruTableCell className="font-mono text-xs">msg_8f991...</ZoruTableCell>
                    <ZoruTableCell>Error 30008: Unknown destination handset</ZoruTableCell>
                  </ZoruTableRow>
                  <ZoruTableRow>
                    <ZoruTableCell className="whitespace-nowrap">2026-05-22 13:45:00</ZoruTableCell>
                    <ZoruTableCell><Badge variant="outline">Config Change</Badge></ZoruTableCell>
                    <ZoruTableCell>admin@sabnode.com</ZoruTableCell>
                    <ZoruTableCell>Updated auto-degrade rule threshold to 90%</ZoruTableCell>
                  </ZoruTableRow>
                  <ZoruTableRow>
                    <ZoruTableCell className="whitespace-nowrap">2026-05-22 13:20:11</ZoruTableCell>
                    <ZoruTableCell><Badge variant="secondary">Failed Send</Badge></ZoruTableCell>
                    <ZoruTableCell className="font-mono text-xs">msg_2a11b...</ZoruTableCell>
                    <ZoruTableCell>Error 21614: Unsubscribed recipient</ZoruTableCell>
                  </ZoruTableRow>
                  <ZoruTableRow>
                    <ZoruTableCell className="whitespace-nowrap">2026-05-22 12:00:00</ZoruTableCell>
                    <ZoruTableCell><Badge variant="outline">System</Badge></ZoruTableCell>
                    <ZoruTableCell>Health Monitor</ZoruTableCell>
                    <ZoruTableCell>Daily SLA report generated</ZoruTableCell>
                  </ZoruTableRow>
                </ZoruTableBody>
              </Table>
            </ZoruCardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </SabsmsPageShell>
  );
}
