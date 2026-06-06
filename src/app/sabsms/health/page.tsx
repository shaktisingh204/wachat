"use client";

import * as React from "react";
import { 
  Activity, AlertTriangle, CheckCircle2, Globe, List, Power, 
  Server, ShieldAlert, Webhook, Monitor, Zap, Plus, FileText, Settings 
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger, Card, CardHeader, CardTitle, CardDescription, CardBody, Badge, Button, Table, THead, Tr, Th, TBody, Td, StatCard, Progress, Switch, Label, Input, Checkbox } from '@/components/sabcrm/20ui/compat';
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
          <div className="flex items-center gap-2 text-sm bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] px-3 py-1.5 rounded-md">
            <span className="text-[var(--st-text-secondary)]">Mode:</span>
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
              icon={<CheckCircle2 className="h-4 w-4 text-[var(--st-text)]" />}
            />
            <StatCard 
              title="Global DLR" 
              value="94.2%" 
              trend={{ value: "-0.5%", label: "vs yesterday" }}
              icon={<Activity className="h-4 w-4 text-[var(--st-text)]" />}
            />
            <StatCard 
              title="Webhook Success" 
              value="99.8%" 
              trend={{ value: "Stable", label: "last 24h" }}
              icon={<Webhook className="h-4 w-4 text-[var(--st-text)]" />}
            />
            <Card className="border-[var(--st-border)] bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/20 dark:border-[var(--st-border)] flex flex-col justify-center">
              <CardBody className="p-4 pt-4">
                <Button variant="destructive" className="w-full">
                  <Power className="mr-2 h-4 w-4" /> Pause All Sends
                </Button>
              </CardBody>
            </Card>
          </div>

          <div className="flex items-center text-xs text-[var(--st-text-secondary)]">
            <Zap className="h-3 w-3 mr-1 text-[var(--st-text)]" />
            Last updated: {lastUpdated.toLocaleTimeString()} ({updateMode === 'websocket' ? 'WebSocket Connection' : 'Visibility-Optimized Polling'})
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Live Throughput</CardTitle>
                <CardDescription>Messages per second over the last 24h</CardDescription>
              </CardHeader>
              <CardBody className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={MOCK_THROUGHPUT}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="msgs" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Queue & Concurrency</CardTitle>
                <CardDescription>BullMQ depth vs active workers</CardDescription>
              </CardHeader>
              <CardBody className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2"><List className="h-4 w-4"/> Queue Depth</span>
                    <span className="text-[var(--st-text-secondary)]">1,245 pending</span>
                  </div>
                  <Progress value={30} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2"><Server className="h-4 w-4"/> Worker Concurrency</span>
                    <span className="text-[var(--st-text-secondary)]">42 / 50 active</span>
                  </div>
                  <Progress value={84} className="h-2" />
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="font-medium flex items-center gap-2"><Globe className="h-4 w-4"/> EU-West Region Health</span>
                    <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)]">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2"><Globe className="h-4 w-4"/> US-East Region Health</span>
                    <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)]">Healthy</Badge>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Provider Rolling DLR</CardTitle>
                <CardDescription>Delivery rate over 1h / 24h / 7d</CardDescription>
              </CardHeader>
              <CardBody>
                <Table>
                  <THead>
                    <Tr>
                      <Th>Provider</Th>
                      <Th>1h</Th>
                      <Th>24h</Th>
                      <Th>7d</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    <Tr>
                      <Td className="font-medium">Twilio</Td>
                      <Td><Badge variant="outline" className="border-[var(--st-border)] text-[var(--st-text)]">98.2%</Badge></Td>
                      <Td>97.5%</Td>
                      <Td>97.8%</Td>
                    </Tr>
                    <Tr>
                      <Td className="font-medium">Vonage</Td>
                      <Td><Badge variant="outline" className="border-[var(--st-border)] text-[var(--st-text)]">89.1%</Badge></Td>
                      <Td>92.4%</Td>
                      <Td>94.1%</Td>
                    </Tr>
                  </TBody>
                </Table>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Code Histogram</CardTitle>
                <CardDescription>Top failure reasons across all providers</CardDescription>
              </CardHeader>
              <CardBody className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_ERROR_HISTOGRAM} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="code" type="category" width={60} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card>
              <CardHeader>
                <CardTitle>Number Health Scoreboard</CardTitle>
                <CardDescription>Flagged or degraded longcodes & shortcodes</CardDescription>
              </CardHeader>
              <CardBody>
                <Table>
                  <THead>
                    <Tr>
                      <Th>Number</Th>
                      <Th>Status</Th>
                      <Th>DLR</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    <Tr>
                      <Td className="font-mono text-sm">+1234567890</Td>
                      <Td><Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)]">High Spam</Badge></Td>
                      <Td>64%</Td>
                    </Tr>
                    <Tr>
                      <Td className="font-mono text-sm">+1987654321</Td>
                      <Td><Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)]">Throttled</Badge></Td>
                      <Td>88%</Td>
                    </Tr>
                  </TBody>
                </Table>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Carrier Deliverability</CardTitle>
                <CardDescription>Performance by destination network</CardDescription>
              </CardHeader>
              <CardBody>
                <Table>
                  <THead>
                    <Tr>
                      <Th>Carrier</Th>
                      <Th>Latency</Th>
                      <Th>DLR</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    <Tr>
                      <Td className="font-medium">AT&T (US)</Td>
                      <Td>1.2s</Td>
                      <Td>99.1%</Td>
                    </Tr>
                    <Tr>
                      <Td className="font-medium">T-Mobile (US)</Td>
                      <Td>2.4s</Td>
                      <Td>97.5%</Td>
                    </Tr>
                  </TBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Incident History</h3>
              <p className="text-sm text-[var(--st-text-secondary)]">Log of past system incidents and current outages.</p>
            </div>
            <Button><Plus className="h-4 w-4 mr-2" /> Report Incident</Button>
          </div>
          
          <Card>
            <Table>
               <THead>
                 <Tr>
                   <Th>Incident</Th>
                   <Th>Status</Th>
                   <Th>Date</Th>
                   <Th>Resolution</Th>
                 </Tr>
               </THead>
               <TBody>
                 <Tr>
                   <Td className="font-medium">Vodafone UK Gateway Timeout</Td>
                   <Td><Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)]">Resolved</Badge></Td>
                   <Td>May 20, 2026</Td>
                   <Td>Traffic rerouted to secondary provider. Connectivity restored.</Td>
                 </Tr>
                 <Tr>
                   <Td className="font-medium">US Shortcode Processing Delay</Td>
                   <Td><Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)]">Resolved</Badge></Td>
                   <Td>May 18, 2026</Td>
                   <Td>Increased worker pool size to handle burst traffic.</Td>
                 </Tr>
                 <Tr>
                   <Td className="font-medium">Webhook Delivery High Latency</Td>
                   <Td><Badge variant="outline" className="border-[var(--st-border)] text-[var(--st-text)]">Monitoring</Badge></Td>
                   <Td>Today</Td>
                   <Td>Investigating database lock contention in webhooks table.</Td>
                 </Tr>
               </TBody>
            </Table>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Outage Timeline</CardTitle>
                <CardDescription>Recent incidents & compliance alerts</CardDescription>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex gap-4 border-l-2 border-[var(--st-border)] pl-4 py-2">
                  <ShieldAlert className="h-5 w-5 text-[var(--st-text)] mt-0.5" />
                  <div>
                    <h4 className="font-medium">Carrier Block Detected</h4>
                    <p className="text-sm text-[var(--st-text-secondary)]">T-Mobile blocking campaign CX-992</p>
                    <span className="text-xs text-[var(--st-text-secondary)]">Today, 14:20</span>
                  </div>
                </div>
                <div className="flex gap-4 border-l-2 border-[var(--st-border)] pl-4 py-2">
                  <AlertTriangle className="h-5 w-5 text-[var(--st-text)] mt-0.5" />
                  <div>
                    <h4 className="font-medium">High Latency</h4>
                    <p className="text-sm text-[var(--st-text-secondary)]">Vodafone UK API response {">"} 5s</p>
                    <span className="text-xs text-[var(--st-text-secondary)]">Yesterday, 09:15</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alert Rules & Channels</CardTitle>
                <CardDescription>Configure health notifications</CardDescription>
              </CardHeader>
              <CardBody className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Notification Channels</h4>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="slack-alerts" className="flex flex-col gap-1">
                      <span>Slack Alerts</span>
                      <span className="text-xs text-[var(--st-text-secondary)]">Send to #sabsms-ops</span>
                    </Label>
                    <Switch id="slack-alerts" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-alerts" className="flex flex-col gap-1">
                      <span>Email Alerts</span>
                      <span className="text-xs text-[var(--st-text-secondary)]">Send to on-call</span>
                    </Label>
                    <Switch id="email-alerts" defaultChecked />
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Active Rules</h4>
                  <div className="bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-md p-3 text-sm flex justify-between items-center">
                    <span>If <strong>DLR %</strong> &lt; <strong>90%</strong> over <strong>15m</strong></span>
                    <Badge variant="outline">Active</Badge>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status-page" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated Status Page</CardTitle>
              <CardDescription>Configure and generate a public-facing status page automatically.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-6 max-w-2xl">
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
                  <div className="flex flex-col gap-3 p-4 border rounded-md bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/50">
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
                    <p className="text-sm text-[var(--st-text-secondary)]">Automatically mirror 'Monitoring' or worse alerts to the public page.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              
              <div className="flex items-center gap-4 pt-4 border-t">
                <Button><Globe className="mr-2 h-4 w-4"/> Publish Changes</Button>
                <Button variant="secondary"><FileText className="mr-2 h-4 w-4" /> View Live Page</Button>
              </div>
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-[var(--st-text)]" />
                    <CardTitle>Datadog Integration</CardTitle>
                  </div>
                  <Switch defaultChecked />
                </div>
                <CardDescription>Export metrics, traces, and logs directly to Datadog for deeper analytics.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-4">
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
                  <select className="flex h-10 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-sm ring-offset-zoru-surface file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--st-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option>US1 (datadoghq.com)</option>
                    <option>US3 (us3.datadoghq.com)</option>
                    <option>US5 (us5.datadoghq.com)</option>
                    <option>EU1 (datadoghq.eu)</option>
                  </select>
                </div>
                <Button variant="outline" className="w-full">Test Connection</Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-[var(--st-text)]" />
                    <CardTitle>Prometheus Exporter</CardTitle>
                  </div>
                  <Switch />
                </div>
                <CardDescription>Enable Prometheus scraping endpoint for metric collection.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="space-y-2">
                  <Label>Metrics Endpoint Path</Label>
                  <Input defaultValue="/metrics/prometheus" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Bearer Token (Optional)</Label>
                  <Input type="password" placeholder="Require token for scraping" />
                </div>
                <div className="p-3 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-md border">
                  <code className="text-xs break-all text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                    scrape_configs:<br/>
                    &nbsp;&nbsp;- job_name: 'sabsms-engine'<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;metrics_path: '/metrics/prometheus'<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;static_configs:<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- targets: ['api.sabsms.com']
                  </code>
                </div>
                <Button variant="outline" className="w-full">Regenerate Token</Button>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log & Failures</CardTitle>
              <CardDescription>System actions and sample failed sends</CardDescription>
            </CardHeader>
            <CardBody>
              <Table>
                <THead>
                  <Tr>
                    <Th>Timestamp</Th>
                    <Th>Type</Th>
                    <Th>Actor / Resource</Th>
                    <Th>Details</Th>
                  </Tr>
                </THead>
                <TBody>
                  <Tr>
                    <Td className="whitespace-nowrap">2026-05-22 14:00:21</Td>
                    <Td><Badge variant="secondary">Failed Send</Badge></Td>
                    <Td className="font-mono text-xs">msg_8f991...</Td>
                    <Td>Error 30008: Unknown destination handset</Td>
                  </Tr>
                  <Tr>
                    <Td className="whitespace-nowrap">2026-05-22 13:45:00</Td>
                    <Td><Badge variant="outline">Config Change</Badge></Td>
                    <Td>admin@sabnode.com</Td>
                    <Td>Updated auto-degrade rule threshold to 90%</Td>
                  </Tr>
                  <Tr>
                    <Td className="whitespace-nowrap">2026-05-22 13:20:11</Td>
                    <Td><Badge variant="secondary">Failed Send</Badge></Td>
                    <Td className="font-mono text-xs">msg_2a11b...</Td>
                    <Td>Error 21614: Unsubscribed recipient</Td>
                  </Tr>
                  <Tr>
                    <Td className="whitespace-nowrap">2026-05-22 12:00:00</Td>
                    <Td><Badge variant="outline">System</Badge></Td>
                    <Td>Health Monitor</Td>
                    <Td>Daily SLA report generated</Td>
                  </Tr>
                </TBody>
              </Table>
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>
    </SabsmsPageShell>
  );
}
