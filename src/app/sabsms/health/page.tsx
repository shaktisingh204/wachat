"use client";

import * as React from "react";
import { 
  Activity, AlertTriangle, CheckCircle2, Globe, List, Power, 
  Server, ShieldAlert, Webhook, Monitor, Zap, Plus, FileText, Settings 
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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
  Input,
  Checkbox,
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

function useLiveMetrics() {
  const [updateMode, setUpdateMode] = React.useState<'websocket' | 'smart_polling'>('smart_polling');
  const [lastUpdated, setLastUpdated] = React.useState<Date>(new Date());

  React.useEffect(() => {
    let interval: NodeJS.Timeout;

    if (updateMode === 'smart_polling') {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          clearInterval(interval);
        } else {
          startPolling();
        }
      };

      const startPolling = () => {
        interval = setInterval(() => {
          setLastUpdated(new Date());
        }, 15000); // Optimized backoff polling to avoid overloading the server
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      if (!document.hidden) {
        startPolling();
      }

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(interval);
      };
    } else {
      interval = setInterval(() => {
        setLastUpdated(new Date());
      }, 2000); // Simulate realtime websocket events

      return () => clearInterval(interval);
    }
  }, [updateMode]);

  return { updateMode, setUpdateMode, lastUpdated };
}

export default function HealthMonitorPage() {
  const { updateMode, setUpdateMode, lastUpdated } = useLiveMetrics();

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
      toolbar={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm bg-zoru-surface-2 dark:bg-zoru-ink px-3 py-1.5 rounded-md">
            <span className="text-zoru-ink-muted">Mode:</span>
            <select 
              className="bg-transparent font-medium outline-none"
              value={updateMode}
              onChange={(e) => setUpdateMode(e.target.value as any)}
            >
              <option value="smart_polling">Smart Polling</option>
              <option value="websocket">WebSockets (Real-time)</option>
            </select>
          </div>
          <SabsmsRefreshButton onRefresh={async () => { await new Promise(r => setTimeout(r, 800)) }} />
        </div>
      }
    >
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Providers & Routing</TabsTrigger>
          <TabsTrigger value="alerts">Incidents & Alerts</TabsTrigger>
          <TabsTrigger value="status-page">Status Page</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Top Level KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard 
              title="Engine Uptime SLA" 
              value="99.99%" 
              trend={{ value: "+0.01%", label: "vs last month" }}
              icon={<CheckCircle2 className="h-4 w-4 text-zoru-ink" />}
            />
            <StatCard 
              title="Global DLR" 
              value="94.2%" 
              trend={{ value: "-0.5%", label: "vs yesterday" }}
              icon={<Activity className="h-4 w-4 text-zoru-ink" />}
            />
            <StatCard 
              title="Webhook Success" 
              value="99.8%" 
              trend={{ value: "Stable", label: "last 24h" }}
              icon={<Webhook className="h-4 w-4 text-zoru-ink" />}
            />
            <Card className="border-zoru-line bg-zoru-surface-2 dark:bg-zoru-ink/20 dark:border-zoru-line flex flex-col justify-center">
              <ZoruCardContent className="p-4 pt-4">
                <Button variant="destructive" className="w-full">
                  <Power className="mr-2 h-4 w-4" /> Pause All Sends
                </Button>
              </ZoruCardContent>
            </Card>
          </div>

          <div className="flex items-center text-xs text-zoru-ink-muted">
            <Zap className="h-3 w-3 mr-1 text-zoru-ink" />
            Last updated: {lastUpdated.toLocaleTimeString()} ({updateMode === 'websocket' ? 'WebSocket Connection' : 'Visibility-Optimized Polling'})
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
                    <span className="text-zoru-ink-muted">1,245 pending</span>
                  </div>
                  <Progress value={30} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2"><Server className="h-4 w-4"/> Worker Concurrency</span>
                    <span className="text-zoru-ink-muted">42 / 50 active</span>
                  </div>
                  <Progress value={84} className="h-2" />
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="font-medium flex items-center gap-2"><Globe className="h-4 w-4"/> EU-West Region Health</span>
                    <Badge variant="secondary" className="bg-zoru-surface-2 text-zoru-ink">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2"><Globe className="h-4 w-4"/> US-East Region Health</span>
                    <Badge variant="secondary" className="bg-zoru-surface-2 text-zoru-ink">Healthy</Badge>
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
                      <ZoruTableCell><Badge variant="outline" className="border-zoru-line text-zoru-ink">98.2%</Badge></ZoruTableCell>
                      <ZoruTableCell>97.5%</ZoruTableCell>
                      <ZoruTableCell>97.8%</ZoruTableCell>
                    </ZoruTableRow>
                    <ZoruTableRow>
                      <ZoruTableCell className="font-medium">Vonage</ZoruTableCell>
                      <ZoruTableCell><Badge variant="outline" className="border-zoru-line text-zoru-ink">89.1%</Badge></ZoruTableCell>
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
                      <ZoruTableCell><Badge variant="secondary" className="bg-zoru-surface-2 text-zoru-ink">High Spam</Badge></ZoruTableCell>
                      <ZoruTableCell>64%</ZoruTableCell>
                    </ZoruTableRow>
                    <ZoruTableRow>
                      <ZoruTableCell className="font-mono text-sm">+1987654321</ZoruTableCell>
                      <ZoruTableCell><Badge variant="secondary" className="bg-zoru-surface-2 text-zoru-ink">Throttled</Badge></ZoruTableCell>
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
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Incident History</h3>
              <p className="text-sm text-zoru-ink-muted">Log of past system incidents and current outages.</p>
            </div>
            <Button><Plus className="h-4 w-4 mr-2" /> Report Incident</Button>
          </div>
          
          <Card>
            <Table>
               <ZoruTableHeader>
                 <ZoruTableRow>
                   <ZoruTableHead>Incident</ZoruTableHead>
                   <ZoruTableHead>Status</ZoruTableHead>
                   <ZoruTableHead>Date</ZoruTableHead>
                   <ZoruTableHead>Resolution</ZoruTableHead>
                 </ZoruTableRow>
               </ZoruTableHeader>
               <ZoruTableBody>
                 <ZoruTableRow>
                   <ZoruTableCell className="font-medium">Vodafone UK Gateway Timeout</ZoruTableCell>
                   <ZoruTableCell><Badge variant="secondary" className="bg-zoru-surface-2 text-zoru-ink">Resolved</Badge></ZoruTableCell>
                   <ZoruTableCell>May 20, 2026</ZoruTableCell>
                   <ZoruTableCell>Traffic rerouted to secondary provider. Connectivity restored.</ZoruTableCell>
                 </ZoruTableRow>
                 <ZoruTableRow>
                   <ZoruTableCell className="font-medium">US Shortcode Processing Delay</ZoruTableCell>
                   <ZoruTableCell><Badge variant="secondary" className="bg-zoru-surface-2 text-zoru-ink">Resolved</Badge></ZoruTableCell>
                   <ZoruTableCell>May 18, 2026</ZoruTableCell>
                   <ZoruTableCell>Increased worker pool size to handle burst traffic.</ZoruTableCell>
                 </ZoruTableRow>
                 <ZoruTableRow>
                   <ZoruTableCell className="font-medium">Webhook Delivery High Latency</ZoruTableCell>
                   <ZoruTableCell><Badge variant="outline" className="border-zoru-line text-zoru-ink">Monitoring</Badge></ZoruTableCell>
                   <ZoruTableCell>Today</ZoruTableCell>
                   <ZoruTableCell>Investigating database lock contention in webhooks table.</ZoruTableCell>
                 </ZoruTableRow>
               </ZoruTableBody>
            </Table>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Outage Timeline</ZoruCardTitle>
                <ZoruCardDescription>Recent incidents & compliance alerts</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-4">
                <div className="flex gap-4 border-l-2 border-zoru-line pl-4 py-2">
                  <ShieldAlert className="h-5 w-5 text-zoru-ink mt-0.5" />
                  <div>
                    <h4 className="font-medium">Carrier Block Detected</h4>
                    <p className="text-sm text-zoru-ink-muted">T-Mobile blocking campaign CX-992</p>
                    <span className="text-xs text-zoru-ink-muted">Today, 14:20</span>
                  </div>
                </div>
                <div className="flex gap-4 border-l-2 border-zoru-line pl-4 py-2">
                  <AlertTriangle className="h-5 w-5 text-zoru-ink mt-0.5" />
                  <div>
                    <h4 className="font-medium">High Latency</h4>
                    <p className="text-sm text-zoru-ink-muted">Vodafone UK API response {">"} 5s</p>
                    <span className="text-xs text-zoru-ink-muted">Yesterday, 09:15</span>
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
                      <span className="text-xs text-zoru-ink-muted">Send to #sabsms-ops</span>
                    </Label>
                    <Switch id="slack-alerts" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-alerts" className="flex flex-col gap-1">
                      <span>Email Alerts</span>
                      <span className="text-xs text-zoru-ink-muted">Send to on-call</span>
                    </Label>
                    <Switch id="email-alerts" defaultChecked />
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Active Rules</h4>
                  <div className="bg-zoru-surface-2 dark:bg-zoru-ink rounded-md p-3 text-sm flex justify-between items-center">
                    <span>If <strong>DLR %</strong> &lt; <strong>90%</strong> over <strong>15m</strong></span>
                    <Badge variant="outline">Active</Badge>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status-page" className="space-y-6">
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Automated Status Page</ZoruCardTitle>
              <ZoruCardDescription>Configure and generate a public-facing status page automatically.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-6 max-w-2xl">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Custom Domain / Subdomain</Label>
                  <div className="flex gap-2">
                    <Input defaultValue="status.sabsms.com" />
                    <Button variant="outline">Verify</Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Components to Display</Label>
                  <div className="flex flex-col gap-3 p-4 border rounded-md bg-zoru-surface-2 dark:bg-zoru-ink/50">
                    <div className="flex items-center gap-2">
                      <Checkbox id="comp-engine" defaultChecked /> 
                      <Label htmlFor="comp-engine" className="font-normal cursor-pointer">SMS Delivery Engine</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="comp-api" defaultChecked /> 
                      <Label htmlFor="comp-api" className="font-normal cursor-pointer">Management API</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="comp-webhooks" defaultChecked /> 
                      <Label htmlFor="comp-webhooks" className="font-normal cursor-pointer">Webhooks Delivery</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="comp-dashboard" defaultChecked /> 
                      <Label htmlFor="comp-dashboard" className="font-normal cursor-pointer">Dashboard & Portal</Label>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="space-y-0.5">
                    <Label className="text-base">Auto-publish Incidents</Label>
                    <p className="text-sm text-zoru-ink-muted">Automatically mirror 'Monitoring' or worse alerts to the public page.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              
              <div className="flex items-center gap-4 pt-4 border-t">
                <Button><Globe className="mr-2 h-4 w-4"/> Publish Changes</Button>
                <Button variant="secondary"><FileText className="mr-2 h-4 w-4" /> View Live Page</Button>
              </div>
            </ZoruCardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <ZoruCardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-zoru-ink" />
                    <ZoruCardTitle>Datadog Integration</ZoruCardTitle>
                  </div>
                  <Switch defaultChecked />
                </div>
                <ZoruCardDescription>Export metrics, traces, and logs directly to Datadog for deeper analytics.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Datadog API Key</Label>
                  <Input type="password" defaultValue="************************" />
                </div>
                <div className="space-y-2">
                  <Label>Datadog App Key</Label>
                  <Input type="password" defaultValue="************************" />
                </div>
                <div className="space-y-2">
                  <Label>Site Region</Label>
                  <select className="flex h-10 w-full rounded-md border border-zoru-line bg-zoru-surface px-3 py-2 text-sm ring-offset-zoru-surface file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zoru-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-line focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option>US1 (datadoghq.com)</option>
                    <option>US3 (us3.datadoghq.com)</option>
                    <option>US5 (us5.datadoghq.com)</option>
                    <option>EU1 (datadoghq.eu)</option>
                  </select>
                </div>
                <Button variant="outline" className="w-full">Test Connection</Button>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-zoru-ink" />
                    <ZoruCardTitle>Prometheus Exporter</ZoruCardTitle>
                  </div>
                  <Switch />
                </div>
                <ZoruCardDescription>Enable Prometheus scraping endpoint for metric collection.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Metrics Endpoint Path</Label>
                  <Input defaultValue="/metrics/prometheus" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Bearer Token (Optional)</Label>
                  <Input type="password" placeholder="Require token for scraping" />
                </div>
                <div className="p-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded-md border">
                  <code className="text-xs break-all text-zoru-ink dark:text-zoru-ink-muted">
                    scrape_configs:<br/>
                    &nbsp;&nbsp;- job_name: 'sabsms-engine'<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;metrics_path: '/metrics/prometheus'<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;static_configs:<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- targets: ['api.sabsms.com']
                  </code>
                </div>
                <Button variant="outline" className="w-full">Regenerate Token</Button>
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
