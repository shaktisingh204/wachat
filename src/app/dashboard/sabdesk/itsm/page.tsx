"use client";

import React, { useState, useMemo } from 'react';
import {
  AlertCircle, Clock, Activity, Database, Server,
  Users, Settings, Search, Filter, MoreVertical, Plus,
  Calendar, Shield, Zap, TrendingUp, BarChart,
  GitBranch, GitCommit, Network, FileText, Layers, LifeBuoy,
  ArrowRight, Smartphone,
  Monitor, Lock, Box, Mail
} from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  CardTitle,
  StatCard,
  Badge,
  Dot,
  Field,
  Input,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Progress,
  Pagination,
  Avatar,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Slider,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';

// --- TYPES ---
type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
type Status = 'New' | 'In Progress' | 'Pending CAB' | 'Approved' | 'Resolved' | 'Closed';

interface Incident {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  assignee: string;
  created: string;
  sla: number; // percentage
  category: string;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  status: 'Operational' | 'Degraded' | 'Down' | 'Maintenance';
  ip: string;
  location: string;
  owner: string;
}

interface CabRequest {
  id: string;
  title: string;
  risk: Priority;
  requester: string;
  date: string;
  status: 'Planning' | 'Awaiting Approval' | 'Approved' | 'Implemented';
  impact: string;
}

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  category: string;
  sla: string;
  icon: React.ElementType;
}

// --- MOCK DATA ---
const INCIDENT_TITLES = [
  'Database connection timeout in production',
  'Email server rejecting attachments',
  'Cannot access VPN from branch office',
  'Application crashes on startup',
  'UI rendering issue in dashboard',
  'Payment gateway latency spike',
  'User unable to reset password',
  'High CPU usage on Node 4',
];

const MOCK_INCIDENTS: Incident[] = Array.from({ length: 45 }).map((_, i) => ({
  id: `INC-${1000 + i}`,
  title: `${INCIDENT_TITLES[i % 8]} (Report ${i + 1})`,
  priority: ['Critical', 'High', 'Medium', 'Low'][i % 4] as Priority,
  status: ['New', 'In Progress', 'Resolved', 'Closed'][i % 4] as Status,
  assignee: ['Alex Mercer', 'Sarah Chen', 'John Doe', 'Emma Watson', 'Unassigned'][i % 5],
  // Deterministic dates so the page renders identically across hydration passes.
  created: new Date(Date.UTC(2026, 5, 7) - i * 86400000).toISOString().split('T')[0],
  sla: (i * 17) % 100,
  category: ['Network', 'Software', 'Hardware', 'Access'][i % 4],
}));

const MOCK_ASSETS: Asset[] = Array.from({ length: 30 }).map((_, i) => ({
  id: `AST-${5000 + i}`,
  name: `prod-server-0${i + 1}`,
  type: ['Virtual Machine', 'Physical Server', 'Router', 'Switch', 'Database'][i % 5],
  status: ['Operational', 'Operational', 'Operational', 'Degraded', 'Down', 'Maintenance'][i % 6] as Asset['status'],
  ip: `192.168.1.${10 + i}`,
  location: ['US-East-1', 'EU-West-2', 'AP-South-1'][i % 3],
  owner: ['Infrastructure Team', 'DBA Team', 'Network Team'][i % 3],
}));

const MOCK_CAB: CabRequest[] = [
  { id: 'CHG-901', title: 'Upgrade Core Router Firmware', risk: 'High', requester: 'Network Eng.', date: '2026-06-05', status: 'Awaiting Approval', impact: 'Entire Office Network' },
  { id: 'CHG-902', title: 'Migrate DB to new Cluster', risk: 'Critical', requester: 'DBA Team', date: '2026-06-08', status: 'Planning', impact: 'Production App Downtime' },
  { id: 'CHG-903', title: 'Deploy New HR Portal', risk: 'Medium', requester: 'HR IT', date: '2026-06-10', status: 'Approved', impact: 'Internal HR Systems' },
  { id: 'CHG-904', title: 'Weekly OS Patching', risk: 'Low', requester: 'SecOps', date: '2026-06-04', status: 'Implemented', impact: 'Minimal (Rolling)' },
  { id: 'CHG-905', title: 'Firewall Rule Update', risk: 'High', requester: 'Security', date: '2026-06-06', status: 'Awaiting Approval', impact: 'External Traffic Routing' },
];

