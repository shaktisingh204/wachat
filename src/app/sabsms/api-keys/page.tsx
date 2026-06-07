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
  Server,
  Inbox
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

import {
  Badge,
  Button,
  IconButton,
  Switch,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
  Input,
  Textarea,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from "@/components/sabcrm/20ui";

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

function CopyableKeyDisplay({ keyValue }: { keyValue: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(keyValue);
    setCopied(true);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const masked = keyValue.substring(0, 8) + "................";

  return (
    <div className="flex items-center justify-between gap-1.5 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] px-2 py-1 w-[220px]">
      <span className="font-mono text-xs text-[var(--st-text)] truncate">
        {revealed ? keyValue : masked}
      </span>
      <div className="flex items-center gap-0.5 border-l border-[var(--st-border)] pl-1.5 ml-1 shrink-0">
        <IconButton
          size="sm"
          label={revealed ? "Hide key" : "Reveal key"}
          icon={revealed ? EyeOff : Eye}
          onClick={(e) => { e.stopPropagation(); setRevealed(!revealed); }}
        />
        <IconButton
          size="sm"
          label="Copy key"
          icon={copied ? Check : Copy}
          onClick={handleCopy}
        />
      </div>
    </div>
  );
}

function ApiKeysPageContent() {
  const urlState = useSabsmsUrlState();
  const { toast } = useToast();

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
    toast.success("API key created");
    fetchData();
    setSelectedKeyId(null);
  };

  const handleRevoke = async (id: string) => {
    await revokeApiKey(id);
    toast.success("API key revoked");
    fetchData();
  };

  const columns: SabsmsColumn<SabsmsApiKey>[] = [
    {
      id: "name",
      header: "Key Name",
      render: (row) => (
        <div>
          <div className="font-semibold text-[var(--st-text)] flex items-center gap-2">
            <Key className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden="true" />
            {row.name}
          </div>
          <div className="text-xs text-[var(--st-text)] mt-1.5 flex gap-1.5 flex-wrap">
            {row.scopes.map(s => (
              <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                {s}
              </Badge>
            ))}
            {row.isWebhookOnly && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">webhook-only</Badge>}
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
        <Badge variant={row.status === "active" ? "success" : "destructive"}>
          {row.status === "active" ? "Active" : "Revoked"}
        </Badge>
      )
    },
    {
      id: "lastUsed",
      header: "Last Used",
      render: (row) => (
        <div className="text-sm">
          <div className="font-medium text-[var(--st-text)] flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-[var(--st-text-secondary)]" aria-hidden="true" />
            {row.lastUsedAt !== "Never" ? new Date(row.lastUsedAt).toLocaleDateString() : "Never"}
          </div>
          <div className="text-xs text-[var(--st-text-secondary)] mt-0.5">IP: {row.lastUsedIp}</div>
        </div>
      )
    },
    {
      id: "security",
      header: "Security",
      render: (row) => (
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-[var(--st-text-secondary)]" aria-hidden="true" />
            <span className="text-[var(--st-text)] truncate max-w-[120px]">{row.ipAllowlist.join(", ")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <UserCog className="h-3 w-3 text-[var(--st-text-secondary)]" aria-hidden="true" />
            <span className="text-[var(--st-text)] truncate max-w-[120px]">{row.owner}</span>
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
            <Activity className="h-3 w-3 text-[var(--st-text-secondary)]" aria-hidden="true" />
            <span className="text-[var(--st-text)]">{row.rateLimit}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-[var(--st-text-secondary)]" aria-hidden="true" />
            <span className="text-[var(--st-text)]">{row.expiryDate}</span>
          </div>
        </div>
      )
    }
  ];

  const columnDefs = columns.map(c => ({ id: c.id, label: typeof c.header === "string" ? c.header : c.id }));
  const [visibleCols, setVisibleCols] = React.useState(columns.map(c => c.id));
  const [density, setDensity] = React.useState<"compact" | "comfortable" | "cosy">("comfortable");

  const selectedKey = selectedKeyId ? keys.find(k => k.id === selectedKeyId) : undefined;

  return (
    <SabsmsPageShell
      title="API Keys"
      eyebrow="Developer"
      description="Manage API keys, scopes, IP whitelists, and monitor execution logs securely."
      breadcrumbs={[{ label: "Developer" }, { label: "API Keys" }]}
      primaryAction={{ label: "Create API Key", onClick: () => setSelectedKeyId("new"), icon: <Plus className="h-4 w-4" aria-hidden="true" /> }}
      secondaryActions={[
        { label: "Postman Collection", icon: <Download className="h-4 w-4" aria-hidden="true" /> },
        { label: "Audit Log", icon: <History className="h-4 w-4" aria-hidden="true" /> },
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
          <Card padding="none" className="overflow-hidden">
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
            <div className="p-4 border-t border-[var(--st-border)] flex justify-between items-center bg-[var(--st-bg-secondary)]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--st-text)]">Density:</span>
                  <Select value={density} onValueChange={(v) => setDensity(v as "compact" | "comfortable" | "cosy")}>
                    <SelectTrigger aria-label="Table density" className="h-8 w-[150px] text-xs">
                      <SelectValue placeholder="Density" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="cosy">Cosy</SelectItem>
                    </SelectContent>
                  </Select>
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

          <Card padding="none">
            <CardHeader className="border-b border-[var(--st-border)] py-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-[var(--st-text)]">
                    <Server className="h-4 w-4 text-[var(--st-text)]" aria-hidden="true" /> Recent Executions
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">Real-time view of API requests made across all your keys.</CardDescription>
                </div>
                <Button variant="outline" size="sm">View Full Logs</Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              {logs.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Inbox}
                    title="No recent executions"
                    description="API requests across your keys will appear here as they happen."
                  />
                </div>
              ) : (
                <Table density="compact">
                  <THead>
                    <Tr>
                      <Th>Timestamp</Th>
                      <Th>Endpoint</Th>
                      <Th>Key Used</Th>
                      <Th>Status</Th>
                      <Th>Latency</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {logs.map(log => (
                      <Tr key={log.id}>
                        <Td className="font-mono text-xs text-[var(--st-text-secondary)]">{new Date(log.timestamp).toLocaleTimeString()}</Td>
                        <Td className="font-mono text-xs text-[var(--st-text)] font-medium">{log.endpoint}</Td>
                        <Td className="text-[var(--st-text)] text-xs">
                          <span className="flex items-center gap-1.5">
                            <Key className="h-3 w-3 text-[var(--st-text-secondary)]" aria-hidden="true" /> {log.keyName}
                          </span>
                        </Td>
                        <Td>
                          <Badge variant={log.status === 200 ? "outline" : "destructive"} className="text-[10px] px-2 py-0.5">
                            {log.status}
                          </Badge>
                        </Td>
                        <Td className="text-[var(--st-text-secondary)] text-xs">{log.latency}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card padding="none">
            <CardHeader className="border-b border-[var(--st-border)] py-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[var(--st-text)]" aria-hidden="true" /> CLI Tools
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 p-5">
              <div className="text-sm text-[var(--st-text-secondary)]">Generate CLI snippets or configure your local environment instantly.</div>
              <Button variant="outline" block className="text-xs font-medium">Generate Configuration</Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <SabsmsDetailDrawer
        open={selectedKeyId !== null}
        onOpenChange={(open) => { if (!open) setSelectedKeyId(null); }}
        title={selectedKeyId === "new" ? "Create API Key" : "Edit API Key"}
        description={selectedKeyId === "new" ? "Create a new API key with specific scopes." : "Manage key settings, rate limits, and view usage."}
        footer={
          <div className="flex gap-2 justify-end w-full border-t border-[var(--st-border)] pt-4">
            <Button variant="outline" onClick={() => setSelectedKeyId(null)}>Cancel</Button>
            <Button variant="primary" onClick={selectedKeyId === "new" ? handleCreate : () => setSelectedKeyId(null)}>{selectedKeyId === "new" ? "Create Key" : "Save Changes"}</Button>
          </div>
        }
      >
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            {selectedKeyId !== "new" && (
              <div className="p-4 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] flex flex-col gap-2">
                <span className="text-xs font-medium text-[var(--st-text)] uppercase tracking-wider">Secret Key</span>
                <CopyableKeyDisplay keyValue={selectedKey?.keyValue || ""} />
                <p className="text-[10px] text-[var(--st-text-secondary)] mt-1">This key grants access based on its assigned scopes. Keep it secure.</p>
              </div>
            )}
            <Field label="Key Name">
              <Input
                type="text"
                defaultValue={selectedKeyId !== "new" ? selectedKey?.name : ""}
                placeholder="e.g. Production Webhook Integration"
              />
            </Field>

            <div className="pt-5 border-t border-[var(--st-border)]">
              <h4 className="text-sm font-semibold text-[var(--st-text)] mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> Scopes & Permissions</h4>
              <div className="space-y-3">
                <Field label="Scope">
                  <Select defaultValue="read-only">
                    <SelectTrigger aria-label="Scope">
                      <SelectValue placeholder="Select a scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read-only">Read-Only</SelectItem>
                      <SelectItem value="send-only">Send-Only</SelectItem>
                      <SelectItem value="full">Full Access</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="flex items-center gap-3 mt-4 p-3 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                  <Switch
                    aria-label="Restrict to webhooks only"
                    checked={selectedKeyId !== "new" ? selectedKey?.isWebhookOnly : false}
                    onCheckedChange={() => {}}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[var(--st-text)]">Restrict to webhooks only</span>
                    <span className="text-xs text-[var(--st-text-secondary)]">Key will only be valid for webhook subscriptions.</span>
                  </div>
                </div>
              </div>

              {selectedKeyId !== "new" && (
                <div className="mt-4 p-3 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)]">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)] mb-1">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Permission Diff vs Role
                  </div>
                  <p className="text-xs text-[var(--st-text-secondary)]">This key has fewer privileges than your user account (missing: billing_write, team_write).</p>
                </div>
              )}
            </div>

            <div className="pt-5 border-t border-[var(--st-border)]">
              <h4 className="text-sm font-semibold text-[var(--st-text)] mb-3 flex items-center gap-2"><UserCog className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> Security & Limits</h4>

              <div className="space-y-4">
                <Field label="IP Allow-list (CIDR notation)" help="One IP or CIDR per line.">
                  <Textarea
                    rows={4}
                    defaultValue={selectedKeyId !== "new" ? selectedKey?.ipAllowlist.join("\n") : ""}
                    placeholder="0.0.0.0/0 (Any)"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Rate Limit Override (req/s)">
                    <Input
                      type="number"
                      placeholder="Default (100)"
                      defaultValue={selectedKeyId !== "new" ? parseInt(selectedKey?.rateLimit.replace('/s', '') || "100") : ""}
                    />
                  </Field>
                  <Field label="Expiry Date">
                    <Input
                      type="date"
                      defaultValue={selectedKeyId !== "new" && selectedKey?.expiryDate !== "Never" ? selectedKey?.expiryDate : ""}
                    />
                  </Field>
                </div>

                {selectedKeyId !== "new" && (
                  <Field label="Owner Reassignment">
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        defaultValue={selectedKey?.owner}
                        className="flex-1"
                      />
                      <Button variant="outline" size="sm">Transfer</Button>
                    </div>
                  </Field>
                )}
              </div>
            </div>

            {selectedKeyId !== "new" && (
              <div className="pt-5 border-t border-[var(--st-border)]">
                <h4 className="text-sm font-semibold text-[var(--st-text)] mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> Analytics & Usage</h4>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="p-3 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--st-text-secondary)] mb-2 flex items-center gap-1.5"><Activity className="h-3 w-3" aria-hidden="true" /> Usage (24h)</div>
                    <div className="h-12 bg-[var(--st-bg)] flex items-end gap-1 px-1.5 pb-1 pt-2 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                      {[4, 7, 3, 8, 2, 9, 5].map((h, i) => (
                        <div key={i} className="flex-1 bg-[var(--st-accent)] rounded-sm" style={{ height: `${h * 10}%` }} aria-hidden="true"></div>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] flex flex-col justify-center">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--st-text-secondary)] mb-1 flex items-center gap-1.5"><XCircle className="h-3 w-3" aria-hidden="true" /> Errors (24h)</div>
                    <div className="text-xl font-bold text-[var(--st-text)]">0.05%</div>
                    <div className="text-[10px] text-[var(--st-text-secondary)] mt-1">Avg 4xx/5xx</div>
                  </div>
                  <div className="p-3 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] flex flex-col justify-center">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--st-text-secondary)] mb-1 flex items-center gap-1.5"><Code className="h-3 w-3" aria-hidden="true" /> Idempotency</div>
                    <div className="text-xl font-bold text-[var(--st-text)]">{selectedKey?.idempotencySize}</div>
                    <div className="text-[10px] text-[var(--st-text-secondary)] mt-1">Store size</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" size="sm" block iconLeft={Terminal}>CLI Snippet</Button>
                  <Button variant="outline" size="sm" block iconLeft={History}>Key Audit</Button>
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
  // ApiKeysPageContent reads `useSearchParams()` (via useSabsmsUrlState), so it
  // must sit under a Suspense boundary or Next.js bails the route to an error.
  return (
    <React.Suspense fallback={null}>
      <ApiKeysPageContent />
    </React.Suspense>
  );
}
