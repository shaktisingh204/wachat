'use client';

import React, { useState } from 'react';
import {
  AlertTriangle, Activity, MessageSquare, FileText, CheckCircle, Clock,
  BarChart, Settings, Shield, Users, Layout, Plus, Search, Filter,
  ChevronRight, ArrowRight, Edit2, Server, Database,
  Globe, Terminal, Upload, Save, Send, Paperclip, Smile, Hash, Phone,
  AlertCircle, ChevronDown,
  AlignLeft, Bold, Italic, Underline, List, ListOrdered,
  Link2, Image as ImageIcon, Code, Lock, Bell, MoreVertical,
  TrendingDown, Eye, type LucideIcon,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  StatCard,
  Badge,
  Dot,
  Field,
  Input,
  Textarea,
  Checkbox,
  SegmentedControl,
  Avatar,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
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
} from '@/components/sabcrm/20ui';

// ============================================================================
// MOCK DATA
// ============================================================================

const SEVERITIES = ['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4'];
const STATUSES = ['Investigating', 'Identified', 'Monitoring', 'Resolved', 'Closed'];
const SERVICES = ['API Gateway', 'Authentication', 'User Database', 'Payment Processor', 'Frontend Web', 'Worker Nodes', 'Search Cluster', 'CDN'];
const USERS = [
  { id: 'u1', name: 'Alice Smith', avatar: 'AS', role: 'Incident Commander' },
  { id: 'u2', name: 'Bob Jones', avatar: 'BJ', role: 'Lead Engineer' },
  { id: 'u3', name: 'Charlie Brown', avatar: 'CB', role: 'Communications' },
  { id: 'u4', name: 'Diana Prince', avatar: 'DP', role: 'SME - Database' },
  { id: 'u5', name: 'Evan Wright', avatar: 'EW', role: 'SME - Network' },
];

const generateIncidents = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `INC-${1000 + i}`,
    title: [
      'Database replication lag across US-East regions',
      'Payment gateway timeout for Stripe integration',
      'High latency in API responses over 500ms',
      'Rate Limiting Issues on public endpoints',
      'Frontend rendering error on checkout page',
      'Search cluster desync causing empty results',
      'Auth tokens expiring prematurely',
      'Worker node pool exhaustion',
    ][i % 8],
    severity: SEVERITIES[i % 4],
    status: STATUSES[i % 5],
    impactedServices: SERVICES.slice(0, (i % 4) + 1),
    assignee: USERS[i % USERS.length],
    createdAt: new Date(Date.now() - (i * 3600000 + (i % 7) * 90000)).toISOString(),
    updatedAt: new Date(Date.now() - (i * 1800000)).toISOString(),
    description: 'We are seeing an elevated error rate on the main endpoints. The issue started approximately 15 minutes ago. Initial investigation suggests a possible database connection pool exhaustion or network bottleneck. On-call has been paged.',
    tags: ['database', 'latency', 'customer-impacting'].slice(0, (i % 3) + 1),
  }));
};

const MOCK_INCIDENTS = generateIncidents(25);

const MOCK_MESSAGES = [
  { id: 'm1', user: USERS[0], text: 'I am opening the war room now. Let us get everyone in here.', timestamp: '10:00 AM' },
  { id: 'm2', user: USERS[1], text: 'Looking at the Datadog dashboard. DB CPU is at 99%.', timestamp: '10:02 AM' },
  { id: 'm3', user: USERS[2], text: 'Should I update the public status page to "Degraded"?', timestamp: '10:03 AM' },
  { id: 'm4', user: USERS[0], text: 'Yes, go ahead. Mark API and Payments as degraded.', timestamp: '10:04 AM' },
  { id: 'm5', user: USERS[3], text: 'I am running a query analyzer. Give me a minute.', timestamp: '10:05 AM' },
  { id: 'm6', user: USERS[1], text: 'It looks like the new index rollout caused a regression on the transactions table.', timestamp: '10:08 AM' },
  { id: 'm7', user: USERS[0], text: 'Can we rollback the migration safely?', timestamp: '10:10 AM' },
];

const MOCK_TIMELINE = [
  { id: 't1', type: 'alert', title: 'High CPU Alert - DB Cluster', time: '09:45 AM', user: 'System' },
  { id: 't2', type: 'incident', title: 'Incident INC-1024 Created', time: '09:50 AM', user: 'PagerDuty' },
  { id: 't3', type: 'status', title: 'Status changed to Investigating', time: '09:55 AM', user: 'Alice Smith' },
  { id: 't4', type: 'chat', title: 'War Room Opened', time: '10:00 AM', user: 'Alice Smith' },
  { id: 't5', type: 'commit', title: 'Revert "Add composite index to tx table"', time: '10:15 AM', user: 'Bob Jones' },
  { id: 't6', type: 'status', title: 'Status changed to Monitoring', time: '10:30 AM', user: 'Alice Smith' },
];

