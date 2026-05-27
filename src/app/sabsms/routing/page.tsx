"use client";

import * as React from "react";
import { 
  Network, 
  Plus, 
  Wand2, 
  ArrowRightLeft, 
  Activity, 
  AlertTriangle,
  History,
  Download,
  Upload,
  Play,
  GripVertical,
  ArrowUp,
  ArrowDown,
  X,
  CheckCircle2,
  XCircle,
  Search
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
import { SabsmsBulkActionsBar } from "@/components/sabsms/page-toolkit/sabsms-bulk-actions";
import { SabsmsColumnPicker } from "@/components/sabsms/page-toolkit/sabsms-column-picker";
import { SabsmsKbdHint } from "@/components/sabsms/page-toolkit/sabsms-kbd-hint";
import { SabsmsTableSkeleton, SabsmsEmpty } from "@/components/sabsms/page-toolkit/sabsms-states";

import { Badge, Button, Switch, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardFooter } from "@/components/zoruui";

/** Mock data for Routing Rules */
const MOCK_RULES = [
  { id: "r1", name: "US Marketing Primary", priority: 1, destination: "US (+1)", category: "Marketing", timeOfDay: "Any", provider: "Twilio", status: "active", tags: ["us", "marketing"], costEst: "$0.0079", deliverabilityEst: "99.1%" },
  { id: "r2", name: "UK OTP High Priority", priority: 2, destination: "UK (+44)", category: "OTP", timeOfDay: "Any", provider: "Vonage", status: "active", tags: ["uk", "otp"], costEst: "$0.0400", deliverabilityEst: "99.9%" },
  { id: "r3", name: "IN Promo Night Shift", priority: 3, destination: "IN (+91)", category: "Marketing", timeOfDay: "20:00 - 08:00", provider: "Plivo", status: "inactive", tags: ["in", "promo"], costEst: "$0.0020", deliverabilityEst: "95.0%" },
  { id: "r4", name: "Global Alert Fallback", priority: 4, destination: "Global", category: "Alert", timeOfDay: "Any", provider: "Sinch", status: "active", tags: ["fallback"], costEst: "$0.0150", deliverabilityEst: "98.5%" },
];

const SAVED_VIEWS = [
  { id: "v1", name: "Marketing Rules", filters: { category: ["Marketing"] } },
  { id: "v2", name: "Active Rules", filters: { status: ["active"] } },
];

const SORT_OPTIONS: SabsmsSortOption[] = [
  { id: "priority_asc", label: "Priority (High to Low)", field: "priority", direction: "asc" },
  { id: "priority_desc", label: "Priority (Low to High)", field: "priority", direction: "desc" },
  { id: "name_asc", label: "Name (A-Z)", field: "name", direction: "asc" },
];

function FallbackFlowBuilder() {
  const [flow, setFlow] = React.useState([
    { id: "1", type: "primary", provider: "Twilio" },
    { id: "2", type: "fallback", provider: "Vonage" },
    { id: "3", type: "fallback", provider: "Sinch" }
  ]);

  const moveUp = (index: number) => {
    if (index <= 1) return;
    const newFlow = [...flow];
    [newFlow[index - 1], newFlow[index]] = [newFlow[index], newFlow[index - 1]];
    setFlow(newFlow);
  };

  const moveDown = (index: number) => {
    if (index === 0 || index === flow.length - 1) return;
    const newFlow = [...flow];
    [newFlow[index + 1], newFlow[index]] = [newFlow[index], newFlow[index + 1]];
    setFlow(newFlow);
  };

  const remove = (index: number) => {
    if (index === 0) return;
    const newFlow = [...flow];
    newFlow.splice(index, 1);
    setFlow(newFlow);
  };

  const addFallback = () => {
    setFlow([...flow, { id: Date.now().toString(), type: "fallback", provider: "Plivo" }]);
  };

  return (
    <div className="space-y-3 bg-zoru-surface-2/50 p-4 rounded-lg border border-zoru-line mt-2">
      {flow.map((node, i) => (
        <div key={node.id} className="relative flex items-center gap-3">
          {i > 0 && (
            <div className="absolute left-[11px] -top-[16px] bottom-1/2 w-px bg-zoru-surface-2" />
          )}
          <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium border ${i === 0 ? "bg-zoru-surface-2 border-zoru-line text-zoru-ink" : "bg-white border-zoru-line text-zoru-ink shadow-sm"}`}>
            {i + 1}
          </div>
          <div className={`flex-1 flex items-center justify-between p-2.5 border rounded-md shadow-sm transition-colors ${i === 0 ? "bg-zoru-surface-2/50 border-zoru-line" : "bg-white border-zoru-line hover:border-zoru-line"}`}>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-zoru-ink uppercase tracking-wider">{i === 0 ? "Primary Provider" : `Fallback ${i}`}</span>
              <span className="text-sm font-medium text-zoru-ink">{node.provider}</span>
            </div>
            {i > 0 && (
              <div className="flex items-center gap-0.5">
                <button onClick={() => moveUp(i)} disabled={i === 1} className="p-1.5 text-zoru-ink-muted hover:text-zoru-ink disabled:opacity-30 rounded hover:bg-zoru-surface-2 transition-colors">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => moveDown(i)} disabled={i === flow.length - 1} className="p-1.5 text-zoru-ink-muted hover:text-zoru-ink disabled:opacity-30 rounded hover:bg-zoru-surface-2 transition-colors">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-4 bg-zoru-surface-2 mx-1" />
                <button onClick={() => remove(i)} className="p-1.5 text-zoru-ink-muted hover:text-zoru-ink rounded hover:bg-zoru-surface-2 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="relative flex items-center gap-3 pt-1">
        <div className="absolute left-[11px] -top-3 bottom-1/2 w-px border-l-2 border-dashed border-zoru-line" />
        <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 border-dashed border-zoru-line text-zoru-ink-muted">
          <Plus className="h-3 w-3" />
        </div>
        <button onClick={addFallback} className="text-sm text-zoru-ink hover:text-zoru-ink font-medium flex items-center gap-1.5 transition-colors">
          Add Fallback Route
        </button>
      </div>
    </div>
  );
}

function RouteTraceTool() {
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [category, setCategory] = React.useState("Any");
  const [traceLog, setTraceLog] = React.useState<any[] | null>(null);
  const [isTracing, setIsTracing] = React.useState(false);

  const handleTrace = () => {
    setIsTracing(true);
    setTimeout(() => {
      const logs = [];
      let matchedRule = null;
      for (const rule of MOCK_RULES) {
        if (rule.status === "inactive") {
          logs.push({ rule, status: "skipped", reason: "Rule is inactive" });
          continue;
        }

        let isMatch = true;
        let mismatchReason = "";

        if (rule.destination.includes("US") && !phoneNumber.startsWith("+1")) {
          isMatch = false;
          mismatchReason = "Destination mismatch (Not US)";
        } else if (rule.destination.includes("UK") && !phoneNumber.startsWith("+44")) {
          isMatch = false;
          mismatchReason = "Destination mismatch (Not UK)";
        } else if (rule.destination.includes("IN") && !phoneNumber.startsWith("+91")) {
          isMatch = false;
          mismatchReason = "Destination mismatch (Not IN)";
        }
        
        if (isMatch && rule.category !== "Any" && category !== "Any" && rule.category !== category) {
          isMatch = false;
          mismatchReason = `Category mismatch (${category} != ${rule.category})`;
        }

        if (isMatch) {
          logs.push({ rule, status: "matched", reason: "All conditions met" });
          matchedRule = rule;
          break;
        } else {
          logs.push({ rule, status: "skipped", reason: mismatchReason || "Conditions not met" });
        }
      }

      if (!matchedRule) {
        logs.push({ 
          rule: { name: "Global Fallback", provider: "Sinch", priority: 999 }, 
          status: "matched", 
          reason: "Fell back to default provider" 
        });
      }

      setTraceLog(logs);
      setIsTracing(false);
    }, 800);
  };

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" /> Routing Trace Tool
        </ZoruCardTitle>
        <ZoruCardDescription>Input a number to explain exactly which provider will be used and why.</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-4">
        <div>
          <label className="text-xs text-zoru-ink mb-1 block">Test Number</label>
          <input 
            type="text" 
            placeholder="+1 234 567 8900" 
            className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-zoru-ink mb-1 block">Message Category</label>
          <select 
            className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>Any</option>
            <option>Marketing</option>
            <option>OTP</option>
            <option>Alert</option>
          </select>
        </div>
        <Button variant="outline" className="w-full" onClick={handleTrace} disabled={isTracing || !phoneNumber}>
          {isTracing ? "Tracing..." : "Run Trace"}
        </Button>

        {traceLog && (
          <div className="mt-4 space-y-2 border-t border-zoru-line pt-4">
            <h4 className="text-sm font-semibold mb-3">Trace Results</h4>
            {traceLog.map((log, i) => (
              <div key={i} className={`p-3 rounded-md text-sm border ${log.status === "matched" ? "bg-zoru-surface-2 border-zoru-line" : "bg-zoru-surface-2 border-zoru-line opacity-75"}`}>
                <div className="flex items-center gap-2 font-medium mb-1">
                  {log.status === "matched" ? (
                    <CheckCircle2 className="h-4 w-4 text-zoru-ink" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zoru-ink-muted" />
                  )}
                  <span className={log.status === "matched" ? "text-zoru-ink" : "text-zoru-ink"}>
                    {log.rule.name}
                  </span>
                  <Badge variant="outline" className="ml-auto text-[10px]">{log.rule.provider}</Badge>
                </div>
                <div className="text-xs text-zoru-ink ml-6">
                  {log.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </ZoruCardContent>
    </Card>
  );
}

export default function RoutingPage() {
  const urlState = useSabsmsUrlState();

  const [selectedRuleId, setSelectedRuleId] = React.useState<string | null>(null);
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());

  // F1: Rule Editor (mocked via detail drawer)
  // F2: Visual Rule Chain (represented by the table order)
  // F3: Conflict Detection (mocked alert in the UI)
  // F4: Priority drag-reorder (represented by GripVertical icon on rows)
  // F5: Per-rule cost preview (column in table)
  // F6: Per-rule deliverability simulation (column in table)
  // F7: Default fallback editor (mocked via secondary action)
  // F8: Per-country failover order (mocked in rule details)
  // F9: Per-category routing (mocked in rules data)
  // F10: Per-time-of-day routing (mocked in rules data)
  // F11: Test routing against sample (mocked button)
  // F12: Rule history with diff (mocked action)
  // F13: Activate / deactivate rule (switch in table)
  // F14: Tag / label (badges in table)
  // F15: AI: "Optimize routing for cost / deliverability" (mocked button)
  // F16: Compare two routing configs (mocked action)
  // F17: Per-rule analytics (mocked action)
  // F18: Export rule set JSON (mocked via export menu)
  // F19: Import rule set (mocked action)
  // F20: Audit log (mocked action)

  const columns: SabsmsColumn<typeof MOCK_RULES[0]>[] = [
    {
      id: "drag",
      header: "",
      render: () => <GripVertical className="h-4 w-4 text-zoru-ink-muted cursor-move" />,
      width: "40px"
    },
    {
      id: "name",
      header: "Rule Name",
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-xs text-zoru-ink flex gap-1 mt-1">
            {row.tags.map(t => <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0">{t}</Badge>)}
          </div>
        </div>
      )
    },
    {
      id: "conditions",
      header: "Conditions",
      render: (row) => (
        <div className="text-sm">
          <div><span className="text-zoru-ink">Dest:</span> {row.destination}</div>
          <div><span className="text-zoru-ink">Cat:</span> {row.category}</div>
          {row.timeOfDay !== "Any" && <div><span className="text-zoru-ink">Time:</span> {row.timeOfDay}</div>}
        </div>
      )
    },
    {
      id: "provider",
      header: "Routes To",
      render: (row) => <Badge variant="outline">{row.provider}</Badge>,
    },
    {
      id: "simulation",
      header: "Simulation",
      render: (row) => (
        <div className="text-sm">
          <div><span className="text-zoru-ink">Cost:</span> {row.costEst}/msg</div>
          <div><span className="text-zoru-ink">DLR:</span> {row.deliverabilityEst}</div>
        </div>
      )
    },
    {
      id: "status",
      header: "Status",
      render: (row) => (
        <Switch 
          checked={row.status === "active"} 
          onCheckedChange={() => {}} 
          aria-label="Toggle rule active status"
        />
      ),
    }
  ];

  const columnDefs = columns.map(c => ({ id: c.id, label: typeof c.header === "string" ? c.header : c.id }));
  const [visibleCols, setVisibleCols] = React.useState(columns.map(c => c.id));
  const [density, setDensity] = React.useState<"compact" | "comfortable" | "cosy">("comfortable");

  return (
    <SabsmsPageShell
      title="Routing Rules"
      eyebrow="Infrastructure"
      description="Manage SMS routing and failover strategies across multiple providers."
      breadcrumbs={[{ label: "Infrastructure" }, { label: "Routing" }]}
      primaryAction={{ label: "Create Rule", onClick: () => setSelectedRuleId("new") }}
      secondaryActions={[
        { label: "AI Optimization", icon: <Wand2 className="h-4 w-4" /> },
        { label: "Import Rule Set", icon: <Upload className="h-4 w-4" /> },
        { label: "Default Fallbacks", icon: <ArrowRightLeft className="h-4 w-4" /> },
        { label: "Compare Configs", icon: <Network className="h-4 w-4" /> },
        { label: "Audit Log", icon: <History className="h-4 w-4" /> },
      ]}
      helpTitle="About Routing Rules"
      helpBody="Routing rules allow you to define conditional logic for sending messages. Rules are evaluated top-to-bottom. The first matching rule determines the provider."
      toolbar={
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <SabsmsFilterBar
            searchPlaceholder="Search rules..."
            sortOptions={SORT_OPTIONS}
            defaultSort="priority_asc"
            facets={[
              {
                key: "status",
                label: "Status",
                options: [
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" }
                ],
                multi: true
              },
              {
                key: "category",
                label: "Category",
                options: [
                  { label: "Marketing", value: "Marketing" },
                  { label: "OTP", value: "OTP" },
                  { label: "Alert", value: "Alert" }
                ],
                multi: true
              }
            ]}
          />
          <SabsmsSavedViews scope="routing" />
          <SabsmsColumnPicker
            columns={columnDefs}
            visible={visibleCols}
            onChange={setVisibleCols}
          />
          <SabsmsExportMenu
            onExportCsv={() => console.log(rowsToCsv(MOCK_RULES, columns))}
            onExportExcel={() => {}}
            onExportJson={() => {}}
          />
          <SabsmsRefreshButton 
            isRefreshing={false}
            onRefresh={() => {}}
          />
        </div>
      }
    >
      <SabsmsKbdHint
        shortcuts={[
          { key: "c", description: "Create new rule" },
          { key: "/", description: "Search rules" },
          { key: "?", description: "Show keyboard shortcuts" }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 space-y-4">
          {/* F3: Conflict Detection Mock */}
          <Card className="bg-zoru-surface-2 border-zoru-line shadow-none">
            <div className="flex items-start p-4 gap-3">
              <AlertTriangle className="h-5 w-5 text-zoru-ink mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-zoru-ink">Rule Conflict Detected</h4>
                <p className="text-sm text-zoru-ink">"US Marketing Primary" fully shadows "Global Alert Fallback" for US destinations.</p>
              </div>
            </div>
          </Card>

          <Card>
            <SabsmsDataTable
              columns={columns}
              visibleColumnIds={visibleCols}
              density={density}
              selectable
              rowKey={(r) => r.id}
              selectedIds={Array.from(selectedRows)}
              onSelectionChange={(ids) => setSelectedRows(new Set(ids))}
              bulkActions={[
                { label: "Activate", onSelect: () => {} },
                { label: "Deactivate", onSelect: () => {} },
                { label: "Delete", onSelect: () => {}, destructive: true }
              ]}
              rows={MOCK_RULES}
              onRowClick={(row) => setSelectedRuleId(row.id)}
              rowActions={[
                { label: "Edit Rule", onSelect: (r) => setSelectedRuleId(r.id) },
                { label: "Test Rule", onSelect: () => {} },
                { label: "Rule Analytics", onSelect: () => {} },
                { label: "View History", onSelect: () => {} },
                { label: "Delete", onSelect: () => {}, destructive: true }
              ]}
            />
            <div className="p-4 border-t border-zoru-line flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="text-sm text-zoru-ink">Visual Rule Chain matches table order</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zoru-ink">Density:</span>
                  <select 
                    className="text-xs border-zoru-line rounded p-1"
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
                total={100}
                onPageChange={(p) => urlState.setOne("page", p)}
                onPageSizeChange={(s) => urlState.setOne("pageSize", s)}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <RouteTraceTool />

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Global Fallbacks
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <div className="text-sm text-zoru-ink">If no rules match, messages will route using default fallbacks.</div>
              <Button variant="outline" className="w-full">Edit Fallbacks</Button>
            </ZoruCardContent>
          </Card>
        </div>
      </div>

      <SabsmsDetailDrawer
        open={selectedRuleId !== null}
        onOpenChange={(open) => { if (!open) setSelectedRuleId(null); }}
        title={selectedRuleId === "new" ? "Create Rule" : "Edit Rule"}
        description="Configure conditions, routing priority, and failovers."
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="outline" onClick={() => setSelectedRuleId(null)}>Cancel</Button>
            <Button onClick={() => setSelectedRuleId(null)}>Save Rule</Button>
          </div>
        }
      >
        <div className="space-y-6 py-4">
          {/* Rule Editor fields mock */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rule Name</label>
              <input type="text" className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors mt-1" defaultValue={selectedRuleId !== "new" ? MOCK_RULES.find(r => r.id === selectedRuleId)?.name : ""} />
            </div>
            
            <div className="pt-4 border-t border-zoru-line">
              <h4 className="text-sm font-medium mb-3">Conditions</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zoru-ink">Destination Country</label>
                    <select className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm mt-1">
                      <option>Any</option>
                      <option>US (+1)</option>
                      <option>UK (+44)</option>
                      <option>IN (+91)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zoru-ink">Category</label>
                    <select className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm mt-1">
                      <option>Any</option>
                      <option>Marketing</option>
                      <option>OTP</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zoru-ink">Time of Day (Sender TZ)</label>
                  <select className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm mt-1">
                    <option>Any Time</option>
                    <option>Business Hours (09:00 - 17:00)</option>
                    <option>Night Shift (20:00 - 08:00)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zoru-line">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-medium">Routing Flow</h4>
                  <p className="text-xs text-zoru-ink mt-1">Define primary and fallback providers visually.</p>
                </div>
              </div>
              <FallbackFlowBuilder />
            </div>
          </div>
        </div>
      </SabsmsDetailDrawer>
    </SabsmsPageShell>
  );
}