const MOCK_SERVICES: ServiceItem[] = [
  { id: 'SRV-1', title: 'New Employee Onboarding', description: 'Provision accounts, hardware, and access for new hires.', category: 'HR / Admin', sla: '2 Days', icon: Users },
  { id: 'SRV-2', title: 'Software License Request', description: 'Request licenses for Adobe, Office365, JetBrains, etc.', category: 'Software', sla: '4 Hours', icon: Box },
  { id: 'SRV-3', title: 'Hardware Request', description: 'Request new laptops, monitors, or peripherals.', category: 'Hardware', sla: '3 Days', icon: Monitor },
  { id: 'SRV-4', title: 'VPN Access', description: 'Request or troubleshoot VPN connectivity.', category: 'Network', sla: '2 Hours', icon: Shield },
  { id: 'SRV-5', title: 'Password Reset', description: 'Emergency password reset for AD or internal systems.', category: 'Access', sla: '15 Mins', icon: Lock },
  { id: 'SRV-6', title: 'Cloud Resource Provisioning', description: 'Request AWS/Azure VMs, Buckets, or DB instances.', category: 'Infrastructure', sla: '1 Day', icon: Server },
  { id: 'SRV-7', title: 'Mobile Device Management', description: 'Enroll a new mobile device to corporate MDM.', category: 'Hardware', sla: '4 Hours', icon: Smartphone },
  { id: 'SRV-8', title: 'Distribution List Update', description: 'Create or modify email distribution lists.', category: 'Software', sla: '1 Hour', icon: Mail },
];

// --- TONE MAPPERS (colour only ever carries meaning) ---
type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const priorityTone = (priority: string): BadgeTone => {
  switch (priority) {
    case 'Critical': return 'danger';
    case 'High': return 'warning';
    case 'Medium': return 'warning';
    case 'Low': return 'success';
    default: return 'neutral';
  }
};

const statusTone = (status: string): BadgeTone => {
  switch (status) {
    case 'New': return 'info';
    case 'In Progress': return 'accent';
    case 'Pending CAB': return 'warning';
    case 'Approved': return 'success';
    case 'Resolved': return 'success';
    case 'Operational': return 'success';
    case 'Degraded': return 'warning';
    case 'Down': return 'danger';
    case 'Maintenance': return 'info';
    case 'Closed': return 'neutral';
    default: return 'neutral';
  }
};

const slaTone = (sla: number): 'danger' | 'warning' | 'success' =>
  sla > 90 ? 'danger' : sla > 75 ? 'warning' : 'success';

// --- COMPONENTS ---

