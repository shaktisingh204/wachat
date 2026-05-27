"use client";

import React, { useState } from "react";
import {
  Download,
  Trash,
  CheckCircle,
  FileText,
  Shield,
  Settings,
  ExternalLink,
  Users,
  AlertTriangle,
  Clock,
  EyeOff,
} from "lucide-react";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import {
  SabsmsDataTable,
  type SabsmsColumn,
} from "@/components/sabsms/page-toolkit/sabsms-data-table";
import { SabsmsFilterBar } from "@/components/sabsms/page-toolkit/sabsms-filter-bar";
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Button,
  Badge,
  Switch,
  Label,
  Input,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
  StatCard,
  Separator,
} from "@/components/zoruui";

type RequestType = "SAR" | "Erasure" | "Rectification";

interface RequestRow {
  id: string;
  phone: string;
  type: RequestType;
  status: "Pending" | "Fulfilled" | "Rejected" | "In Progress";
  slaDaysRemaining: number;
  dateReceived: string;
}

const MOCK_REQUESTS: RequestRow[] = [
  { id: "req-001", phone: "+1234567890", type: "SAR", status: "Pending", slaDaysRemaining: 12, dateReceived: "2026-05-10" },
  { id: "req-002", phone: "+0987654321", type: "Erasure", status: "Fulfilled", slaDaysRemaining: 0, dateReceived: "2026-05-01" },
  { id: "req-003", phone: "+1122334455", type: "SAR", status: "In Progress", slaDaysRemaining: 2, dateReceived: "2026-04-25" },
  { id: "req-004", phone: "+447712345678", type: "Erasure", status: "Pending", slaDaysRemaining: 28, dateReceived: "2026-05-20" },
  { id: "req-005", phone: "+15551234567", type: "Rectification", status: "Pending", slaDaysRemaining: 15, dateReceived: "2026-05-15" },
  { id: "req-006", phone: "+491701234567", type: "SAR", status: "Rejected", slaDaysRemaining: 0, dateReceived: "2026-04-10" },
  { id: "req-007", phone: "+61491570156", type: "Erasure", status: "In Progress", slaDaysRemaining: -1, dateReceived: "2026-04-05" },
  { id: "req-008", phone: "+33612345678", type: "Rectification", status: "Fulfilled", slaDaysRemaining: 0, dateReceived: "2026-03-20" },
];

type RedactionRule = {
  id: string;
  patternName: string;
  matchesDetected: number;
  status: "Active" | "Inactive" | "Learning";
  confidence: number;
  lastFired: string;
};

const MOCK_REDACTIONS: RedactionRule[] = [
  { id: "red-01", patternName: "SSN (US)", matchesDetected: 14502, status: "Active", confidence: 99.8, lastFired: "2 mins ago" },
  { id: "red-02", patternName: "Credit Card (Global)", matchesDetected: 8234, status: "Active", confidence: 99.9, lastFired: "5 mins ago" },
  { id: "red-03", patternName: "IBAN", matchesDetected: 1024, status: "Active", confidence: 98.5, lastFired: "1 hour ago" },
  { id: "red-04", patternName: "Passport (EU)", matchesDetected: 42, status: "Learning", confidence: 85.0, lastFired: "2 days ago" },
  { id: "red-05", patternName: "Email Address", matchesDetected: 541092, status: "Active", confidence: 99.9, lastFired: "Just now" },
];