// ============================================================================
// UTILITY HELPERS
// ============================================================================

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const getSeverityTone = (sev: string): Tone => {
  switch (sev) {
    case 'SEV-1': return 'danger';
    case 'SEV-2': return 'warning';
    case 'SEV-3': return 'warning';
    case 'SEV-4': return 'info';
    default: return 'neutral';
  }
};

const getStatusTone = (status: string): Tone => {
  switch (status) {
    case 'Investigating': return 'danger';
    case 'Identified': return 'warning';
    case 'Monitoring': return 'info';
    case 'Resolved': return 'success';
    case 'Closed': return 'neutral';
    default: return 'neutral';
  }
};

// A small avatar chip drawn from initials (token-styled).
const InitialsChip = ({ initials, className = '' }: { initials: string; className?: string }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] font-medium ${className}`}
    aria-hidden="true"
  >
    {initials}
  </span>
);

// ============================================================================
// SUB-VIEWS (TABS)
// ============================================================================

// --- 1. OVERVIEW DASHBOARD ---
const OverviewDashboard = () => {
  const [chartGranularity, setChartGranularity] = useState('daily');
  const barHeights = React.useMemo(
    () => Array.from({ length: 30 }, (_, i) => 12 + ((i * 37) % 88)),
    [],
  );
  const serviceBars = [
    { name: 'API Gateway', val: 45 },
    { name: 'Payment Processor', val: 30 },
    { name: 'User Database', val: 15 },
    { name: 'Worker Nodes', val: 10 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Incident Overview</PageTitle>
          <PageDescription>Real-time metrics and active incidents across your infrastructure.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={FileText}>Export Report</Button>
          <Button variant="primary" iconLeft={Plus}>Declare Incident</Button>
        </PageActions>
      </PageHeader>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Incidents" value="3" icon={AlertTriangle} delta={{ value: '+1 from yesterday', tone: 'up' }} accent="var(--st-danger)" />
        <StatCard label="MTTA (7d)" value="4m 12s" icon={Clock} delta={{ value: '-12% improvement', tone: 'down' }} accent="var(--st-status-ok)" />
        <StatCard label="MTTR (7d)" value="42m 30s" icon={Activity} delta={{ value: '+5% regression', tone: 'up' }} accent="var(--st-warn)" />
        <StatCard label="Uptime (30d)" value="99.98%" icon={Shield} delta={{ value: 'On track for SLA', tone: 'neutral' }} accent="var(--st-accent)" />
      </div>

      {/* CHARTS AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 min-h-[300px] flex flex-col" padding="lg">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-semibold text-[var(--st-text)]">Incident Volume (30 Days)</h3>
            <div className="w-32">
              <Select value={chartGranularity} onValueChange={setChartGranularity}>
                <SelectTrigger aria-label="Chart granularity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-1 w-full bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)] flex items-end p-4 gap-2 relative">
            {/* Bar chart (runtime-computed heights) */}
            {barHeights.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end group">
                <div className="relative w-full">
                  <div
                    className="w-full bg-[var(--st-accent)] hover:bg-[var(--st-accent-hover)] rounded-t-sm transition-all"
                    style={{ height: `${h}px` }}
                  />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[var(--st-bg-muted)] text-xs text-[var(--st-text)] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 border border-[var(--st-border)]">
                    Day {i + 1}: {(i % 5)} incidents
                  </div>
                </div>
              </div>
            ))}
            <div className="absolute inset-0 pointer-events-none border-t border-[var(--st-border)] top-1/4" />
            <div className="absolute inset-0 pointer-events-none border-t border-[var(--st-border)] top-1/2" />
            <div className="absolute inset-0 pointer-events-none border-t border-[var(--st-border)] top-3/4" />
          </div>
        </Card>

        <Card className="min-h-[300px]" padding="lg">
          <h3 className="text-base font-semibold text-[var(--st-text)] mb-6">Incidents by Service</h3>
          <div className="space-y-4">
            {serviceBars.map((s, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--st-text)]">{s.name}</span>
                  <span className="text-[var(--st-text-secondary)] font-mono">{s.val}%</span>
                </div>
                <div className="w-full bg-[var(--st-bg-muted)] rounded-full h-2">
                  <div className="bg-[var(--st-accent)] h-2 rounded-full" style={{ width: `${s.val}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-[var(--st-border)]">
            <h3 className="text-sm font-semibold text-[var(--st-text)] mb-4">On-Call Right Now</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name="Alice Smith" />
                <div>
                  <p className="text-sm font-medium text-[var(--st-text)]">Alice Smith</p>
                  <p className="text-xs text-[var(--st-text-secondary)]">Primary - Tier 1</p>
                </div>
              </div>
              <IconButton label="Call Alice Smith" icon={Phone} />
            </div>
          </div>
        </Card>
      </div>

      {/* RECENT INCIDENTS TABLE */}
      <Card padding="none" className="flex flex-col">
        <CardHeader className="flex flex-wrap justify-between items-center gap-3">
          <CardTitle>Active &amp; Recent Incidents</CardTitle>
          <div className="flex items-center gap-2">
            <div className="w-64">
              <Field label="" className="!gap-0">
                <Input iconLeft={Search} placeholder="Search incidents..." aria-label="Search incidents" />
              </Field>
            </div>
            <Button variant="outline" iconLeft={Filter}>Filter</Button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table hover>
            <THead>
              <Tr>
                <Th>Incident ID</Th>
                <Th>Title</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th>Assignee</Th>
                <Th>Created</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {MOCK_INCIDENTS.slice(0, 10).map((inc) => (
                <Tr key={inc.id}>
                  <Td>
                    <span className="font-mono text-sm text-[var(--st-accent)]">{inc.id}</span>
                  </Td>
                  <Td>
                    <p className="text-sm font-medium text-[var(--st-text)]">{inc.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {inc.impactedServices.map((s) => (
                        <span key={s} className="text-[10px] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={getSeverityTone(inc.severity)}>{inc.severity}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={getStatusTone(inc.status)} dot>{inc.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <InitialsChip initials={inc.assignee.avatar} className="w-6 h-6 text-[10px]" />
                      <span className="text-sm text-[var(--st-text)]">{inc.assignee.name}</span>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-sm text-[var(--st-text-secondary)] whitespace-nowrap">
                      {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </Td>
                  <Td align="right">
                    <IconButton label={`Open incident ${inc.id}`} icon={ChevronRight} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
        <CardFooter className="justify-center">
          <Button variant="ghost">View All Incidents</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

// --- 2. WAR ROOM ---
const WarRoom = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [message, setMessage] = useState('');

  return (
    <div className="flex h-[calc(100vh-140px)] bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius-lg)] overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-300">

      {/* LEFT PANEL: Channels & Incidents */}
      <div className="w-64 border-r border-[var(--st-border)] flex flex-col bg-[var(--st-bg-secondary)]">
        <div className="p-4 border-b border-[var(--st-border)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--st-text)] font-semibold">
            <RadioWaveIcon /> Active War Rooms
          </div>
          <IconButton label="New war room" icon={Plus} size="sm" />
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-2 text-xs font-bold text-[var(--st-text-tertiary)] uppercase tracking-wider">SEV-1 &amp; SEV-2</div>
          <div className="space-y-0.5 px-2">
            <Button variant="ghost" block className="!justify-start bg-[var(--st-accent-soft)] text-[var(--st-accent)]" iconLeft={Hash}>
              <span className="flex-1 truncate text-left">inc-1024-db-outage</span>
              <Dot tone="danger" pulse className="ml-auto" />
            </Button>
            <Button variant="ghost" block className="!justify-start" iconLeft={Hash}>
              <span className="flex-1 truncate text-left">inc-1025-stripe-fail</span>
            </Button>
          </div>

          <div className="px-3 mt-6 mb-2 text-xs font-bold text-[var(--st-text-tertiary)] uppercase tracking-wider">Investigating</div>
          <div className="space-y-0.5 px-2">
            <Button variant="ghost" block className="!justify-start" iconLeft={Hash}>
              <span className="flex-1 truncate text-left">inc-1027-latency</span>
            </Button>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg)]">
          <div className="flex items-center gap-3">
            <InitialsChip initials="ME" className="w-8 h-8 text-xs bg-[var(--st-accent-soft)] text-[var(--st-accent)]" />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-[var(--st-text)] truncate">You (Commander)</p>
              <p className="text-xs text-[var(--st-status-ok)]">Online</p>
            </div>
            <IconButton label="War room settings" icon={Settings} size="sm" />
          </div>
        </div>
      </div>

      {/* MIDDLE PANEL: Chat / Timeline */}
      <div className="flex-1 flex flex-col bg-[var(--st-bg)] relative">
        <div className="h-16 border-b border-[var(--st-border)] flex items-center justify-between px-6 bg-[var(--st-bg-secondary)] z-10">
          <div>
            <h2 className="text-lg font-bold text-[var(--st-text)] flex items-center gap-2">
              <Hash size={20} className="text-[var(--st-accent)]" aria-hidden="true" />
              inc-1024-db-outage
              <Badge tone="danger" className="ml-2">SEV-1</Badge>
            </h2>
            <p className="text-xs text-[var(--st-text-secondary)] mt-0.5">Database replication lag across US-East regions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" iconLeft={Users}>12 Participants</Button>
            <div className="h-6 w-px bg-[var(--st-border)] mx-2" />
            <Button variant="primary" size="sm" iconLeft={Phone}>Join Bridge</Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="text-center">
            <span className="inline-block bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] text-xs px-3 py-1 rounded-full mb-4">Today</span>
          </div>

          {MOCK_MESSAGES.map((msg) => {
            const isMe = msg.user.id === 'u1';
            return (
              <div key={msg.id} className={`flex gap-4 max-w-3xl ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                <InitialsChip
                  initials={msg.user.avatar}
                  className={`w-10 h-10 text-sm flex-shrink-0 ${isMe ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)]' : ''}`}
                />
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-medium text-[var(--st-text)]">{msg.user.name}</span>
                    <span className="text-xs text-[var(--st-text-tertiary)]">{msg.timestamp}</span>
                  </div>
                  <div className={`p-3 rounded-2xl text-sm border ${isMe ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)] border-transparent rounded-tr-none' : 'bg-[var(--st-bg-secondary)] text-[var(--st-text)] border-[var(--st-border)] rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-4 max-w-3xl mx-auto my-8">
            <div className="flex-1 h-px bg-[var(--st-border)]" />
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--st-text-secondary)] border border-[var(--st-border)] rounded-full px-3 py-1 bg-[var(--st-bg-secondary)]">
              <Activity size={12} className="text-[var(--st-warn)]" aria-hidden="true" /> Status changed to Investigating
            </div>
            <div className="flex-1 h-px bg-[var(--st-border)]" />
          </div>
        </div>

        <div className="p-4 bg-[var(--st-bg-secondary)] border-t border-[var(--st-border)]">
          <div className="flex items-end gap-2 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius-lg)] p-2 focus-within:ring-2 focus-within:ring-[var(--st-accent)] transition-all">
            <IconButton label="Attach file" icon={Paperclip} variant="ghost" />
            <Textarea
              className="flex-1 !border-0 !bg-transparent resize-none max-h-32 min-h-[40px]"
              placeholder="Message #inc-1024-db-outage..."
              aria-label="War room message"
              rows={1}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <IconButton label="Add emoji" icon={Smile} variant="ghost" />
            <IconButton label="Send message" icon={Send} variant="primary" />
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Incident Metadata & Actions */}
      <div className="w-80 border-l border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex-col hidden lg:flex">
        <SegmentedControl
          aria-label="War room side panel"
          fullWidth
          className="m-3"
          value={activeTab === 'actions' ? 'actions' : 'details'}
          onChange={(v) => setActiveTab(v)}
          items={[
            { value: 'details', label: 'Details' },
            { value: 'actions', label: 'Actions' },
          ]}
        />

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab !== 'actions' ? (
            <>
              <div>
                <h4 className="text-xs font-bold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-3">Impacted Services</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="info" className="gap-1"><Database size={12} aria-hidden="true" /> Primary DB</Badge>
                  <Badge tone="info" className="gap-1"><Server size={12} aria-hidden="true" /> API Gateway</Badge>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-3">Key Roles</h4>
                <div className="space-y-3">
                  {[
                    { role: 'Commander', user: USERS[0] },
                    { role: 'Comms', user: USERS[2] },
                    { role: 'Operations', user: USERS[1] },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <InitialsChip initials={r.user.avatar} className="w-6 h-6 text-[10px]" />
                        <span className="text-sm text-[var(--st-text)]">{r.user.name}</span>
                      </div>
                      <Badge tone="neutral">{r.role}</Badge>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" block className="mt-2" iconLeft={Plus}>Assign Role</Button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-3">Linked Resources</h4>
                <div className="space-y-2">
                  <Button variant="outline" block className="!justify-between" iconRight={ArrowRight}>
                    <span className="flex items-center gap-2">
                      <BarChart size={14} className="text-[var(--st-accent)]" aria-hidden="true" />
                      Datadog: DB Metrics
                    </span>
                  </Button>
                  <Button variant="outline" block className="!justify-between" iconRight={ArrowRight}>
                    <span className="flex items-center gap-2">
                      <Terminal size={14} className="text-[var(--st-status-ok)]" aria-hidden="true" />
                      Runbook: DB Failover
                    </span>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Button variant="secondary" block className="!justify-start" iconLeft={Activity}>Update Status</Button>
              <Button variant="secondary" block className="!justify-start" iconLeft={AlertTriangle}>Escalate Severity</Button>
              <Button variant="secondary" block className="!justify-start" iconLeft={Globe}>Update Public Status Page</Button>
              <Button variant="secondary" block className="!justify-start" iconLeft={FileText}>Generate Summary Draft</Button>

              <div className="pt-6 mt-6 border-t border-[var(--st-border)]">
                <Button variant="danger" block iconLeft={CheckCircle}>Resolve Incident</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- 3. STATUS PAGE BUILDER ---
const StatusPageBuilder = () => {
  const [device, setDevice] = useState('desktop');
  const statusBarHeights = React.useMemo(
    () => Array.from({ length: 40 }, (_, i) => 22 + ((i * 17) % (i > 30 ? 60 : 30))),
    [],
  );

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Configuration Sidebar */}
      <div className="w-80 flex flex-col gap-4">
        <Card padding="none" className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle>Status Page Settings</CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <Field label="Page Title">
              <Input defaultValue="SabDesk System Status" />
            </Field>
            <Field label="Company Logo">
              <div className="flex gap-2">
                <Input defaultValue="brand/logo.png" className="flex-1" aria-label="Company logo path" />
                <IconButton label="Upload logo" icon={Upload} variant="outline" />
              </div>
            </Field>
            <div className="pt-4 border-t border-[var(--st-border)]">
              <h4 className="text-sm font-medium text-[var(--st-text)] mb-3">Service Components</h4>
              <div className="space-y-2">
                {SERVICES.map((s) => (
                  <div key={s} className="flex items-center justify-between p-2 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] cursor-grab hover:border-[var(--st-border-strong)] transition-colors">
                    <div className="flex items-center gap-2">
                      <ListOrdered size={14} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
                      <span className="text-sm text-[var(--st-text)]">{s}</span>
                    </div>
                    <IconButton label={`Configure ${s}`} icon={Settings} size="sm" />
                  </div>
                ))}
                <Button variant="outline" size="sm" block className="border-dashed mt-2" iconLeft={Plus}>Add Component</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <SegmentedControl
            aria-label="Preview device"
            value={device}
            onChange={setDevice}
            items={[
              { value: 'desktop', label: 'Desktop' },
              { value: 'mobile', label: 'Mobile' },
            ]}
          />
          <div className="flex gap-2">
            <Button variant="outline" iconLeft={Eye}>Preview</Button>
            <Button variant="primary" iconLeft={Globe}>Publish Changes</Button>
          </div>
        </div>

        <Card padding="none" className="flex-1 flex flex-col relative overflow-hidden">
          {/* Browser chrome */}
          <div className="h-10 bg-[var(--st-bg-muted)] border-b border-[var(--st-border)] flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <Dot tone="danger" />
              <Dot tone="warning" />
              <Dot tone="success" />
            </div>
            <div className="mx-auto bg-[var(--st-bg)] px-32 py-1 text-xs text-[var(--st-text-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)] flex items-center gap-2">
              <Lock size={10} aria-hidden="true" /> status.sabdesk.com
            </div>
          </div>

          {/* Status page content */}
          <div className="flex-1 overflow-y-auto bg-[var(--st-bg)] text-[var(--st-text)] p-12">
            <div className="max-w-3xl mx-auto space-y-12">

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--st-accent)] rounded-[var(--st-radius)]" aria-hidden="true" />
                  <h1 className="text-2xl font-bold text-[var(--st-text)]">SabDesk Status</h1>
                </div>
                <Button variant="ghost">Subscribe to Updates</Button>
              </div>

              {/* Status Banner */}
              <div className="bg-[var(--st-warn)]/10 border border-[var(--st-warn)]/30 rounded-[var(--st-radius-lg)] p-6 flex items-start gap-4">
                <AlertTriangle className="text-[var(--st-warn)] mt-1" size={24} aria-hidden="true" />
                <div>
                  <h2 className="text-lg font-bold text-[var(--st-text)]">Partial System Outage</h2>
                  <p className="text-[var(--st-text-secondary)] mt-1">We are currently investigating reports of elevated error rates on our main Database cluster. Some users may experience latency or timeouts.</p>
                  <p className="text-xs text-[var(--st-warn)] mt-4 font-medium uppercase tracking-wider">Posted 15 mins ago</p>
                </div>
              </div>

              {/* Metrics */}
              <div>
                <h3 className="text-lg font-bold mb-4 text-[var(--st-text)]">System Metrics</h3>
                <div className="h-48 border border-[var(--st-border)] rounded-[var(--st-radius-lg)] bg-[var(--st-bg-secondary)] p-4 flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-[var(--st-text-secondary)]">API Response Time</span>
                    <span className="text-sm font-bold text-[var(--st-status-ok)]">45ms</span>
                  </div>
                  <div className="flex-1 flex items-end gap-1">
                    {statusBarHeights.map((h, i) => (
                      <div key={i} className="flex-1 bg-[var(--st-accent)]/40 hover:bg-[var(--st-accent)]/60 rounded-t-sm" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Component Status */}
              <div>
                <h3 className="text-lg font-bold mb-4 text-[var(--st-text)]">Core Services</h3>
                <div className="border border-[var(--st-border)] rounded-[var(--st-radius-lg)] overflow-hidden divide-y divide-[var(--st-border)]">
                  {SERVICES.slice(0, 5).map((s, i) => {
                    const isDegraded = i === 2;
                    return (
                      <div key={s} className="p-4 flex items-center justify-between bg-[var(--st-bg)] hover:bg-[var(--st-bg-secondary)] transition-colors">
                        <span className="font-medium text-[var(--st-text)]">{s}</span>
                        {isDegraded ? (
                          <Badge tone="warning"><AlertCircle size={14} aria-hidden="true" className="mr-1 inline" /> Degraded Performance</Badge>
                        ) : (
                          <span className="flex items-center gap-2 text-[var(--st-status-ok)] text-sm font-medium">
                            <CheckCircle size={16} aria-hidden="true" /> Operational
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// --- 4. RCA POST-MORTEM EDITOR ---
const RCAPostMortemEditor = () => {
  const toolbarIcons: Array<{ icon: LucideIcon; label: string } | 'sep'> = [
    { icon: AlignLeft, label: 'Align left' },
    { icon: Bold, label: 'Bold' },
    { icon: Italic, label: 'Italic' },
    { icon: Underline, label: 'Underline' },
    'sep',
    { icon: List, label: 'Bulleted list' },
    { icon: ListOrdered, label: 'Numbered list' },
    'sep',
    { icon: Link2, label: 'Insert link' },
    { icon: ImageIcon, label: 'Insert image' },
    { icon: Code, label: 'Insert code' },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader>
        <PageHeaderHeading>
          <div className="flex items-center gap-3">
            <PageTitle>RCA: Database Outage - Oct 12</PageTitle>
            <Badge tone="warning">Draft</Badge>
          </div>
          <PageDescription>Incident: INC-1024. Lead: Alice Smith.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Save}>Save Draft</Button>
          <Button variant="primary" iconLeft={Send}>Submit for Review</Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">

          <Card padding="none" className="flex flex-col h-[500px]">
            <div className="p-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex flex-wrap items-center gap-1">
              {toolbarIcons.map((entry, i) =>
                entry === 'sep' ? (
                  <span key={i} className="w-px h-4 bg-[var(--st-border)] mx-1" />
                ) : (
                  <IconButton key={i} label={entry.label} icon={entry.icon} size="sm" />
                ),
              )}
              <span className="ml-auto text-xs text-[var(--st-text-tertiary)]">Last saved 2 mins ago</span>
            </div>
            <div className="flex-1 p-6 overflow-y-auto bg-[var(--st-bg)] space-y-4">
              <h3 className="text-base font-semibold text-[var(--st-text)]">Executive Summary</h3>
              <p className="text-sm text-[var(--st-text-secondary)]">On October 12, 2026, a configuration change to the primary database cluster in US-East caused severe replication lag across read replicas. This resulted in stale data being served to frontend clients and timeout errors on the Payment Gateway integration.</p>

              <h3 className="text-base font-semibold text-[var(--st-text)]">Impact</h3>
              <ul className="list-disc pl-5 text-sm text-[var(--st-text-secondary)] space-y-1">
                <li><strong className="text-[var(--st-text)]">Duration:</strong> 42 minutes</li>
                <li><strong className="text-[var(--st-text)]">Affected Users:</strong> Approximately 15% of active sessions in US region.</li>
                <li><strong className="text-[var(--st-text)]">Revenue Impact:</strong> Estimated $4,500 in dropped transactions.</li>
              </ul>

              <h3 className="text-base font-semibold text-[var(--st-text)]">Root Cause</h3>
              <p className="text-sm text-[var(--st-text-secondary)]">The root cause was identified as a missing composite index on the <code className="text-[var(--st-accent)]">transactions</code> table, which was dropped during a routine migration script execution. As a result, subsequent queries performed full table scans, locking rows and halting replication threads.</p>

              <div className="p-4 my-4 border border-[var(--st-border)] bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] font-mono text-sm text-[var(--st-status-ok)]">
                {'// Mitigation applied:'}<br />
                CREATE INDEX idx_tx_status_date ON transactions(status, created_at);
              </div>

              <p className="text-sm text-[var(--st-text-secondary)]">Following the creation of the index, replication lag recovered at a rate of 100MB/s, fully catching up within 15 minutes.</p>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-[var(--st-text)] mb-4">The "5 Whys"</h3>
            <div className="space-y-4">
              {[
                'Why did the database replication lag? Because queries on the primary node were extremely slow, causing a backlog in the replication log.',
                'Why were the queries slow? Because a critical composite index was missing on the transactions table, forcing full table scans.',
                'Why was the index missing? Because the database migration script V124_drop_old_tables.sql accidentally included a DROP INDEX command for an active index.',
                'Why was this script approved and merged? Because it bypassed the staging environment tests which normally catch performance regressions.',
                "Why did it bypass staging? Because it was marked as a 'hotfix' by a developer, which currently bypasses the automated staging pipeline.",
              ].map((text, i) => (
                <div key={i} className="flex gap-4 items-start group">
                  <span className="w-8 h-8 rounded-full bg-[var(--st-bg-muted)] flex items-center justify-center text-[var(--st-text-secondary)] font-bold flex-shrink-0" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <Field label={`Why number ${i + 1}`} className="!gap-1">
                      <Textarea rows={2} defaultValue={text} aria-label={`Why number ${i + 1}`} />
                    </Field>
                  </div>
                </div>
              ))}
              <Button variant="outline" block className="border-dashed" iconLeft={Plus}>Add Another Why</Button>
            </div>
          </Card>

        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-bold text-[var(--st-text)] mb-4">Action Items</h3>
            <div className="space-y-3">
              {[
                { title: 'Update CI/CD pipeline to disallow hotfixes bypassing DB tests', owner: 'DevOps', status: 'In Progress' },
                { title: 'Add Datadog monitor for missing critical indexes', owner: 'DBA Team', status: 'To Do' },
                { title: 'Conduct training on migration best practices', owner: 'Alice S.', status: 'To Do' },
              ].map((item, i) => (
                <div key={i} className="p-3 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] hover:border-[var(--st-border-strong)] transition-colors">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <p className="text-sm font-medium text-[var(--st-text)]">{item.title}</p>
                    <IconButton label={`Action options for ${item.title}`} icon={MoreVertical} size="sm" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
                      <Users size={12} aria-hidden="true" /> {item.owner}
                    </div>
                    <Badge tone={item.status === 'In Progress' ? 'info' : 'neutral'}>{item.status}</Badge>
                  </div>
                </div>
              ))}
              <Button variant="secondary" block iconLeft={Plus}>Add Action Item</Button>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-[var(--st-text)] mb-4">Timeline Selection</h3>
            <p className="text-xs text-[var(--st-text-secondary)] mb-4">Select events from the incident timeline to include in the final RCA report.</p>

            <div className="space-y-3">
              {MOCK_TIMELINE.map((event, i) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                  <Checkbox defaultChecked={i % 2 === 0} aria-label={`Include ${event.title}`} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-[var(--st-accent)] mb-1">{event.time}</div>
                    <div className="text-sm font-medium text-[var(--st-text)]">{event.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- 5. DETAILED TIMELINE ---
const IncidentTimeline = () => {
  const [timeRange, setTimeRange] = useState('all');

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-64 flex flex-col gap-4">
        <Card>
          <h3 className="font-semibold text-[var(--st-text)] mb-4">Filters</h3>
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2 block">Event Type</span>
              <div className="space-y-2">
                {['Alerts', 'Status Changes', 'Chat Messages', 'Commits/Deployments', 'Manual Entries'].map((f) => (
                  <Checkbox key={f} defaultChecked label={f} />
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-[var(--st-border)]">
              <Field label="Time Range">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger aria-label="Time range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="hour">Last Hour</SelectItem>
                    <SelectItem value="day">Last 24 Hours</SelectItem>
                    <SelectItem value="custom">Custom Range...</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="pt-4 border-t border-[var(--st-border)]">
              <Button variant="outline" block iconLeft={Search}>Search Logs</Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="flex-1 overflow-y-auto relative" padding="lg">
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-[var(--st-border)] sticky top-0 bg-[var(--st-bg)] z-20">
          <h2 className="text-xl font-bold text-[var(--st-text)]">Incident Timeline</h2>
          <Button variant="primary" iconLeft={Plus}>Add Manual Event</Button>
        </div>

        <div className="relative pl-8 sm:pl-32 py-6 group">
          {/* Vertical Line */}
          <div className="absolute top-0 bottom-0 left-8 sm:left-32 w-px bg-[var(--st-border)] -translate-x-1/2" />

          <div className="space-y-12">
            {[...MOCK_TIMELINE, ...MOCK_TIMELINE].map((event, i) => {
              let Icon: LucideIcon = Activity;
              let nodeTone = 'var(--st-accent)';
              if (event.type === 'alert') { Icon = AlertTriangle; nodeTone = 'var(--st-danger)'; }
              if (event.type === 'chat') { Icon = MessageSquare; nodeTone = 'var(--st-accent)'; }
              if (event.type === 'commit') { Icon = Code; nodeTone = 'var(--st-status-ok)'; }

              return (
                <div key={i} className="relative group/item">
                  {/* Timestamp */}
                  <div className="absolute left-0 sm:-left-24 top-1 text-sm font-mono text-[var(--st-text-tertiary)] sm:text-right w-20 hidden sm:block">
                    {event.time}
                  </div>

                  {/* Node (runtime tone color) */}
                  <div
                    className="absolute left-0 sm:left-0 top-1 w-8 h-8 rounded-full border-4 border-[var(--st-bg)] flex items-center justify-center -translate-x-1/2 z-10 group-hover/item:scale-110 transition-transform"
                    style={{ background: nodeTone }}
                  >
                    <Icon size={12} className="text-[var(--st-text-inverted)]" aria-hidden="true" />
                  </div>

                  {/* Content Card */}
                  <div className="pl-6 sm:pl-10">
                    <div className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] p-4 rounded-[var(--st-radius-lg)] hover:border-[var(--st-border-strong)] transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-base font-bold text-[var(--st-text)]">{event.title}</h4>
                        <IconButton label={`Edit ${event.title}`} icon={Edit2} size="sm" className="opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                        <span className="flex items-center gap-1.5"><Users size={14} aria-hidden="true" /> {event.user}</span>
                        <span>-</span>
                        <span className="capitalize">{event.type} Source</span>
                      </div>

                      {event.type === 'commit' && (
                        <div className="mt-3 bg-[var(--st-bg)] p-3 rounded-[var(--st-radius)] border border-[var(--st-border)] font-mono text-xs text-[var(--st-text)] overflow-x-auto">
                          $ git revert HEAD~1 <br />
                          [main 4f8b9d] Revert "Add composite index to tx table"<br />
                          1 file changed, 1 insertion(+), 15 deletions(-)
                        </div>
                      )}
                      {event.type === 'alert' && (
                        <div className="mt-3 bg-[var(--st-danger-soft)] p-3 rounded-[var(--st-radius)] border border-[var(--st-danger)]/30 text-xs text-[var(--st-danger)]">
                          <strong>Trigger:</strong> avg(last_5m):system.cpu.system{'{host:db-primary-east}'} {'>'} 95<br />
                          <strong>Value:</strong> 99.4%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="absolute bottom-0 left-8 sm:left-32 w-4 h-4 rounded-full border-2 border-[var(--st-border)] bg-[var(--st-bg)] -translate-x-1/2 translate-y-1/2" />
        </div>
      </Card>
    </div>
  );
};


// ============================================================================
// MAIN PAGE LAYOUT
// ============================================================================

const RadioWaveIcon = () => (
  <span className="relative flex h-3 w-3 mr-2" aria-hidden="true">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--st-danger)] opacity-75" />
    <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--st-danger)]" />
  </span>
);

export default function IncidentManagementPage() {
  const [activeView, setActiveView] = useState('overview');

  const navItems: Array<{ id: string; label: string; icon: LucideIcon | 'wave' }> = [
    { id: 'overview', label: 'Overview Dashboard', icon: Layout },
    { id: 'warroom', label: 'Active War Rooms', icon: 'wave' },
    { id: 'statuspage', label: 'Status Pages', icon: Globe },
    { id: 'rca', label: 'RCA & Post-Mortems', icon: FileText },
    { id: 'timeline', label: 'Global Timeline', icon: Clock },
    { id: 'settings', label: 'Settings & Routing', icon: Settings },
  ];

  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] flex flex-col">

      {/* TOPBAR */}
      <header className="h-16 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 bg-[var(--st-accent)] rounded-[var(--st-radius)] flex items-center justify-center" aria-hidden="true">
            <Shield size={18} className="text-[var(--st-text-inverted)]" />
          </span>
          <h1 className="text-xl font-bold text-[var(--st-text)]">SabDesk Incident Mgmt</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:block w-64">
            <Field label="" className="!gap-0">
              <Input iconLeft={Search} placeholder="Search incidents, logs" aria-label="Search incidents and logs" />
            </Field>
          </div>
          <IconButton label="Notifications" icon={Bell} variant="ghost" />
          <Avatar name="Felix" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-64 border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] hidden md:flex flex-col py-6">
          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  block
                  onClick={() => setActiveView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`!justify-start ${
                    isActive
                      ? 'bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
                      : 'text-[var(--st-text-secondary)]'
                  }`}
                >
                  {item.icon === 'wave' ? (
                    <RadioWaveIcon />
                  ) : (
                    <item.icon size={18} className={isActive ? 'text-[var(--st-accent)]' : 'text-[var(--st-text-tertiary)]'} aria-hidden="true" />
                  )}
                  {item.label}
                </Button>
              );
            })}
          </nav>

          <div className="px-6 mt-auto">
            <div className="bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius-lg)] p-4 relative overflow-hidden">
              <h4 className="text-sm font-bold text-[var(--st-text)] mb-1">On-Call Engineer</h4>
              <p className="text-xs text-[var(--st-text-secondary)] mb-3">Alice Smith (Tier 1)</p>
              <Button variant="primary" size="sm" block iconLeft={Phone}>Page Now</Button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-6 bg-[var(--st-bg)]">
          <div className="max-w-[1600px] mx-auto">
            {activeView === 'overview' && <OverviewDashboard />}
            {activeView === 'warroom' && <WarRoom />}
            {activeView === 'statuspage' && <StatusPageBuilder />}
            {activeView === 'rca' && <RCAPostMortemEditor />}
            {activeView === 'timeline' && <IncidentTimeline />}
            {activeView === 'settings' && (
              <div className="flex items-center justify-center h-full animate-in fade-in">
                <EmptyState
                  icon={Settings}
                  title="Settings Module"
                  description="Advanced routing and integration configurations loading..."
                />
              </div>
            )}
          </div>
        </main>
      </div>

    </div>
  );
}
