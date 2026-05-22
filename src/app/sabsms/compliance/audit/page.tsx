"use client";

import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import {
  ShieldCheck,
  Search,
  Activity,
  Lock,
  Play,
  FileJson,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Cpu,
  Eye,
  Archive,
  Download,
  RefreshCw,
  Zap,
  Bot,
  Webhook,
  Settings2,
  Database,
  History,
  FileText,
  User,
  Hash,
  Share,
  Share2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDetailDrawer,
  useSabsmsUrlState,
  SabsmsSavedViews,
  SabsmsRefreshButton,
  type SabsmsFacet,
} from "@/components/sabsms/page-toolkit";

import { 
  DataTable, 
  ZoruActionSearchBar, 
  ZoruActionSearchAction,
  ZoruStatisticsCard1,
  ZoruStatisticsCard1Item,
  DropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem
} from "@/components/zoruui";

// Mock Data Types
type AuditAction = "template-approved" | "suppression-added" | "consent-changed" | "send-blocked" | "campaign-launched";
type AuditActor = "user" | "system" | "admin" | "api-key";
type AuditSubject = "phone" | "template" | "campaign" | "drip" | "number";
type AuditSeverity = "info" | "warning" | "critical";

interface AuditRecord {
  id: string;
  timestamp: string;
  action: AuditAction;
  actor: AuditActor;
  actorName: string;
  subject: AuditSubject;
  subjectId: string;
  workspaceId: string;
  severity: AuditSeverity;
  payload: any;
  hash: string;
  previousHash: string;
  reversible: boolean;
  diff?: {
    field: string;
    old: any;
    new: any;
  }[];
}

const mockAuditLogs: AuditRecord[] = [
  {
    id: "evt_01HVKXZ2K3",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    action: "template-approved",
    actor: "admin",
    actorName: "Sarah Connor",
    subject: "template",
    subjectId: "tpl_promo_v2",
    workspaceId: "ws_acme_corp",
    severity: "info",
    payload: { category: "marketing", body: "Sale ends tonight!" },
    hash: "a4f8b9...c3d2",
    previousHash: "e5d4c3...b2a1",
    reversible: false,
    diff: [
      { field: "status", old: "pending", new: "approved" },
      { field: "reviewedBy", old: null, new: "Sarah Connor" }
    ]
  },
  {
    id: "evt_01HVKXZ3L4",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    action: "consent-changed",
    actor: "system",
    actorName: "Inbound webhook processor",
    subject: "phone",
    subjectId: "+15550102030",
    workspaceId: "ws_acme_corp",
    severity: "warning",
    payload: { reason: "STOP keyword matched" },
    hash: "99c3d4...88f2",
    previousHash: "a4f8b9...c3d2",
    reversible: true,
    diff: [
      { field: "consentStatus", old: "opt-in", new: "opt-out" },
      { field: "captureMethod", old: "web-form", new: "inbound-sms" }
    ]
  },
  {
    id: "evt_01HVKXZ4M5",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    action: "suppression-added",
    actor: "api-key",
    actorName: "CRM Sync Key",
    subject: "phone",
    subjectId: "+15550109999",
    workspaceId: "ws_globex",
    severity: "info",
    payload: { source: "import", batchId: "batch_88" },
    hash: "11a2b3...44c5",
    previousHash: "99c3d4...88f2",
    reversible: true,
    diff: [
      { field: "isSuppressed", old: false, new: true }
    ]
  },
  {
    id: "evt_01HVKXZ5N6",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    action: "send-blocked",
    actor: "system",
    actorName: "Compliance Engine",
    subject: "campaign",
    subjectId: "cmp_flash_sale",
    workspaceId: "ws_acme_corp",
    severity: "critical",
    payload: { rule: "Quiet Hours (TRAI)" },
    hash: "55d6e7...88f9",
    previousHash: "11a2b3...44c5",
    reversible: false
  }
];

const FACETS: SabsmsFacet[] = [
  {
    id: "action",
    label: "Action",
    options: [
      { value: "template-approved", label: "Template Approved" },
      { value: "suppression-added", label: "Suppression Added" },
      { value: "consent-changed", label: "Consent Changed" },
      { value: "send-blocked", label: "Send Blocked" },
      { value: "campaign-launched", label: "Campaign Launched" },
    ],
  },
  {
    id: "actor",
    label: "Actor",
    options: [
      { value: "user", label: "User" },
      { value: "system", label: "System" },
      { value: "admin", label: "Admin" },
      { value: "api-key", label: "API Key" },
    ],
  },
  {
    id: "severity",
    label: "Severity",
    options: [
      { value: "info", label: "Info" },
      { value: "warning", label: "Warning" },
      { value: "critical", label: "Critical" },
    ],
  },
];

