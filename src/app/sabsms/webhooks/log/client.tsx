"use client";

import * as React from "react";
import { formatUTC } from "@/lib/utils";
import { Copy, FileJson, Play, RefreshCw, ServerCrash, Clock, AlertTriangle, Code2, TerminalSquare, Activity, ShieldCheck } from "lucide-react";

import {
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Badge,
  Button,
  ScrollArea,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardContent,
  useZoruToast,
  ZoruKbd,
  ZoruResizablePanelGroup,
  ZoruResizablePanel,
  ZoruResizableHandle,
  Input,
} from "@/components/zoruui";

import {
  useSabsmsUrlState,
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  type SabsmsColumn,
  type SabsmsFacet,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";
import { SabsmsBulkAction } from "@/components/sabsms/page-toolkit/sabsms-bulk-actions";
import { SabsmsSavedViews } from "@/components/sabsms/page-toolkit/sabsms-saved-views";

interface WebhookLogEntry {
  id: string;
  endpoint: string;
  event: string;
  status: "delivered" | "failed" | "DLQ";
  httpStatus: number;
  latencyMs: number;
  createdAt: string;
  attemptCount: number;
  sourceMessageId?: string;
  sourceConversationId?: string;
  sourceCampaignId?: string;
  payload: string;
  responseBody: string;
  headers: string;
  signature: string;
}

const MOCK_DATA: WebhookLogEntry[] = [
  {
    id: "whl_1abcde",
    endpoint: "https://api.example.com/webhooks/sabsms",
    event: "message.delivered",
    status: "delivered",
    httpStatus: 200,
    latencyMs: 145,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    attemptCount: 1,
    sourceMessageId: "msg_1234",
    sourceCampaignId: "cmp_999",
    payload: JSON.stringify({ event: "message.delivered", msg_id: "msg_1234" }, null, 2),
    responseBody: "OK",
    headers: "Content-Type: application/json\nUser-Agent: SabSMS-Webhook/1.0",
    signature: "v1=abcd1234efgh5678",
  },
  {
    id: "whl_2fghij",
    endpoint: "https://api.example.com/webhooks/sabsms",
    event: "message.failed",
    status: "failed",
    httpStatus: 503,
    latencyMs: 3000,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    attemptCount: 3,
    sourceMessageId: "msg_5678",
    sourceConversationId: "conv_111",
    payload: JSON.stringify({ event: "message.failed", msg_id: "msg_5678", error: "Carrier rejected" }, null, 2),
    responseBody: '{"error": "Service Unavailable"}',
    headers: "Content-Type: application/json\nUser-Agent: SabSMS-Webhook/1.0",
    signature: "v1=ijkl9012mnop3456",
  },
  {
    id: "whl_3klmno",
    endpoint: "https://backup.example.com/dlq",
    event: "campaign.completed",
    status: "DLQ",
    httpStatus: 404,
    latencyMs: 45,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    attemptCount: 8,
    sourceCampaignId: "cmp_777",
    payload: JSON.stringify({ event: "campaign.completed", cmp_id: "cmp_777" }, null, 2),
    responseBody: "Not Found",
    headers: "Content-Type: application/json\nUser-Agent: SabSMS-Webhook/1.0",
    signature: "v1=qrst7890uvwx1234",
  },
  {
    id: "whl_4pqrst",
    endpoint: "https://api.example.com/webhooks/sabsms",
    event: "message.received",
    status: "delivered",
    httpStatus: 201,
    latencyMs: 80,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    attemptCount: 1,
    sourceMessageId: "msg_9012",
    sourceConversationId: "conv_222",
    payload: JSON.stringify({ event: "message.received", msg_id: "msg_9012", text: "Yes" }, null, 2),
    responseBody: '{"success": true}',
    headers: "Content-Type: application/json\nUser-Agent: SabSMS-Webhook/1.0",
    signature: "v1=yzab5678cdef9012",
  },
  {
    id: "whl_5oldentry",
    endpoint: "https://api.example.com/webhooks/sabsms",
    event: "message.delivered",
    status: "delivered",
    httpStatus: 200,
    latencyMs: 120,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(), // 8 days ago
    attemptCount: 1,
    sourceMessageId: "msg_old",
    sourceCampaignId: "cmp_old",
    payload: JSON.stringify({ event: "message.delivered", msg_id: "msg_old" }, null, 2),
    responseBody: "OK",
    headers: "Content-Type: application/json\nUser-Agent: SabSMS-Webhook/1.0",
    signature: "v1=abcd1234efgh5678",
  },
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_MOCK_DATA = MOCK_DATA.filter(row => {
  return (Date.now() - new Date(row.createdAt).getTime()) < SEVEN_DAYS_MS;
});

const FACETS: any[] = [
  {
    key: "status",
    label: "Status",
    multi: true,
    options: [
      { value: "delivered", label: "Delivered" },
      { value: "failed", label: "Failed" },
      { value: "DLQ", label: "DLQ" },
    ],
  },
  {
    key: "event",
    label: "Event",
    multi: true,
    options: [
      { value: "message.delivered", label: "message.delivered" },
      { value: "message.failed", label: "message.failed" },
      { value: "message.received", label: "message.received" },
      { value: "campaign.completed", label: "campaign.completed" },
    ],
  },
  {
    key: "endpoint",
    label: "Endpoint",
    multi: true,
    options: [
      { value: "https://api.example.com/webhooks/sabsms", label: "api.example.com" },
      { value: "https://backup.example.com/dlq", label: "backup.example.com" },
    ],
  },
];

const syntaxHighlight = (jsonStr: string) => {
  try {
    const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    const formatted = JSON.stringify(obj, null, 2);
    return formatted.replace(/("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g, function (match) {
      let cls = 'text-[var(--st-text-secondary)]';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-[var(--st-text-secondary)]'; // Key
        } else {
          cls = 'text-[var(--st-text-secondary)]'; // String
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-[var(--st-text-secondary)]'; // Boolean
      } else if (/null/.test(match)) {
        cls = 'text-[var(--st-text-secondary)]'; // Null
      } else {
        cls = 'text-[var(--st-text-secondary)]'; // Number
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  } catch (e) {
    return jsonStr;
  }
};

export default function WebhookLogClient() {
  const urlState = useSabsmsUrlState();
  const { toast } = useZoruToast();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(25);
  const [selectedRow, setSelectedRow] = React.useState<WebhookLogEntry | null>(null);

  const [msgIdInput, setMsgIdInput] = React.useState(urlState.get("msgId") || "");

  React.useEffect(() => {
    const handle = setTimeout(() => {
      urlState.setOne("msgId", msgIdInput || null);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgIdInput]);

  const query = urlState.get("q") || "";
  const statuses = urlState.getAll("status");
  const events = urlState.getAll("event");
  const endpoints = urlState.getAll("endpoint");
  
  const msgIdQuery = urlState.get("msgId") || "";
  
  const filteredData = React.useMemo(() => {
    return ACTIVE_MOCK_DATA.filter((row) => {
      if (statuses.length > 0 && !statuses.includes(row.status)) return false;
      if (events.length > 0 && !events.includes(row.event)) return false;
      if (endpoints.length > 0 && !endpoints.includes(row.endpoint)) return false;
      
      if (msgIdQuery) {
        if (!row.sourceMessageId || !row.sourceMessageId.toLowerCase().includes(msgIdQuery.toLowerCase())) {
          return false;
        }
      }
      
      if (query) {
        const q = query.toLowerCase();
        return (
          row.id.toLowerCase().includes(q) ||
          row.payload.toLowerCase().includes(q) ||
          (row.sourceConversationId && row.sourceConversationId.toLowerCase().includes(q)) ||
          (row.sourceCampaignId && row.sourceCampaignId.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [statuses, events, endpoints, query, msgIdQuery]);

  const pagedData = filteredData.slice(page * pageSize, (page + 1) * pageSize);

  const columns: SabsmsColumn<WebhookLogEntry>[] = [
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <Badge
          variant={
            r.status === "delivered" ? "default" : r.status === "failed" ? "destructive" : "secondary"
          }
        >
          {r.status}
        </Badge>
      ),
    },
    {
      id: "event",
      header: "Event",
      render: (r) => <span className="font-mono text-xs">{r.event}</span>,
    },
    {
      id: "endpoint",
      header: "Endpoint",
      render: (r) => (
        <span className="truncate max-w-[150px] inline-block" title={r.endpoint}>
          {r.endpoint}
        </span>
      ),
    },
    {
      id: "httpStatus",
      header: "HTTP",
      render: (r) => (
        <span className={`font-mono text-xs ${r.httpStatus >= 400 ? "text-[var(--st-text)]" : "text-[var(--st-text)]"}`}>
          {r.httpStatus}
        </span>
      ),
      align: "right",
    },
    {
      id: "latency",
      header: "Latency",
      render: (r) => <span className="text-xs text-[var(--st-text)]">{r.latencyMs} ms</span>,
      align: "right",
    },
    {
      id: "createdAt",
      header: "Timestamp",
      render: (r) => (
        <span className="text-xs text-[var(--st-text)]">
          {formatUTC(r.createdAt, true)}
        </span>
      ),
    },
  ];

  const handleReplay = (row: WebhookLogEntry) => {
    toast({
      title: "Delivery replayed",
      description: `Replay queued for ${row.id}. Audit log updated.`,
    });
  };

  const rowActions: SabsmsRowAction<WebhookLogEntry>[] = [
    {
      label: "View details",
      icon: <FileJson className="h-4 w-4" />,
      onSelect: (r) => setSelectedRow(r),
    },
    {
      label: "Replay delivery",
      icon: <RefreshCw className="h-4 w-4" />,
      onSelect: handleReplay,
    },
  ];

  const bulkActions: SabsmsBulkAction<WebhookLogEntry>[] = [
    {
      label: "Replay failed",
      icon: <RefreshCw className="h-4 w-4" />,
      onSelect: (rows) => {
        const failedCount = rows.filter(r => r.status !== "delivered").length;
        toast({
          title: "Bulk replay initiated",
          description: `Queued ${failedCount} failed webhooks for replay.`,
        });
        setSelectedIds([]);
      },
    },
  ];

  const handleExport = () => {
    toast({ title: "Export started", description: "Batch JSONL export is downloading..." });
  };

  const activeFacets = React.useMemo(() => {
    const acc: Record<string, string[]> = {};
    if (statuses.length) acc.status = statuses;
    if (events.length) acc.event = events;
    if (endpoints.length) acc.endpoint = endpoints;
    return acc;
  }, [statuses, events, endpoints]);

  return (
    <SabsmsPageShell
      title="Webhook Delivery Log"
      description="Inspect, replay, and monitor webhook delivery attempts across endpoints."
      breadcrumbs={[{ label: "Webhooks", href: "/sabsms/webhooks" }, { label: "Log" }]}
      helpTitle="Delivery Logs"
      helpBody="Every webhook attempt is logged here. Failed deliveries are automatically retried via exponential backoff before landing in the DLQ."
      secondaryActions={[
        { label: "Export JSONL", icon: <FileJson className="h-4 w-4" />, onSelectAction: handleExport },
        { label: "Share View URL", icon: <Copy className="h-4 w-4" />, onSelectAction: () => {
          navigator.clipboard.writeText(window.location.href);
          toast({ title: "URL copied", description: "Filters saved to clipboard." });
        }},
      ]}
      toolbar={
        <div className="flex gap-2">
          <SabsmsSavedViews
            views={[{ id: "v1", name: "Failed Deliveries", filters: { status: ["failed", "DLQ"] } }]}
            activeViewId={statuses.includes("failed") && statuses.includes("DLQ") ? "v1" : undefined}
            onSelectView={(v) => {
              urlState.clear();
              urlState.set(v.filters);
            }}
            onSaveCurrent={() => {}}
            onDeleteView={() => {}}
          />
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
         <Card className="border-[var(--st-border)]/60 shadow-sm">
            <ZoruCardHeader className="pb-2">
              <ZoruCardTitle className="text-sm font-medium text-[var(--st-text)] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--st-text)]"/> HTTP Status Codes
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="flex items-end gap-2 h-20">
               <div className="bg-[var(--st-text)] w-1/3 rounded-t-sm transition-all hover:opacity-80" style={{ height: "80%" }} title="2xx: 80%" />
               <div className="bg-[var(--st-text)] w-1/3 rounded-t-sm transition-all hover:opacity-80" style={{ height: "10%" }} title="4xx: 10%" />
               <div className="bg-[var(--st-text)] w-1/3 rounded-t-sm transition-all hover:opacity-80" style={{ height: "30%" }} title="5xx: 30%" />
            </ZoruCardContent>
         </Card>
         <Card className="border-[var(--st-border)]/60 shadow-sm">
            <ZoruCardHeader className="pb-2">
              <ZoruCardTitle className="text-sm font-medium text-[var(--st-text)] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--st-text)]"/> Latency Overview (ms)
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="flex items-center gap-6 h-20">
               <div className="flex flex-col">
                 <span className="text-3xl font-bold font-mono tracking-tight text-[var(--st-text)]">145</span>
                 <span className="text-xs text-[var(--st-text)] font-medium">P50</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-3xl font-bold font-mono tracking-tight text-[var(--st-text)]">420</span>
                 <span className="text-xs text-[var(--st-text)] font-medium">P95</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-3xl font-bold font-mono tracking-tight text-[var(--st-text)]">3k</span>
                 <span className="text-xs text-[var(--st-text)] font-medium">Max</span>
               </div>
            </ZoruCardContent>
         </Card>
         <Card className="bg-[var(--st-text)] text-white border-[var(--st-border)] shadow-md">
            <ZoruCardHeader className="pb-2">
              <ZoruCardTitle className="text-sm font-medium text-[var(--st-text-secondary)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--st-text-secondary)]"/> Webhook Health
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="flex flex-col justify-center h-20">
               <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-bold text-[var(--st-text-secondary)] tracking-tighter">98.4%</span>
                 <span className="text-sm text-[var(--st-text-secondary)] font-medium">Success Rate</span>
               </div>
               <div className="text-xs text-[var(--st-text)] mt-1">Last 24 hours • 1.2M deliveries</div>
            </ZoruCardContent>
         </Card>
      </div>

      <div className="space-y-4">
        <Alert className="bg-[var(--st-bg-muted)] border-[var(--st-border)] text-[var(--st-text)]">
          <AlertTriangle className="h-4 w-4 !text-[var(--st-text)]" />
          <ZoruAlertTitle className="text-[var(--st-text)]">Aggressive Retention Policy Active</ZoruAlertTitle>
          <ZoruAlertDescription className="text-[var(--st-text)]">
            Due to high volume, webhook logs are automatically purged after 7 days. Older logs are permanently deleted and cannot be recovered or replayed.
          </ZoruAlertDescription>
        </Alert>

        <SabsmsFilterBar
          searchKey="q"
          searchPlaceholder="Search logs..."
          facets={FACETS}
          trailing={
            <div className="flex items-center gap-2 mr-4 border-r pr-4 border-[var(--st-border)]">
               <span className="text-sm font-medium text-[var(--st-text)]">Msg ID:</span>
               <Input 
                 value={msgIdInput} 
                 onChange={(e) => setMsgIdInput(e.target.value)} 
                 placeholder="msg_..." 
                 className="h-8 w-[150px]" 
               />
            </div>
          }
        />
        
        <Card className="border shadow-sm overflow-hidden flex flex-col h-[600px] xl:h-[800px]">
          <ZoruResizablePanelGroup direction="horizontal" className="flex-1 w-full h-full">
            <ZoruResizablePanel defaultSize={55} minSize={30} className="h-full flex flex-col bg-white">
               <div className="flex-1 overflow-hidden p-2">
                   <SabsmsDataTable
                     columns={columns}
                     rows={pagedData}
                     rowKey={(r) => r.id}
                     total={filteredData.length}
                     page={page}
                     pageSize={pageSize}
                     onPageChange={setPage}
                     onPageSizeChange={setPageSize}
                     selectable
                     selectedIds={selectedIds}
                     onSelectionChange={setSelectedIds}
                     bulkActions={bulkActions}
                     rowActions={rowActions}
                     onRowClick={setSelectedRow}
                   />
               </div>
            </ZoruResizablePanel>

            <ZoruResizableHandle withHandle />

            <ZoruResizablePanel defaultSize={45} minSize={25} className="h-full bg-[var(--st-bg-muted)] flex flex-col border-l">
              {selectedRow ? (
                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-8">
                    {/* Header */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant={selectedRow.status === "delivered" ? "default" : selectedRow.status === "failed" ? "destructive" : "secondary"} className="text-sm px-3 py-1 font-medium shadow-sm">
                          {selectedRow.status.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-mono text-[var(--st-text)] bg-[var(--st-bg-muted)]/50 px-2 py-1 rounded-md">{formatUTC(selectedRow.createdAt, true)}</span>
                      </div>
                      <h2 className="text-2xl font-bold font-mono tracking-tight mb-2 text-[var(--st-text)]">{selectedRow.event}</h2>
                      <p className="text-sm text-[var(--st-text)] font-mono break-all flex items-center gap-2">
                         <TerminalSquare className="w-4 h-4" /> {selectedRow.id}
                      </p>
                    </div>

                    {/* Grid Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-xl border shadow-sm">
                        <p className="text-xs text-[var(--st-text)] font-bold mb-1 uppercase tracking-wider">HTTP Status</p>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-3xl font-bold font-mono ${selectedRow.httpStatus >= 400 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}`}>{selectedRow.httpStatus}</span>
                          <span className="text-sm text-[var(--st-text)] font-medium">{selectedRow.httpStatus >= 400 ? 'Error' : 'OK'}</span>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border shadow-sm">
                        <p className="text-xs text-[var(--st-text)] font-bold mb-1 uppercase tracking-wider">Latency</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold font-mono text-[var(--st-text)]">{selectedRow.latencyMs}</span>
                          <span className="text-sm text-[var(--st-text)] font-medium">ms</span>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border shadow-sm col-span-2">
                        <p className="text-xs text-[var(--st-text)] font-bold mb-1 uppercase tracking-wider">Endpoint</p>
                        <span className="text-sm font-mono break-all text-[var(--st-text)]">{selectedRow.endpoint}</span>
                      </div>
                    </div>

                    {/* Raw Request JSON */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--st-text)] flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-[var(--st-text)]" /> Request Payload
                        </h3>
                        <Button variant="outline" size="sm" onClick={() => {
                          navigator.clipboard.writeText(selectedRow.payload);
                          toast({ title: "Copied payload", description: "JSON copied to clipboard." });
                        }} className="h-8 shadow-sm">
                          <Copy className="h-3 w-3 mr-2" /> Copy JSON
                        </Button>
                      </div>
                      <div className="bg-[var(--st-text)] rounded-xl border border-[var(--st-border)] overflow-hidden shadow-xl">
                        <div className="flex items-center px-4 py-2.5 bg-[var(--st-text)] border-b border-[var(--st-border)]">
                           <div className="flex gap-1.5">
                             <div className="w-3 h-3 rounded-full bg-[var(--st-text)]/80"></div>
                             <div className="w-3 h-3 rounded-full bg-[var(--st-text)]/80"></div>
                             <div className="w-3 h-3 rounded-full bg-[var(--st-text)]/80"></div>
                           </div>
                           <span className="ml-4 text-xs font-mono text-[var(--st-text-secondary)]">payload.json</span>
                        </div>
                        <div className="p-4 overflow-x-auto">
                          <pre className="text-[13px] font-mono leading-relaxed">
                            <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(selectedRow.payload) }} />
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Signature */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--st-text)] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[var(--st-text)]" /> Signature
                      </h3>
                      <div className="bg-white rounded-xl border shadow-sm overflow-hidden p-4 flex items-center justify-between">
                         <ZoruKbd className="text-xs bg-[var(--st-bg-muted)]">{selectedRow.signature}</ZoruKbd>
                         <Button variant="ghost" size="sm" className="text-[var(--st-text)]" onClick={() => toast({ title: "Signature verified", description: "Matches workspace secret."})}>Verify</Button>
                      </div>
                    </div>

                    {/* Response Details */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--st-text)] flex items-center gap-2">
                        <ServerCrash className="w-4 h-4 text-[var(--st-text)]" /> Response Data
                      </h3>
                      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="p-4 border-b bg-[var(--st-bg-muted)]/50">
                          <p className="text-xs font-bold text-[var(--st-text)] mb-2 uppercase tracking-wider">Headers</p>
                          <pre className="text-xs font-mono text-[var(--st-text)] whitespace-pre-wrap leading-relaxed">{selectedRow.headers}</pre>
                        </div>
                        <div className="p-4">
                          <p className="text-xs font-bold text-[var(--st-text)] mb-2 uppercase tracking-wider">Body</p>
                          <pre className="text-xs font-mono text-[var(--st-text)] bg-[var(--st-bg-muted)]/50 p-3 rounded-md border whitespace-pre-wrap break-all leading-relaxed">{selectedRow.responseBody}</pre>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end pt-6 border-t mt-8">
                       <Button 
                         size="lg" 
                         onClick={() => handleReplay(selectedRow)} 
                         disabled={selectedRow.status === "delivered"}
                         className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white font-medium shadow-md shadow-zoru-line disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         <RefreshCw className="w-4 h-4 mr-2" />
                         Replay Delivery Attempt
                       </Button>
                    </div>

                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-[var(--st-text-secondary)] p-6 text-center">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border mb-4 flex items-center justify-center">
                    <ServerCrash className="w-12 h-12 text-[var(--st-text-secondary)]" />
                  </div>
                  <h3 className="text-lg font-medium text-[var(--st-text)]">No Webhook Selected</h3>
                  <p className="text-sm mt-2 max-w-[250px] leading-relaxed">Select a delivery attempt from the table to view its raw request payload, headers, and response data.</p>
                </div>
              )}
            </ZoruResizablePanel>
          </ZoruResizablePanelGroup>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}