export default function GDPRPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  
  const [redactionSelectedIds, setRedactionSelectedIds] = useState<string[]>([]);
  const [redactionSearch, setRedactionSearch] = useState("");

  const [aiRedaction, setAiRedaction] = useState(true);
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [strictErasure, setStrictErasure] = useState(true);

  const columns: SabsmsColumn<RequestRow>[] = [
    {
      id: "phone",
      header: "Phone / Subject",
      render: (r) => <span className="font-medium font-mono text-sm">{r.phone}</span>,
    },
    {
      id: "type",
      header: "Type",
      render: (r) => (
        <Badge variant={r.type === "Erasure" ? "destructive" : r.type === "Rectification" ? "outline" : "default"}>
          {r.type}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (r) => {
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
        if (r.status === "Fulfilled") variant = "secondary";
        else if (r.status === "Rejected") variant = "destructive";
        else if (r.status === "In Progress") variant = "default";
        
        return <Badge variant={variant}>{r.status}</Badge>;
      },
    },
    {
      id: "sla",
      header: "SLA Timer",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {r.status === "Pending" || r.status === "In Progress" ? (
            r.slaDaysRemaining < 0 ? (
              <span className="text-zoru-ink font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Breached</span>
            ) : r.slaDaysRemaining < 5 ? (
              <span className="text-zoru-ink font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> {r.slaDaysRemaining} days</span>
            ) : (
              <span className="text-zoru-ink flex items-center gap-1"><Clock className="h-3 w-3" /> {r.slaDaysRemaining} days</span>
            )
          ) : (
            <span className="text-zoru-ink-muted">Resolved</span>
          )}
        </div>
      ),
    },
    {
      id: "date",
      header: "Received",
      render: (r) => <span className="text-zoru-ink">{r.dateReceived}</span>,
    },
  ];

  const redactionColumns: SabsmsColumn<RedactionRule>[] = [
    {
      id: "pattern",
      header: "Pattern Name",
      render: (r) => <span className="font-medium text-sm flex items-center gap-2"><EyeOff className="h-4 w-4 text-zoru-ink-muted" /> {r.patternName}</span>,
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={r.status === "Active" ? "secondary" : r.status === "Learning" ? "outline" : "destructive"}>
          {r.status}
        </Badge>
      ),
    },
    {
      id: "matches",
      header: "Matches Detected",
      render: (r) => <span className="text-zoru-ink">{r.matchesDetected.toLocaleString()}</span>,
    },
    {
      id: "confidence",
      header: "AI Confidence",
      render: (r) => (
        <span className={r.confidence > 99 ? "text-zoru-ink font-medium" : "text-zoru-ink"}>
          {r.confidence}%
        </span>
      ),
    },
    {
      id: "last",
      header: "Last Fired",
      render: (r) => <span className="text-zoru-ink text-sm">{r.lastFired}</span>,
    },
  ];

  const filteredRequests = MOCK_REQUESTS.filter((r) => {
    if (search && !r.phone.includes(search)) return false;
    if (filters.type?.length && !filters.type.includes(r.type)) return false;
    if (filters.status?.length && !filters.status.includes(r.status)) return false;
    return true;
  });

  const filteredRedactions = MOCK_REDACTIONS.filter((r) => {
    if (redactionSearch && !r.patternName.toLowerCase().includes(redactionSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <SabsmsPageShell
      title="GDPR & Privacy"
      eyebrow="Compliance"
      description="Manage Subject Access Requests, Erasure requests, auto-redaction rules, and Data Processing configuration."
      breadcrumbs={[{ label: "Compliance" }, { label: "GDPR" }]}
      helpTitle="GDPR Center"
      helpBody="Ensure compliance with GDPR, CCPA, and CPRA by responding to data subject requests within SLA. Phase 8 Roadmap includes automated DSR fulfillment."
      primaryAction={{
        label: "Export Consent Ledger",
        onClick: () => alert("Exporting ledger..."),
      }}
      secondaryActions={[
        {
          label: "Compliance Report PDF",
          icon: <Download className="h-4 w-4" />,
          onSelectAction: () => alert("Downloading report..."),
        },
        {
          label: "Phase 8 Roadmap",
          icon: <ExternalLink className="h-4 w-4" />,
          onSelectAction: () => alert("Navigating to Roadmap..."),
        },
      ]}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active SARs"
          value="12"
          delta={15.2}
          period="vs last month"
          icon={<FileText />}
          invertDelta
        />
        <StatCard
          label="SLA Breaches"
          value="1"
          delta={-100}
          period="vs last month"
          icon={<AlertTriangle />}
          invertDelta
        />
        <StatCard
          label="Auto-Redacted"
          value="564K"
          delta={5.4}
          period="vs last week"
          icon={<EyeOff />}
        />
        <StatCard
          label="Erasures Processed"
          value="89"
          delta={12.1}
          period="vs last month"
          icon={<Trash />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Data Subject Requests (DSR)</ZoruCardTitle>
              <ZoruCardDescription>
                Subject Access Requests (SAR), Rectification, and Erasure Inbox
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <SabsmsFilterBar
                searchValue={search}
                onSearchChange={setSearch}
                filters={[
                  {
                    id: "type",
                    label: "Type",
                    options: [
                      { label: "SAR", value: "SAR" },
                      { label: "Erasure", value: "Erasure" },
                      { label: "Rectification", value: "Rectification" },
                    ],
                  },
                  {
                    id: "status",
                    label: "Status",
                    options: [
                      { label: "Pending", value: "Pending" },
                      { label: "In Progress", value: "In Progress" },
                      { label: "Fulfilled", value: "Fulfilled" },
                      { label: "Rejected", value: "Rejected" },
                    ],
                  },
                ]}
                activeFilters={filters}
                onFilterChange={setFilters}
                onClearAll={() => setFilters({})}
              />
              <SabsmsDataTable
                rows={filteredRequests}
                columns={columns}
                rowKey={(r) => r.id}
                selectable
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                bulkActions={[
                  {
                    label: "Bulk Fulfill",
                    icon: <CheckCircle className="h-4 w-4" />,
                    onClick: (rows) => alert(`Fulfilling ${rows.length} requests`),
                  },
                  {
                    label: "Bulk Delete (Hash-preserving)",
                    icon: <Trash className="h-4 w-4" />,
                    destructive: true,
                    onClick: (rows) => alert(`Deleting ${rows.length} subjects`),
                  },
                ]}
                rowActions={[
                  {
                    label: "Mark In Progress",
                    icon: <Clock className="h-4 w-4" />,
                    onSelect: () => alert("Marked in progress"),
                  },
                  {
                    label: "Fulfill Request",
                    icon: <CheckCircle className="h-4 w-4" />,
                    onSelect: () => alert("Fulfilling request"),
                  },
                  {
                    label: "Execute Erasure",
                    icon: <Trash className="h-4 w-4" />,
                    destructive: true,
                    onSelect: () => alert("Hash-preserving erasure executed"),
                  },
                  {
                    label: "View Audit Trail",
                    icon: <Shield className="h-4 w-4" />,
                    onSelect: () => alert("Viewing audit trail"),
                  },
                ]}
                page={1}
                pageSize={5}
                total={filteredRequests.length}
              />
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader className="flex flex-row items-center justify-between">
              <div>
                <ZoruCardTitle>Auto-Redaction Rules</ZoruCardTitle>
                <ZoruCardDescription>
                  Real-time PII detection and redaction across SMS payloads.
                </ZoruCardDescription>
              </div>
              <Button variant="outline" size="sm">Add Rule</Button>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="mb-4">
                <Input
                  placeholder="Search rules..."
                  value={redactionSearch}
                  onChange={(e) => setRedactionSearch(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              <SabsmsDataTable
                rows={filteredRedactions}
                columns={redactionColumns}
                rowKey={(r) => r.id}
                selectable
                selectedIds={redactionSelectedIds}
                onSelectionChange={setRedactionSelectedIds}
                bulkActions={[
                  {
                    label: "Activate",
                    icon: <CheckCircle className="h-4 w-4" />,
                    onClick: () => alert("Rules activated"),
                  },
                  {
                    label: "Deactivate",
                    icon: <EyeOff className="h-4 w-4" />,
                    destructive: true,
                    onClick: () => alert("Rules deactivated"),
                  },
                ]}
                rowActions={[
                  {
                    label: "Edit Pattern",
                    icon: <Settings className="h-4 w-4" />,
                    onSelect: () => alert("Editing pattern"),
                  },
                  {
                    label: "View False Positives",
                    icon: <AlertTriangle className="h-4 w-4" />,
                    onSelect: () => alert("Viewing false positives"),
                  },
                ]}
                page={1}
                pageSize={5}
                total={filteredRedactions.length}
              />
            </ZoruCardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Data Processing</ZoruCardTitle>
              <ZoruCardDescription>Legal agreements and templates</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-zoru-ink">DPIA Template</span>
                <Button variant="outline" size="sm" className="h-8">
                  <Download className="h-3 w-3 mr-2" /> Download
                </Button>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-zoru-ink">Data Processing Addendum</span>
                <Button variant="outline" size="sm" className="h-8">
                  <FileText className="h-3 w-3 mr-2" /> DPA PDF
                </Button>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-zoru-ink">Sub-processor List</span>
                <Button variant="ghost" size="sm" className="h-8">View List</Button>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-zoru-ink">SCCs Config</span>
                <Button variant="ghost" size="sm" className="h-8">Configure</Button>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Settings & Policies</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Privacy Officer Assignment</Label>
                <Select defaultValue="alice">
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Select Officer" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="alice">Alice (DPO)</ZoruSelectItem>
                    <ZoruSelectItem value="bob">Bob (Legal)</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data Retention Policy (Days)</Label>
                <Input type="number" defaultValue={365} />
              </div>
              
              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AI PII Redaction</Label>
                  <div className="text-xs text-zoru-ink">
                    Redact PII before processing
                  </div>
                </div>
                <Switch checked={aiRedaction} onCheckedChange={setAiRedaction} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Strict Erasure</Label>
                  <div className="text-xs text-zoru-ink">
                    Irreversible cryptographic wiping
                  </div>
                </div>
                <Switch checked={strictErasure} onCheckedChange={setStrictErasure} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Webhook on Request</Label>
                  <div className="text-xs text-zoru-ink">
                    Fire hook when DSR received
                  </div>
                </div>
                <Switch checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <Button variant="link" className="px-0 text-sm h-auto justify-start">
                  <Settings className="h-3 w-3 mr-2" /> Required Reason Taxonomy
                </Button>
                <Button variant="link" className="px-0 text-sm h-auto justify-start">
                  <Users className="h-3 w-3 mr-2" /> Cookie & SDK Disclosures
                </Button>
                <Button variant="link" className="px-0 text-sm h-auto justify-start text-zoru-ink hover:text-zoru-ink">
                  <AlertTriangle className="h-3 w-3 mr-2" /> Breach Notification Protocol
                </Button>
              </div>
            </ZoruCardContent>
          </Card>
        </div>
      </div>
    </SabsmsPageShell>
  );
}
