"use client";

import * as React from "react";
import { 

  Key, 
  Plus, 
  RefreshCw, 
  XCircle, 
  History, 
  Download, 
  Terminal, 
  Activity, 
  AlertTriangle, 
  UserCog, 
  Calendar,
  Code,
  Copy,
  Check,
  Shield,
  Eye,
  EyeOff,
  Clock,
  Server
} from "lucide-react";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { SabsmsFilterBar, type SabsmsSortOption } from "@/components/sabsms/page-toolkit/sabsms-filter-bar";
import { SabsmsDataTable, type SabsmsColumn } from "@/components/sabsms/page-toolkit/sabsms-data-table";
import { SabsmsDetailDrawer } from "@/components/sabsms/page-toolkit/sabsms-detail-drawer";
import { useSabsmsUrlState } from "@/components/sabsms/page-toolkit/use-sabsms-url-state";
import { SabsmsSavedViews } from "@/components/sabsms/page-toolkit/sabsms-saved-views";
import { SabsmsPagination } from "@/components/sabsms/page-toolkit/sabsms-pagination";
import { SabsmsRefreshButton } from "@/components/sabsms/page-toolkit/sabsms-refresh-button";
import { SabsmsExportMenu, rowsToCsv } from "@/components/sabsms/page-toolkit/sabsms-export-menu";
import { SabsmsColumnPicker } from "@/components/sabsms/page-toolkit/sabsms-column-picker";
import { SabsmsKbdHint } from "@/components/sabsms/page-toolkit/sabsms-kbd-hint";

import { Badge, Button, Switch, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardFooter } from "@/components/zoruui";

import { getApiKeys, getExecutionLogs, createApiKey, updateApiKey, revokeApiKey, type SabsmsApiKey, type SabsmsExecutionLog } from "./actions";

const SAVED_VIEWS = [
  { id: "v1", name: "Active Keys", filters: { status: ["active"] } },
  { id: "v2", name: "Send-Only", filters: { scopes: ["send-only"] } },
];


const SORT_OPTIONS: SabsmsSortOption[] = [
  { id: "name_asc", label: "Name (A-Z)", field: "name", direction: "asc" },
  { id: "lastUsedAt_desc", label: "Last Used (Newest)", field: "lastUsedAt", direction: "desc" },
  { id: "expiry_asc", label: "Expiry Date", field: "expiryDate", direction: "asc" },
];

const SCOPE_COLORS: Record<string, string> = {
  "read-only": "bg-zoru-surface-2 text-zoru-ink border-zoru-line",
  "send-only": "bg-zoru-surface-2 text-zoru-ink border-zoru-line",
  "admin": "bg-zoru-surface-2 text-zoru-ink border-zoru-line",
  "full": "bg-zoru-surface-2 text-zoru-ink border-zoru-line",
};