// 1. Dashboard Tab
const DashboardOverview = () => {
  const stats = [
    { label: 'Active Incidents', value: '142', delta: { value: '+12%', tone: 'up' as const }, icon: AlertCircle, accent: 'var(--st-danger)' },
    { label: 'SLA Breach Risk', value: '18', delta: { value: '-5%', tone: 'down' as const }, icon: Clock, accent: 'var(--st-warn)' },
    { label: 'Pending CAB', value: '7', delta: { value: '+2', tone: 'up' as const }, icon: Shield, accent: 'var(--st-accent)' },
    { label: 'System Uptime', value: '99.98%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: Activity, accent: 'var(--st-status-ok)' },
  ];

  const alerts = [
    'Core DB Replication Lag',
    'Payment API Gateway 502s',
    'High memory on k8s-node-03',
    'Authentication Service Timeout',
    'BGP Route Flap detected',
  ];

  // Deterministic bar heights so the chart is stable across renders.
  const bars = Array.from({ length: 14 }).map((_, i) => ({
    resolved: 30 + ((i * 13) % 55),
    fresh: 12 + ((i * 7) % 35),
  }));

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            accent={stat.accent}
            delta={stat.delta}
          />
        ))}
      </div>

      {/* Complex Layout Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <Card variant="outlined" padding="lg" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <CardTitle className="flex items-center gap-2 text-[var(--st-text)]">
              <TrendingUp className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
              Incident Volume Trends
            </CardTitle>
            <div className="w-40">
              <Select defaultValue="7d">
                <SelectTrigger aria-label="Trend range">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {bars.map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end gap-1 group relative">
                <div
                  className="w-full rounded-t-sm bg-[var(--st-accent-soft)] border border-[var(--st-accent)] transition-all"
                  style={{ height: `${bar.resolved}%` }}
                />
                <div
                  className="w-full rounded-t-sm bg-[var(--st-danger-soft)] border border-[var(--st-danger)] transition-all"
                  style={{ height: `${bar.fresh}%` }}
                />
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[var(--st-bg)] border border-[var(--st-border)] px-3 py-1.5 rounded-[var(--st-radius)] text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-[var(--st-shadow-lg)] text-[var(--st-text)]">
                  Total: {Math.round(bar.resolved + bar.fresh)}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-[var(--st-border)]">
            <span className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
              <Dot tone="accent" aria-hidden="true" /> Resolved
            </span>
            <span className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
              <Dot tone="danger" aria-hidden="true" /> New
            </span>
          </div>
        </Card>

        {/* Critical Alerts */}
        <Card variant="outlined" padding="lg" className="flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <CardTitle className="flex items-center gap-2 text-[var(--st-text)]">
              <Zap className="w-5 h-5 text-[var(--st-warn)]" aria-hidden="true" />
              Critical Alerts
            </CardTitle>
            <Badge tone="danger">3 Action Required</Badge>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {alerts.map((alert, i) => (
              <Card key={alert} variant="interactive" padding="sm" className="cursor-pointer group">
                <div className="flex items-start justify-between mb-2">
                  <Badge tone="danger" kind="soft" className="font-mono">CRIT-{100 + i}</Badge>
                  <span className="text-xs text-[var(--st-text-tertiary)] flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" /> {10 + i * 5}m ago
                  </span>
                </div>
                <p className="text-sm text-[var(--st-text)] font-medium">
                  {alert}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    <Avatar name="On Call" size="xs" />
                    <Avatar name="SRE Team" size="xs" />
                  </div>
                  <Button variant="ghost" size="sm" iconRight={ArrowRight}>Investigate</Button>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// 2. Incident Management Tab
const IncidentManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return MOCK_INCIDENTS;
    return MOCK_INCIDENTS.filter(
      (inc) =>
        inc.title.toLowerCase().includes(q) ||
        inc.id.toLowerCase().includes(q) ||
        inc.assignee.toLowerCase().includes(q),
    );
  }, [searchTerm]);

  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  return (
    <Card variant="outlined" padding="none" className="flex flex-col h-[calc(100vh-220px)] overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-[var(--st-border)] flex flex-col sm:flex-row justify-between items-center gap-4 bg-[var(--st-bg-secondary)]">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-72">
            <Input
              aria-label="Search incidents"
              iconLeft={Search}
              placeholder="Search incidents, CIs, or users..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <IconButton label="Filter incidents" icon={Filter} variant="outline" />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" onClick={() => toast.success('Exporting incidents to CSV')}>
            Export CSV
          </Button>
          <Button variant="primary" iconLeft={Plus} onClick={() => toast({ title: 'New incident', tone: 'info' })}>
            New Incident
          </Button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        {visible.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Search}
              title="No incidents found"
              description="Try a different search term or clear the filter to see all incidents."
              action={<Button variant="outline" onClick={() => setSearchTerm('')}>Clear search</Button>}
            />
          </div>
        ) : (
          <Table density="comfortable" hover stickyHeader>
            <THead>
              <Tr>
                <Th>ID</Th>
                <Th width="33%">Title &amp; Category</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Assignee</Th>
                <Th>SLA</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {visible.map((inc) => (
                <Tr key={inc.id} className="group cursor-pointer">
                  <Td className="font-mono text-[var(--st-text-secondary)]">{inc.id}</Td>
                  <Td>
                    <p className="text-sm font-medium text-[var(--st-text)] line-clamp-1">{inc.title}</p>
                    <p className="text-xs text-[var(--st-text-tertiary)] mt-0.5 flex items-center gap-1">
                      <Layers className="w-3 h-3" aria-hidden="true" /> {inc.category} . {inc.created}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone={priorityTone(inc.priority)}>{inc.priority}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(inc.status)} dot>{inc.status}</Badge>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                      <Avatar name={inc.assignee !== 'Unassigned' ? inc.assignee : '?'} size="xs" />
                      {inc.assignee}
                    </span>
                  </Td>
                  <Td>
                    <div className="w-full max-w-[120px]">
                      <div className="flex justify-between text-xs mb-1">
                        <span className={inc.sla > 90 ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]'}>
                          {inc.sla}% consumed
                        </span>
                      </div>
                      <Progress value={inc.sla} tone={slaTone(inc.sla)} size="sm" aria-label={`SLA consumed ${inc.sla}%`} />
                    </div>
                  </Td>
                  <Td align="right">
                    <IconButton
                      label={`Actions for ${inc.id}`}
                      icon={MoreVertical}
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between">
        <span className="text-sm text-[var(--st-text-tertiary)]">
          Showing {filtered.length === 0 ? 0 : start + 1} to {Math.min(start + pageSize, filtered.length)} of {filtered.length} entries
        </span>
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
      </div>
    </Card>
  );
};

// 3. CAB Approval Board (Kanban)
const CABBoard = () => {
  const columns = ['Planning', 'Awaiting Approval', 'Approved', 'Implemented'];
  const { toast } = useToast();

  return (
    <div className="h-[calc(100vh-220px)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-[var(--st-text)] mb-1">Change Advisory Board (CAB)</h2>
          <p className="text-sm text-[var(--st-text-secondary)]">Manage, review, and approve infrastructure and software changes.</p>
        </div>
        <Button variant="primary" iconLeft={GitCommit} onClick={() => toast({ title: 'Request a change', tone: 'info' })}>
          Request Change
        </Button>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        {columns.map((col) => {
          const cards = MOCK_CAB.filter((c) => c.status === col);
          return (
            <div key={col} className="min-w-[320px] w-[320px] flex flex-col bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius-lg)] p-4">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-medium text-[var(--st-text)]">{col}</h3>
                <Badge tone="neutral" className="font-mono">{cards.length}</Badge>
              </div>

              <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
                {cards.map((request) => (
                  <Card key={request.id} variant="interactive" padding="sm" className="cursor-grab active:cursor-grabbing">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-[var(--st-accent)]">{request.id}</span>
                      <Badge tone={priorityTone(request.risk)} className="uppercase tracking-wider">
                        {request.risk} Risk
                      </Badge>
                    </div>
                    <h4 className="text-sm font-medium text-[var(--st-text)] mb-2 leading-snug">{request.title}</h4>

                    <div className="space-y-2 mt-4 text-xs text-[var(--st-text-secondary)]">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{request.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{request.requester}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5" aria-hidden="true" />
                        <span className="line-clamp-2">{request.impact}</span>
                      </div>
                    </div>

                    {col === 'Awaiting Approval' && (
                      <div className="mt-4 flex gap-2 pt-4 border-t border-[var(--st-border)]">
                        <Button variant="primary" size="sm" block onClick={() => toast.success(`${request.id} approved`)}>
                          Approve
                        </Button>
                        <Button variant="danger" size="sm" block onClick={() => toast.error(`${request.id} rejected`)}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}

                {/* Drop Zone Indicator */}
                <div className="h-24 rounded-[var(--st-radius-lg)] border-2 border-dashed border-[var(--st-border)] bg-[var(--st-bg-subtle)] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-xs text-[var(--st-text-tertiary)]">Drop here</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 4. CMDB / Asset Graph View
const CMDBGraph = () => {
  const [depth, setDepth] = useState<number>(3);

  return (
    <div className="h-[calc(100vh-220px)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-[var(--st-text)] mb-1">Configuration Management (CMDB)</h2>
          <p className="text-sm text-[var(--st-text-secondary)]">Visualize relationships between services, servers, and applications.</p>
        </div>
        <div className="flex bg-[var(--st-bg-secondary)] p-1 rounded-[var(--st-radius)] border border-[var(--st-border)]">
          <Button variant="secondary" size="sm">Graph View</Button>
          <Button variant="ghost" size="sm">List View</Button>
        </div>
      </div>

      <div className="flex-1 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius-lg)] relative overflow-hidden flex items-center justify-center bg-[radial-gradient(circle_at_center,var(--st-border)_1px,transparent_1px)] bg-[length:24px_24px]">
        {/* Core Router */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10">
          <div className="w-16 h-16 rounded-[var(--st-radius-lg)] bg-[var(--st-bg)] border border-[var(--st-border-strong)] shadow-[var(--st-shadow-lg)] flex items-center justify-center relative cursor-pointer hover:border-[var(--st-accent)] transition-colors group">
            <Network className="w-8 h-8 text-[var(--st-accent)]" aria-hidden="true" />
            <Dot tone="success" pulse className="absolute -top-1 -right-1" aria-label="Operational" />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-4 w-48 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-left shadow-[var(--st-shadow-lg)]">
              <h4 className="text-sm font-medium text-[var(--st-text)]">Core-Router-US1</h4>
              <p className="text-xs text-[var(--st-text-secondary)] mt-1">Status: Operational<br />IP: 10.0.0.1</p>
            </div>
          </div>
          <span className="text-xs font-medium text-[var(--st-text-secondary)] bg-[var(--st-bg-secondary)] px-2 py-0.5 rounded-[var(--st-radius-sm)] border border-[var(--st-border)]">Core Network</span>
        </div>

        {/* Load Balancer */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10">
          <div className="w-14 h-14 rounded-[var(--st-radius-lg)] bg-[var(--st-bg)] border border-[var(--st-border-strong)] shadow-[var(--st-shadow-lg)] flex items-center justify-center relative cursor-pointer hover:border-[var(--st-warn)] transition-colors">
            <Layers className="w-7 h-7 text-[var(--st-warn)]" aria-hidden="true" />
            <Dot tone="warning" className="absolute -top-1 -right-1" aria-label="Degraded" />
          </div>
          <span className="text-xs font-medium text-[var(--st-text-secondary)] bg-[var(--st-bg-secondary)] px-2 py-0.5 rounded-[var(--st-radius-sm)] border border-[var(--st-border)]">Prod-LB-01</span>
        </div>

        {/* App Servers */}
        {[-1, 0, 1].map((offset, idx) => (
          <div
            key={idx}
            className="absolute top-[70%] left-1/2 flex flex-col items-center gap-2 z-10"
            style={{ transform: `translate(calc(-50% + ${offset * 150}px), -50%)` }}
          >
            <div className={`w-12 h-12 rounded-[var(--st-radius)] bg-[var(--st-bg)] border shadow-[var(--st-shadow-lg)] flex items-center justify-center relative cursor-pointer transition-colors ${offset === 0 ? 'border-[var(--st-danger)]' : 'border-[var(--st-border-strong)]'}`}>
              <Server className={`w-6 h-6 ${offset === 0 ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]'}`} aria-hidden="true" />
              <Dot tone={offset === 0 ? 'danger' : 'success'} className="absolute -top-1 -right-1" aria-label={offset === 0 ? 'Down' : 'Operational'} />
            </div>
            <span className="text-xs font-medium text-[var(--st-text-secondary)] bg-[var(--st-bg-secondary)] px-2 py-0.5 rounded-[var(--st-radius-sm)] border border-[var(--st-border)]">App-Node-0{idx + 1}</span>
            {offset === 0 && (
              <div className="absolute top-full mt-2">
                <Badge tone="danger" kind="soft">INC-1004 Active</Badge>
              </div>
            )}
          </div>
        ))}

        {/* SVG Connecting Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" aria-hidden="true">
          <path d="M 50% 25% L 50% 50%" stroke="currentColor" className="text-[var(--st-accent)]" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M 50% 50% L 35% 70%" stroke="currentColor" className="text-[var(--st-text-tertiary)]" strokeWidth="2" />
          <path d="M 50% 50% L 50% 70%" stroke="currentColor" className="text-[var(--st-danger)]" strokeWidth="2" />
          <path d="M 50% 50% L 65% 70%" stroke="currentColor" className="text-[var(--st-text-tertiary)]" strokeWidth="2" />
        </svg>

        {/* Floating details panel */}
        <Card variant="elevated" padding="md" className="absolute right-6 top-6 w-80">
          <h3 className="text-sm font-medium text-[var(--st-text)] mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> View Controls
          </h3>
          <div className="space-y-4">
            <Field label="Depth Level">
              <Slider value={depth} min={1} max={5} step={1} onValueChange={(v) => setDepth(Array.isArray(v) ? v[0] : v)} ariaLabel="Depth level" showValue />
            </Field>
            <Field label="Filter CIs">
              <Select defaultValue="all">
                <SelectTrigger aria-label="Filter configuration items">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="pt-4 border-t border-[var(--st-border)] space-y-2">
              <Checkbox defaultChecked label="Show Incidents" />
              <Checkbox label="Show Changes" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// 5. Service Catalog Tab
const ServiceCatalog = () => {
  const { toast } = useToast();
  const categories = ['All Services', 'Hardware', 'Software', 'Network & Access', 'HR & Admin', 'Infrastructure'];

  return (
    <div className="space-y-8">
      {/* Header Search */}
      <Card variant="outlined" padding="lg" className="text-center">
        <h2 className="text-3xl font-light text-[var(--st-text)] mb-4">How can we help you today?</h2>
        <div className="max-w-2xl mx-auto">
          <Input aria-label="Search the service catalog" inputSize="lg" iconLeft={Search} placeholder="Search for services, software, or access..." />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2 items-center">
          <span className="text-sm text-[var(--st-text-secondary)]">Popular:</span>
          {['VPN Access', 'New Laptop', 'Adobe CC', 'Password Reset'].map((tag) => (
            <Button key={tag} variant="ghost" size="sm" onClick={() => toast({ title: `Searching: ${tag}`, tone: 'info' })}>
              {tag}
            </Button>
          ))}
        </div>
      </Card>

      {/* Catalog Categories */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-4 px-2">Categories</h3>
          {categories.map((cat, i) => (
            <Button key={cat} variant={i === 0 ? 'primary' : 'ghost'} block className="justify-start">
              {cat}
            </Button>
          ))}

          <div className="mt-8 pt-6 border-t border-[var(--st-border)]">
            <Card variant="outlined" padding="md">
              <LifeBuoy className="w-6 h-6 text-[var(--st-accent)] mb-2" aria-hidden="true" />
              <h4 className="text-sm font-medium text-[var(--st-text)] mb-1">Need something else?</h4>
              <p className="text-xs text-[var(--st-text-secondary)] mb-3">If you can&apos;t find what you&apos;re looking for, submit a general request.</p>
              <Button variant="primary" block onClick={() => toast({ title: 'New generic ticket', tone: 'info' })}>
                Submit Generic Ticket
              </Button>
            </Card>
          </div>
        </div>

        {/* Grid */}
        <div className="md:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {MOCK_SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <Card key={service.id} variant="interactive" padding="md" className="cursor-pointer group">
                <div className="flex items-start gap-4">
                  <span className="p-3 bg-[var(--st-accent-soft)] border border-[var(--st-border)] rounded-[var(--st-radius)] text-[var(--st-accent)] shrink-0" aria-hidden="true">
                    <Icon className="w-6 h-6" />
                  </span>
                  <div className="flex-1">
                    <h4 className="text-base font-medium text-[var(--st-text)] mb-1">{service.title}</h4>
                    <p className="text-sm text-[var(--st-text-secondary)] mb-3 line-clamp-2">{service.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge tone="neutral">SLA: {service.sla}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconRight={ArrowRight}
                        className="opacity-0 group-hover:opacity-100"
                        onClick={() => toast.success(`Requested: ${service.title}`)}
                      >
                        Request
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function SabDeskITSM() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'incidents' | 'cab' | 'cmdb' | 'catalog'>('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart },
    { id: 'incidents', label: 'Incidents & Problems', icon: AlertCircle },
    { id: 'cab', label: 'CAB & Changes', icon: GitBranch },
    { id: 'cmdb', label: 'CMDB Assets', icon: Database },
    { id: 'catalog', label: 'Service Catalog', icon: FileText },
  ] as const;

  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="w-10 h-10 rounded-[var(--st-radius)] bg-[var(--st-accent)] flex items-center justify-center shadow-[var(--st-shadow-md)]" aria-hidden="true">
            <Shield className="w-5 h-5 text-[var(--st-text-inverted)]" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[var(--st-text)]">SabDesk ITSM</h1>
            <p className="text-xs text-[var(--st-text-tertiary)] font-medium tracking-wide">ENTERPRISE SERVICE MANAGEMENT</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius-pill)] px-4 py-1.5 gap-2">
            <Dot tone="success" pulse aria-label="System status" />
            <span className="text-xs font-medium text-[var(--st-text-secondary)]">System Normal</span>
          </div>
          <IconButton label="View notifications" icon={AlertCircle} variant="ghost" />
          <Avatar name="John Smith" size="sm" />
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id}>
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {tab.label}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="dashboard"><DashboardOverview /></TabsContent>
          <TabsContent value="incidents"><IncidentManagement /></TabsContent>
          <TabsContent value="cab"><CABBoard /></TabsContent>
          <TabsContent value="cmdb"><CMDBGraph /></TabsContent>
          <TabsContent value="catalog"><ServiceCatalog /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
