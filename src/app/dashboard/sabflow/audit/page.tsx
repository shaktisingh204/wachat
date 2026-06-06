'use client';

import * as React from 'react';
import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
  Breadcrumb,
  ZoruBreadcrumbList,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbSeparator,
  ZoruBreadcrumbPage,
  StatCard,
  DataTable,
  Badge,
  Button,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { type ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  Download,
  Filter,
  History,
  ShieldAlert,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react';

type AuditAction = 'flow.created' | 'flow.published' | 'flow.deleted' | 'connection.created' | 'connection.deleted' | 'workspace.updated';
type AuditSeverity = 'info' | 'warning' | 'critical';

interface AuditRecord {
  id: string;
  timestamp: string;
  action: AuditAction;
  user: {
    name: string;
    email: string;
  };
  target: string;
  ipAddress: string;
  severity: AuditSeverity;
  metadata: Record<string, unknown>;
}

const mockAuditLogs: AuditRecord[] = [
  {
    id: 'evt_1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    action: 'flow.published',
    user: { name: 'Sarah Connor', email: 'sarah@example.com' },
    target: 'Lead Gen Flow',
    ipAddress: '192.168.1.1',
    severity: 'info',
    metadata: { version: 'v2.1', nodes: 14 }
  },
  {
    id: 'evt_2',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    action: 'connection.deleted',
    user: { name: 'John Doe', email: 'john@example.com' },
    target: 'Salesforce Prod',
    ipAddress: '10.0.0.5',
    severity: 'warning',
    metadata: { connectionId: 'conn_8291' }
  },
  {
    id: 'evt_3',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    action: 'workspace.updated',
    user: { name: 'Admin', email: 'admin@system.local' },
    target: 'Global Settings',
    ipAddress: '172.16.2.2',
    severity: 'critical',
    metadata: { field: 'billing_plan', from: 'Pro', to: 'Enterprise' }
  },
  {
    id: 'evt_4',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    action: 'flow.created',
    user: { name: 'Sarah Connor', email: 'sarah@example.com' },
    target: 'Onboarding Sequence',
    ipAddress: '192.168.1.1',
    severity: 'info',
    metadata: { template: 'blank' }
  }
];

export default function SabflowAuditPage() {
  const { toast } = useZoruToast();
  
  const columns = React.useMemo<ColumnDef<AuditRecord>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: 'Time',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-[13px] text-zoru-ink">
              {formatDistanceToNow(new Date(row.original.timestamp), { addSuffix: true })}
            </span>
            <span className="text-[11px] text-zoru-ink-muted">
              {new Date(row.original.timestamp).toLocaleString()}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ row }) => {
          const action = row.original.action;
          const isWarning = row.original.severity === 'warning';
          const isCritical = row.original.severity === 'critical';
          
          let Icon = Activity;
          if (isWarning) Icon = ShieldAlert;
          if (isCritical) Icon = Zap;
          if (action.includes('flow')) Icon = Activity;
          if (action.includes('connection')) Icon = ShieldCheck;
          
          return (
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-zoru-ink-subtle" />
              <span className="text-[13px] font-medium text-zoru-ink">{action}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'target',
        header: 'Target',
        cell: ({ row }) => (
          <span className="text-[13px] text-zoru-ink font-medium">
            {row.original.target}
          </span>
        ),
      },
      {
        accessorKey: 'user',
        header: 'User',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zoru-surface-2 text-[10px] font-medium text-zoru-ink">
              {row.original.user.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-[12.5px] text-zoru-ink leading-tight">{row.original.user.name}</span>
              <span className="text-[11px] text-zoru-ink-muted leading-tight">{row.original.user.email}</span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'ipAddress',
        header: 'IP Address',
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-zoru-ink-muted">
            {row.original.ipAddress}
          </span>
        ),
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => {
          const variants = {
            info: 'secondary',
            warning: 'warning',
            critical: 'destructive',
          } as const;
          return <Badge variant={variants[row.original.severity]}>{row.original.severity}</Badge>;
        },
      },
    ],
    []
  );

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/sabflow">SabFlow</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Audit Log</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Security & Compliance</ZoruPageEyebrow>
          <ZoruPageTitle>Workspace Audit Log</ZoruPageTitle>
          <ZoruPageDescription>
            Immutable, tamper-evident log of all workspace actions. Track who modified flows, changed settings, or deleted connections, including full metadata and IP signatures.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline" size="sm" onClick={() => toast({ title: 'Exporting...', description: 'Your CSV will be ready shortly.' })}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => toast({ title: 'Filtered', description: 'Advanced filters applied.' })}>
            <Filter className="mr-2 h-4 w-4" /> Advanced Filter
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <StatCard
          label="Total Events"
          value="1,284"
          period="Last 30 days"
          icon={<History />}
        />
        <StatCard
          label="Flow Updates"
          value="85"
          period="Across all workspaces"
          icon={<Activity />}
        />
        <StatCard
          label="Active Users"
          value="12"
          period="With mutating actions"
          icon={<User />}
        />
        <StatCard
          label="Critical Events"
          value="3"
          period="Requires attention"
          icon={<ShieldAlert />}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-[14px] font-medium text-zoru-ink">Event Timeline</h2>
        <p className="text-[12px] text-zoru-ink-muted">All tracked actions for this workspace.</p>
        
        <div className="mt-4">
          <DataTable
            columns={columns}
            data={mockAuditLogs}
            filterColumn="action"
            filterPlaceholder="Filter by action..."
          />
        </div>
      </div>
    </div>
  );
}