function CopyableKeyDisplay({ keyValue }: { keyValue: string }) {
  const [copied, setCopied] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(keyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const masked = keyValue.substring(0, 8) + "••••••••••••••••";

  return (
    <div className="flex items-center justify-between gap-1.5 bg-zoru-surface-2 border border-zoru-line rounded-md px-2 py-1 w-[220px]">
      <span className="font-mono text-xs text-zoru-ink truncate">
        {revealed ? keyValue : masked}
      </span>
      <div className="flex items-center gap-0.5 border-l border-zoru-line pl-1.5 ml-1 shrink-0">
        <button 
          onClick={(e) => { e.stopPropagation(); setRevealed(!revealed); }}
          className="p-1 hover:bg-zoru-surface-2 rounded text-zoru-ink-muted hover:text-zoru-ink transition-colors"
          title={revealed ? "Hide key" : "Reveal key"}
        >
          {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <button 
          onClick={handleCopy}
          className="p-1 hover:bg-zoru-surface-2 rounded text-zoru-ink-muted hover:text-zoru-ink transition-colors"
          title="Copy key"
        >
          {copied ? <Check className="h-3 w-3 text-zoru-ink" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

function ApiKeysPageContent() {
  const urlState = useSabsmsUrlState();

  const [selectedKeyId, setSelectedKeyId] = React.useState<string | null>(null);
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());
  
  const [keys, setKeys] = React.useState<SabsmsApiKey[]>([]);
  const [logs, setLogs] = React.useState<SabsmsExecutionLog[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const [fetchedKeys, fetchedLogs] = await Promise.all([
      getApiKeys(),
      getExecutionLogs()
    ]);
    setKeys(fetchedKeys);
    setLogs(fetchedLogs);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    await createApiKey({ name: "New Key" });
    fetchData();
    setSelectedKeyId(null);
  };

  const handleRevoke = async (id: string) => {
    await revokeApiKey(id);
    fetchData();
  };

  const columns: SabsmsColumn<SabsmsApiKey>[] = [
    {
      id: "name",
      header: "Key Name",
      render: (row) => (
        <div>
          <div className="font-semibold text-zoru-ink flex items-center gap-2">
            <Key className="h-3.5 w-3.5 text-zoru-ink-muted" />
            {row.name}
          </div>
          <div className="text-xs text-zoru-ink mt-1.5 flex gap-1.5 flex-wrap">
            {row.scopes.map(s => (
              <Badge key={s} variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ${SCOPE_COLORS[s] || "bg-zoru-surface-2 text-zoru-ink border-zoru-line"}`}>
                {s}
              </Badge>
            ))}
            {row.isWebhookOnly && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium text-zoru-ink border-zoru-line bg-zoru-surface-2">webhook-only</Badge>}
          </div>
        </div>
      )
    },
    {
      id: "keyValue",
      header: "API Key",
      render: (row) => <CopyableKeyDisplay keyValue={row.keyValue} />
    },
    {
      id: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={row.status === "active" ? "default" : "destructive"} className="shadow-sm">
          {row.status === "active" ? "Active" : "Revoked"}
        </Badge>
      )
    },
    {
      id: "lastUsed",
      header: "Last Used",
      render: (row) => (
        <div className="text-sm">
          <div className="font-medium text-zoru-ink flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-zoru-ink-muted" />
            {row.lastUsedAt !== "Never" ? new Date(row.lastUsedAt).toLocaleDateString() : "Never"}
          </div>
          <div className="text-xs text-zoru-ink mt-0.5">IP: {row.lastUsedIp}</div>
        </div>
      )
    },
    {
      id: "security",
      header: "Security",
      render: (row) => (
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-zoru-ink-muted" />
            <span className="text-zoru-ink truncate max-w-[120px]">{row.ipAllowlist.join(", ")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <UserCog className="h-3 w-3 text-zoru-ink-muted" />
            <span className="text-zoru-ink truncate max-w-[120px]">{row.owner}</span>
          </div>
        </div>
      )
    },
    {
      id: "limits",
      header: "Limits & Expiry",
      render: (row) => (
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-zoru-ink-muted" />
            <span className="text-zoru-ink">{row.rateLimit}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-zoru-ink-muted" />
            <span className="text-zoru-ink">{row.expiryDate}</span>
          </div>
        </div>
      )
    }
  ];

  const columnDefs = columns.map(c => ({ id: c.id, label: typeof c.header === "string" ? c.header : c.id }));
  const [visibleCols, setVisibleCols] = React.useState(columns.map(c => c.id));
  const [density, setDensity] = React.useState<"compact" | "comfortable" | "cosy">("comfortable");

  return (
    <SabsmsPageShell
      title="API Keys"
      eyebrow="Developer"
      description="Manage API keys, scopes, IP whitelists, and monitor execution logs securely."
      breadcrumbs={[{ label: "Developer" }, { label: "API Keys" }]}
      primaryAction={{ label: "Create API Key", onClick: () => setSelectedKeyId("new"), icon: <Plus className="h-4 w-4" /> }}
      secondaryActions={[
        { label: "Postman Collection", icon: <Download className="h-4 w-4" /> },
        { label: "Audit Log", icon: <History className="h-4 w-4" /> },
      ]}
      helpTitle="About API Keys"
      helpBody="API keys authenticate your requests to the SabSMS engine. Use scopes and IP allowlists to limit their access. Keys should be rotated periodically."
      toolbar={
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <SabsmsFilterBar
            searchPlaceholder="Search keys..."
            sortOptions={SORT_OPTIONS}
            defaultSort="name_asc"
            facets={[
              {
                key: "status",
                label: "Status",
                options: [
                  { label: "Active", value: "active" },
                  { label: "Revoked", value: "revoked" }
                ],
                multi: true
              },
              {
                key: "scopes",
                label: "Scopes",
                options: [
                  { label: "Read-Only", value: "read-only" },
                  { label: "Send-Only", value: "send-only" },
                  { label: "Full", value: "full" },
                  { label: "Admin", value: "admin" }
                ],
                multi: true
              }
            ]}
          />
          <SabsmsSavedViews scope="api-keys" />
          <SabsmsColumnPicker
            columns={columnDefs}
            visible={visibleCols}
            onChange={setVisibleCols}
          />
          <SabsmsExportMenu
            onExportCsv={() => console.log(rowsToCsv(keys, columns))}
            onExportExcel={() => {}}
            onExportJson={() => {}}
          />
          <SabsmsRefreshButton 
            isRefreshing={loading}
            onRefresh={fetchData}
          />
        </div>
      }
    >
      <SabsmsKbdHint
        shortcuts={[
          { key: "c", description: "Create new key" },
          { key: "/", description: "Search keys" },
          { key: "?", description: "Show keyboard shortcuts" }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 space-y-6">
          <Card className="shadow-sm border-zoru-line overflow-hidden">
            <SabsmsDataTable
              columns={columns}
              visibleColumnIds={visibleCols}
              density={density}
              selectable
              rowKey={(r) => r.id}
              selectedIds={Array.from(selectedRows)}
              onSelectionChange={(ids) => setSelectedRows(new Set(ids))}
              bulkActions={[
                { label: "Bulk Rotate", onSelect: () => {} },
                { label: "Revoke Selected", onSelect: () => {}, destructive: true }
              ]}
              rows={keys}
              onRowClick={(row) => setSelectedKeyId(row.id)}
              rowActions={[
                { label: "Edit Settings", onSelect: (r) => setSelectedKeyId(r.id) },
                { label: "Rotate Key", onSelect: () => {} },
                { label: "Generate CLI Snippet", onSelect: () => {} },
                { label: "View Audit Trail", onSelect: () => {} },
                { label: "Revoke Key", onSelect: (r) => handleRevoke(r.id), destructive: true }
              ]}
            />
            <div className="p-4 border-t border-zoru-line flex justify-between items-center bg-zoru-surface-2/50">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zoru-ink">Density:</span>
                  <select 
                    className="text-xs border-zoru-line rounded p-1.5 bg-white shadow-sm"
                    value={density}
                    onChange={(e) => setDensity(e.target.value as any)}
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="cosy">Cosy</option>
                  </select>
                </div>
              </div>
              <SabsmsPagination
                page={parseInt(urlState.get("page") || "0", 10)}
                pageSize={parseInt(urlState.get("pageSize") || "25", 10)}
                total={4}
                onPageChange={(p) => urlState.setOne("page", p)}
                onPageSizeChange={(s) => urlState.setOne("pageSize", s)}
              />
            </div>
          </Card>

          <Card className="shadow-sm border-zoru-line">
            <ZoruCardHeader className="bg-zoru-surface-2/80 border-b border-zoru-line py-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <ZoruCardTitle className="text-base font-semibold flex items-center gap-2 text-zoru-ink">
                    <Server className="h-4 w-4 text-zoru-ink" /> Recent Executions
                  </ZoruCardTitle>
                  <ZoruCardDescription className="text-xs mt-1">Real-time view of API requests made across all your keys.</ZoruCardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs shadow-sm">View Full Logs</Button>
              </div>
            </ZoruCardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-zoru-ink bg-white border-b border-zoru-line">
                  <tr>
                    <th className="px-5 py-3 font-medium">Timestamp</th>
                    <th className="px-5 py-3 font-medium">Endpoint</th>
                    <th className="px-5 py-3 font-medium">Key Used</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zoru-line">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-zoru-surface-2/50 transition-colors group">
                      <td className="px-5 py-3 font-mono text-xs text-zoru-ink">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="px-5 py-3 font-mono text-xs text-zoru-ink font-medium group-hover:text-zoru-ink transition-colors">{log.endpoint}</td>
                      <td className="px-5 py-3 text-zoru-ink text-xs flex items-center gap-1.5"><Key className="h-3 w-3 text-zoru-ink-muted" /> {log.keyName}</td>
                      <td className="px-5 py-3">
                        <Badge variant={log.status === 200 ? "outline" : "destructive"} className={log.status === 200 ? "bg-zoru-surface-2 text-zoru-ink border-zoru-line text-[10px] px-2 py-0.5" : "text-[10px] px-2 py-0.5"}>
                          {log.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-zoru-ink text-xs">{log.latency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-zoru-line">
            <ZoruCardHeader className="bg-zoru-surface-2/80 border-b border-zoru-line py-4 px-5">
              <ZoruCardTitle className="text-sm font-semibold flex items-center gap-2">
                <Terminal className="h-4 w-4 text-zoru-ink" /> CLI Tools
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4 p-5">
              <div className="text-sm text-zoru-ink">Generate CLI snippets or configure your local environment instantly.</div>
              <Button variant="outline" className="w-full shadow-sm text-xs font-medium">Generate Configuration</Button>
            </ZoruCardContent>
          </Card>
        </div>
      </div>

      <SabsmsDetailDrawer
        open={selectedKeyId !== null}
        onOpenChange={(open) => { if (!open) setSelectedKeyId(null); }}
        title={selectedKeyId === "new" ? "Create API Key" : "Edit API Key"}
        description={selectedKeyId === "new" ? "Create a new API key with specific scopes." : "Manage key settings, rate limits, and view usage."}
        footer={
          <div className="flex gap-2 justify-end w-full border-t border-zoru-line pt-4">
            <Button variant="outline" onClick={() => setSelectedKeyId(null)}>Cancel</Button>
            <Button onClick={selectedKeyId === "new" ? handleCreate : () => setSelectedKeyId(null)} className="shadow-sm">{selectedKeyId === "new" ? "Create Key" : "Save Changes"}</Button>
          </div>
        }
      >
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            {selectedKeyId !== "new" && (
              <div className="p-4 bg-zoru-surface-2 border border-zoru-line rounded-lg flex flex-col gap-2">
                <span className="text-xs font-medium text-zoru-ink uppercase tracking-wider">Secret Key</span>
                <CopyableKeyDisplay keyValue={keys.find(k => k.id === selectedKeyId)?.keyValue || ""} />
                <p className="text-[10px] text-zoru-ink-muted mt-1">This key grants access based on its assigned scopes. Keep it secure.</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-zoru-ink">Key Name</label>
              <input type="text" className="flex h-10 w-full rounded-md border border-zoru-line bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-zoru-line focus:border-transparent mt-1.5" defaultValue={selectedKeyId !== "new" ? keys.find(k => k.id === selectedKeyId)?.name : ""} placeholder="e.g. Production Webhook Integration" />
            </div>
            
            <div className="pt-5 border-t border-zoru-line">
              <h4 className="text-sm font-semibold text-zoru-ink mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-zoru-ink-muted" /> Scopes & Permissions</h4>
              <div className="space-y-3">
                <select className="flex h-10 w-full rounded-md border border-zoru-line bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zoru-line focus:border-transparent">
                  <option value="read-only">Read-Only</option>
                  <option value="send-only">Send-Only</option>
                  <option value="full">Full Access</option>
                  <option value="admin">Admin</option>
                </select>

                <div className="flex items-center gap-3 mt-4 p-3 border border-zoru-line rounded-md bg-zoru-surface-2/50">
                  <Switch id="webhook-only" checked={selectedKeyId !== "new" ? keys.find(k => k.id === selectedKeyId)?.isWebhookOnly : false} onCheckedChange={() => {}} />
                  <div className="flex flex-col">
                    <label htmlFor="webhook-only" className="text-sm font-medium text-zoru-ink">Restrict to webhooks only</label>
                    <span className="text-xs text-zoru-ink">Key will only be valid for webhook subscriptions.</span>
                  </div>
                </div>
              </div>

              {selectedKeyId !== "new" && (
                <div className="mt-4 p-3 bg-zoru-surface-2 rounded-md border border-zoru-line">
                  <div className="flex items-center gap-2 text-sm font-medium text-zoru-ink mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Permission Diff vs Role
                  </div>
                  <p className="text-xs text-zoru-ink/80">This key has fewer privileges than your user account (missing: billing_write, team_write).</p>
                </div>
              )}
            </div>

            <div className="pt-5 border-t border-zoru-line">
              <h4 className="text-sm font-semibold text-zoru-ink mb-3 flex items-center gap-2"><UserCog className="h-4 w-4 text-zoru-ink-muted" /> Security & Limits</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-zoru-ink">IP Allow-list (CIDR notation)</label>
                  <textarea className="flex min-h-[80px] w-full rounded-md border border-zoru-line bg-white px-3 py-2 text-sm shadow-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-zoru-line focus:border-transparent" defaultValue={selectedKeyId !== "new" ? keys.find(k => k.id === selectedKeyId)?.ipAllowlist.join("\n") : ""} placeholder="0.0.0.0/0 (Any)" />
                  <p className="text-[10px] text-zoru-ink-muted mt-1">One IP or CIDR per line.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-zoru-ink">Rate Limit Override (req/s)</label>
                    <input type="number" className="flex h-10 w-full rounded-md border border-zoru-line bg-white px-3 py-2 text-sm shadow-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-zoru-line focus:border-transparent" placeholder="Default (100)" defaultValue={selectedKeyId !== "new" ? parseInt(keys.find(k => k.id === selectedKeyId)?.rateLimit.replace('/s', '') || "100") : ""} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zoru-ink">Expiry Date</label>
                    <input type="date" className="flex h-10 w-full rounded-md border border-zoru-line bg-white px-3 py-2 text-sm shadow-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-zoru-line focus:border-transparent" defaultValue={selectedKeyId !== "new" && keys.find(k => k.id === selectedKeyId)?.expiryDate !== "Never" ? keys.find(k => k.id === selectedKeyId)?.expiryDate : ""} />
                  </div>
                </div>

                {selectedKeyId !== "new" && (
                  <div>
                    <label className="text-xs font-medium text-zoru-ink">Owner Reassignment</label>
                    <div className="flex gap-2 mt-1.5">
                      <input type="email" className="flex h-10 w-full rounded-md border border-zoru-line bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zoru-line focus:border-transparent" defaultValue={keys.find(k => k.id === selectedKeyId)?.owner} />
                      <Button variant="outline" size="sm" className="h-10 px-4">Transfer</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedKeyId !== "new" && (
              <div className="pt-5 border-t border-zoru-line">
                <h4 className="text-sm font-semibold text-zoru-ink mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-zoru-ink-muted" /> Analytics & Usage</h4>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="p-3 border border-zoru-line rounded-lg bg-white shadow-sm">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-zoru-ink mb-2 flex items-center gap-1.5"><Activity className="h-3 w-3" /> Usage (24h)</div>
                    <div className="h-12 bg-zoru-surface-2 flex items-end gap-1 px-1.5 pb-1 pt-2 rounded-md border border-zoru-line">
                      {[4, 7, 3, 8, 2, 9, 5].map((h, i) => (
                        <div key={i} className="flex-1 bg-zoru-surface-2 rounded-sm hover:bg-zoru-ink transition-colors cursor-pointer" style={{ height: `${h * 10}%` }}></div>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 border border-zoru-line rounded-lg bg-white shadow-sm flex flex-col justify-center">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-zoru-ink mb-1 flex items-center gap-1.5"><XCircle className="h-3 w-3" /> Errors (24h)</div>
                    <div className="text-xl font-bold text-zoru-ink">0.05%</div>
                    <div className="text-[10px] text-zoru-ink-muted mt-1">Avg 4xx/5xx</div>
                  </div>
                  <div className="p-3 border border-zoru-line rounded-lg bg-white shadow-sm flex flex-col justify-center">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-zoru-ink mb-1 flex items-center gap-1.5"><Code className="h-3 w-3" /> Idempotency</div>
                    <div className="text-xl font-bold text-zoru-ink">{keys.find(k => k.id === selectedKeyId)?.idempotencySize}</div>
                    <div className="text-[10px] text-zoru-ink-muted mt-1">Store size</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="w-full shadow-sm"><Terminal className="h-4 w-4 mr-2 text-zoru-ink-muted" /> CLI Snippet</Button>
                  <Button variant="outline" size="sm" className="w-full shadow-sm"><History className="h-4 w-4 mr-2 text-zoru-ink-muted" /> Key Audit</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SabsmsDetailDrawer>
    </SabsmsPageShell>
  );
}

export default function ApiKeysPage() {
  // ApiKeysPageContent reads `useSearchParams()` (via useSabsmsUrlState) — it
  // must sit under a Suspense boundary or Next.js bails the route to an error.
  return (
    <React.Suspense fallback={null}>
      <ApiKeysPageContent />
    </React.Suspense>
  );
}