export default function ComplianceAuditPage() {
  const { filters, setFilters, pagination, setPagination } = useSabsmsUrlState({
    defaultPagination: { pageIndex: 0, pageSize: 20 },
  });

  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);
  const [retentionDialogOpen, setRetentionDialogOpen] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [summarizeDialogOpen, setSummarizeDialogOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<AuditRecord[]>([]);
  
  const selectedRecord = mockAuditLogs.find((r) => r.id === detailRecordId) || null;

  const aiSummarizeAction = {
    label: "Summarise this hour",
    icon: <Bot className="h-4 w-4" />,
    onClick: () => setSummarizeDialogOpen(true),
    variant: "outline" as const,
  };

  const retentionAction = {
    label: "Retention Policy",
    icon: <Archive className="h-4 w-4" />,
    onClick: () => setRetentionDialogOpen(true),
    variant: "ghost" as const,
  };

  const webhookAction = {
    label: "Audit Webhook",
    icon: <Webhook className="h-4 w-4" />,
    onClick: () => setWebhookDialogOpen(true),
    variant: "ghost" as const,
  };

  const searchActions: ZoruActionSearchAction[] = useMemo(() => {
    const actions: ZoruActionSearchAction[] = mockAuditLogs.map(log => ({
      id: log.id,
      label: `Hash: ${log.hash}`,
      icon: <Hash className="h-4 w-4" />,
      meta: log.action,
      onSelect: () => setDetailRecordId(log.id),
    }));
    
    actions.unshift({
      id: "verify-integrity",
      label: "Verify Global Chain Integrity",
      icon: <ShieldCheck className="h-4 w-4" />,
      shortcut: "⌘V",
      onSelect: () => toast.success("Chain is completely valid! No tampering detected."),
    });

    return actions;
  }, []);

  const columns: ColumnDef<AuditRecord>[] = useMemo(() => [
    {
      accessorKey: "timestamp",
      header: "Time",
      cell: ({ row }) => format(new Date(row.original.timestamp), "MMM d, HH:mm:ss"),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.action === "send-blocked" ? (
            <ShieldAlert className="h-4 w-4 text-destructive" />
          ) : row.original.action === "consent-changed" ? (
            <User className="h-4 w-4 text-orange-500" />
          ) : (
            <Activity className="h-4 w-4 text-primary" />
          )}
          <span className="font-medium">{row.original.action}</span>
        </div>
      ),
    },
    {
      accessorKey: "actor",
      header: "Actor",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.actorName}</span>
          <span className="text-xs text-muted-foreground">{row.original.actor}</span>
        </div>
      ),
    },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.subjectId}</span>
          <span className="text-xs text-muted-foreground">{row.original.subject}</span>
        </div>
      ),
    },
    {
      accessorKey: "severity",
      header: "Severity",
      cell: ({ row }) => {
        const variants = {
          info: "secondary",
          warning: "warning",
          critical: "destructive",
        } as const;
        return <Badge variant={variants[row.original.severity] as any}>{row.original.severity}</Badge>;
      },
    },
    {
      accessorKey: "hash",
      header: "Hash",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          {row.original.hash}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        return (
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuItem onSelect={() => setDetailRecordId(row.original.id)}>
                <Eye className="mr-2 h-4 w-4" /> View Details
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onSelect={() => toast.success("Hash copied.")}>
                <Hash className="mr-2 h-4 w-4" /> Copy Hash
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem disabled={!row.original.reversible}>
                <Play className="mr-2 h-4 w-4" /> Replay Action
              </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        );
      }
    }
  ], []);

  // Filter the mock logs locally since we use TanStack Table internally 
  const filteredData = useMemo(() => {
    let data = [...mockAuditLogs];
    if (filters.action) {
      const actionFilters = Array.isArray(filters.action) ? filters.action : [filters.action];
      if (actionFilters.length > 0) {
        data = data.filter(d => actionFilters.includes(d.action));
      }
    }
    if (filters.actor) {
      const actorFilters = Array.isArray(filters.actor) ? filters.actor : [filters.actor];
      if (actorFilters.length > 0) {
        data = data.filter(d => actorFilters.includes(d.actor));
      }
    }
    if (filters.severity) {
      const severityFilters = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      if (severityFilters.length > 0) {
        data = data.filter(d => severityFilters.includes(d.severity));
      }
    }
    return data;
  }, [filters]);

  const statItems: ZoruStatisticsCard1Item[] = [
    { label: "Valid Chains", value: "99.99%", delta: 0.01, meta: "Cryptographically verified" },
    { label: "Critical Events", value: "24", delta: -12.5, meta: "Last 24 hours" },
    { label: "Avg Block Time", value: "42ms", delta: 5.2, meta: "Tamper detection speed" },
  ];

  return (
    <SabsmsPageShell
      title="Audit Log & Compliance"
      description="Immutable, tamper-evident log of all system actions. Cryptographically verified."
      breadcrumbs={[
        { label: "Compliance", href: "/sabsms/compliance" },
        { label: "Audit Log", href: "/sabsms/compliance/audit", active: true },
      ]}
      secondaryActions={[
        webhookAction,
        retentionAction,
        aiSummarizeAction,
        {
          label: "Export",
          icon: <Download className="h-4 w-4" />,
          onClick: () => {},
          variant: "outline",
        }
      ]}
    >
      <div className="space-y-8">

        {/* Premium Data-Rich Header */}
        <ZoruStatisticsCard1
          headline="Total Audit Events"
          value="1,492,034"
          icon={<Database />}
          items={statItems}
          footer="Audit logs are retained in cold storage for 7 years as per compliance policy."
          className="bg-white/50 backdrop-blur-md shadow-sm border-slate-200"
        />

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0 w-full">
            <SabsmsFilterBar
              facets={FACETS}
              filters={filters}
              onFiltersChange={setFilters}
              placeholder="Search by ID or context..."
              enableDateRange
            />
          </div>
          <div className="flex items-center gap-2">
            <SabsmsRefreshButton isRefreshing={false} onRefresh={() => toast.success("Refreshed")} />
            <SabsmsSavedViews
              currentViewId={null}
              views={[{ id: "v1", name: "Consent Changes", filters: {} }]}
              onLoadView={(v) => toast.info(`Loaded view ${v.name}`)}
              onSaveView={(n) => toast.success(`Saved view ${n}`)}
            />
          </div>
        </div>

        {/* Highly Filterable DataTable utilizing ActionSearchBar */}
        <DataTable
          columns={columns}
          data={filteredData}
          filterColumn="action"
          filterPlaceholder="Filter actions..."
          showColumnMenu={true}
          pageSize={10}
          onRowSelectionChange={setRowSelection}
          toolbar={
            <ZoruActionSearchBar 
              actions={searchActions} 
              placeholder="Search by hash, command (⌘K)..." 
              className="w-72 md:w-96"
            />
          }
        />
      </div>

      {/* Drill-Down Drawer (F12) */}
      <SabsmsDetailDrawer
        open={!!detailRecordId}
        onOpenChange={(v) => !v && setDetailRecordId(null)}
        title={`Audit Record: ${selectedRecord?.id}`}
      >
        {selectedRecord && (
          <ScrollArea className="h-[calc(100vh-100px)] px-6 pb-6">
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Time</p>
                  <p className="font-medium">{format(new Date(selectedRecord.timestamp), "PPpp")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Severity</p>
                  <Badge variant={selectedRecord.severity === 'critical' ? 'destructive' : selectedRecord.severity === 'warning' ? 'secondary' : 'default' as any}>
                    {selectedRecord.severity}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Actor</p>
                  <p className="font-medium">{selectedRecord.actorName}</p>
                  <p className="text-xs text-muted-foreground">{selectedRecord.actor}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Subject</p>
                  <p className="font-medium">{selectedRecord.subjectId}</p>
                  <p className="text-xs text-muted-foreground">{selectedRecord.subject}</p>
                </div>
              </div>

              <Tabs defaultValue="diff">
                <TabsList className="w-full">
                  <TabsTrigger value="diff" className="flex-1">Diff</TabsTrigger>
                  <TabsTrigger value="payload" className="flex-1">Payload</TabsTrigger>
                  <TabsTrigger value="hash" className="flex-1">Hash Chain</TabsTrigger>
                </TabsList>
                
                {/* 7. Inline diff for change events */}
                <TabsContent value="diff" className="mt-4">
                  {selectedRecord.diff ? (
                    <div className="border rounded-md overflow-hidden text-sm font-mono">
                      {selectedRecord.diff.map((d, i) => (
                        <div key={i} className="divide-y border-b last:border-b-0">
                          <div className="bg-muted/50 p-2 border-b">
                            Field: <strong>{d.field}</strong>
                          </div>
                          <div className="bg-red-500/10 text-red-600 p-2 flex gap-4">
                            <span className="w-4 select-none opacity-50">-</span>
                            <span>{JSON.stringify(d.old)}</span>
                          </div>
                          <div className="bg-green-500/10 text-green-600 p-2 flex gap-4">
                            <span className="w-4 select-none opacity-50">+</span>
                            <span>{JSON.stringify(d.new)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground border rounded-md border-dashed">
                      No diff available for this action.
                    </div>
                  )}
                </TabsContent>
                
                {/* 19. Per-record raw payload viewer */}
                <TabsContent value="payload" className="mt-4">
                  <div className="bg-muted p-4 rounded-md font-mono text-sm overflow-x-auto">
                    <pre>{JSON.stringify(selectedRecord.payload, null, 2)}</pre>
                  </div>
                </TabsContent>
                
                {/* 16. Tamper-evident hash chain display */}
                <TabsContent value="hash" className="mt-4">
                  <div className="space-y-4">
                    <div className="border rounded-md p-4 space-y-4 bg-muted/30">
                      <div className="flex items-start gap-3">
                        <Lock className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium">Current Record Hash</p>
                          <p className="font-mono text-xs text-muted-foreground mt-1 break-all bg-muted p-2 rounded border">
                            {selectedRecord.hash}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <History className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">Previous Record Hash</p>
                          <p className="font-mono text-xs text-muted-foreground mt-1 break-all bg-muted p-2 rounded border">
                            {selectedRecord.previousHash}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => toast.success("Integrity verified.")}>
                        <ShieldCheck className="h-4 w-4 mr-2" /> Verify Integrity
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}
      </SabsmsDetailDrawer>

      {/* Dialogs */}
      {/* 18. AI Summarise */}
      <Dialog open={summarizeDialogOpen} onOpenChange={setSummarizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> AI Summary (Last Hour)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p><strong>38 events</strong> occurred in the last hour across 2 workspaces.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>12</strong> consent changes (mostly inbound STOP keywords).</li>
              <li><strong>5</strong> campaign sends blocked due to quiet hours policy violations in <span className="text-foreground font-medium">ws_acme_corp</span>.</li>
              <li><strong>1</strong> new API key provisioned by Admin.</li>
            </ul>
            <p>No anomalous activity detected. Hash chain integrity is 100% verified.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setSummarizeDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 10. Retention Policy Editor & 15. Auto-archive */}
      <Dialog open={retentionDialogOpen} onOpenChange={setRetentionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audit Log Retention Policy</DialogTitle>
            <DialogDescription>
              Configure how long audit logs are kept online and when they are archived.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Auto-Archive Policy</Label>
                <p className="text-sm text-muted-foreground">Move logs to cold storage (S3 Glacier) after a set period.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="space-y-2">
              <Label>Online Retention (Days)</Label>
              <Input type="number" defaultValue={90} />
            </div>
            <div className="space-y-2">
              <Label>Cold Storage Retention (Years)</Label>
              <Input type="number" defaultValue={7} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetentionDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast.success("Retention policy updated."); setRetentionDialogOpen(false); }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. Webhook Publisher */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audit Event Webhook</DialogTitle>
            <DialogDescription>
              Stream audit log events to your external SIEM or compliance monitoring tool.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Webhook</Label>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input type="url" defaultValue="https://siem.acme-corp.com/ingest/sabsms" />
            </div>
            <div className="space-y-2">
              <Label>Signing Secret (HMAC SHA-256)</Label>
              <div className="flex gap-2">
                <Input type="password" defaultValue="whsec_1234567890abcdef" readOnly />
                <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast.success("Webhook config saved."); setWebhookDialogOpen(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}
