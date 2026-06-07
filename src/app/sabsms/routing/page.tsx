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
  Upload,
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/sabcrm/20ui';

/** Mock data for Routing Rules */
const MOCK_RULES = [
  { id: "r1", name: "US Marketing Primary", priority: 1, destination: "US (+1)", category: "Marketing", timeOfDay: "Any", provider: "Twilio", status: "active", tags: ["us", "marketing"], costEst: "$0.0079", deliverabilityEst: "99.1%" },
  { id: "r2", name: "UK OTP High Priority", priority: 2, destination: "UK (+44)", category: "OTP", timeOfDay: "Any", provider: "Vonage", status: "active", tags: ["uk", "otp"], costEst: "$0.0400", deliverabilityEst: "99.9%" },
  { id: "r3", name: "IN Promo Night Shift", priority: 3, destination: "IN (+91)", category: "Marketing", timeOfDay: "20:00 - 08:00", provider: "Plivo", status: "inactive", tags: ["in", "promo"], costEst: "$0.0020", deliverabilityEst: "95.0%" },
  { id: "r4", name: "Global Alert Fallback", priority: 4, destination: "Global", category: "Alert", timeOfDay: "Any", provider: "Sinch", status: "active", tags: ["fallback"], costEst: "$0.0150", deliverabilityEst: "98.5%" },
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
    <div className="space-y-3 bg-[var(--st-bg-secondary)] p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] mt-2">
      {flow.map((node, i) => (
        <div key={node.id} className="relative flex items-center gap-3">
          {i > 0 && (
            <div className="absolute left-[11px] -top-[16px] bottom-1/2 w-px bg-[var(--st-border)]" />
          )}
          <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium border bg-[var(--st-bg-secondary)] border-[var(--st-border)] text-[var(--st-text)] ${i === 0 ? "" : "shadow-sm"}`}>
            {i + 1}
          </div>
          <div className="flex-1 flex items-center justify-between p-2.5 border rounded-[var(--st-radius)] shadow-sm bg-[var(--st-bg-secondary)] border-[var(--st-border)]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wider">{i === 0 ? "Primary Provider" : `Fallback ${i}`}</span>
              <span className="text-sm font-medium text-[var(--st-text)]">{node.provider}</span>
            </div>
            {i > 0 && (
              <div className="flex items-center gap-0.5">
                <IconButton
                  label="Move provider up"
                  icon={ArrowUp}
                  size="sm"
                  onClick={() => moveUp(i)}
                  disabled={i === 1}
                />
                <IconButton
                  label="Move provider down"
                  icon={ArrowDown}
                  size="sm"
                  onClick={() => moveDown(i)}
                  disabled={i === flow.length - 1}
                />
                <div className="w-px h-4 bg-[var(--st-border)] mx-1" />
                <IconButton
                  label="Remove fallback provider"
                  icon={X}
                  size="sm"
                  onClick={() => remove(i)}
                />
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="relative flex items-center gap-3 pt-1">
        <div className="absolute left-[11px] -top-3 bottom-1/2 w-px border-l-2 border-dashed border-[var(--st-border)]" />
        <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] border-2 border-dashed border-[var(--st-border)] text-[var(--st-text-secondary)]">
          <Plus className="h-3 w-3" aria-hidden="true" />
        </div>
        <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addFallback}>
          Add Fallback Route
        </Button>
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
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" aria-hidden="true" /> Routing Trace Tool
        </CardTitle>
        <CardDescription>Input a number to explain exactly which provider will be used and why.</CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <Field label="Test Number">
          <Input
            type="text"
            placeholder="+1 234 567 8900"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </Field>
        <Field label="Message Category">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label="Message category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Any">Any</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="OTP">OTP</SelectItem>
              <SelectItem value="Alert">Alert</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Button variant="outline" block onClick={handleTrace} disabled={isTracing || !phoneNumber}>
          {isTracing ? "Tracing..." : "Run Trace"}
        </Button>

        {traceLog && (
          <div className="mt-4 space-y-2 border-t border-[var(--st-border)] pt-4">
            <h4 className="text-sm font-semibold mb-3">Trace Results</h4>
            {traceLog.map((log, i) => (
              <div key={i} className={`p-3 rounded-[var(--st-radius)] text-sm border bg-[var(--st-bg-secondary)] border-[var(--st-border)] ${log.status === "matched" ? "" : "opacity-75"}`}>
                <div className="flex items-center gap-2 font-medium mb-1">
                  {log.status === "matched" ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--st-status-ok)]" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                  )}
                  <span className="text-[var(--st-text)]">
                    {log.rule.name}
                  </span>
                  <Badge variant="outline" className="ml-auto text-[10px]">{log.rule.provider}</Badge>
                </div>
                <div className="text-xs text-[var(--st-text-secondary)] ml-6">
                  {log.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
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
  // F4: Priority drag-reorder (represented by a drag handle icon on rows)
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
      render: () => <Plus className="h-4 w-4 text-[var(--st-text-secondary)] rotate-45 cursor-move" aria-hidden="true" />,
      width: "40px"
    },
    {
      id: "name",
      header: "Rule Name",
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-xs text-[var(--st-text-secondary)] flex gap-1 mt-1">
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
          <div><span className="text-[var(--st-text-secondary)]">Dest:</span> {row.destination}</div>
          <div><span className="text-[var(--st-text-secondary)]">Cat:</span> {row.category}</div>
          {row.timeOfDay !== "Any" && <div><span className="text-[var(--st-text-secondary)]">Time:</span> {row.timeOfDay}</div>}
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
          <div><span className="text-[var(--st-text-secondary)]">Cost:</span> {row.costEst}/msg</div>
          <div><span className="text-[var(--st-text-secondary)]">DLR:</span> {row.deliverabilityEst}</div>
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
        { label: "AI Optimization", icon: <Wand2 className="h-4 w-4" aria-hidden="true" /> },
        { label: "Import Rule Set", icon: <Upload className="h-4 w-4" aria-hidden="true" /> },
        { label: "Default Fallbacks", icon: <ArrowRightLeft className="h-4 w-4" aria-hidden="true" /> },
        { label: "Compare Configs", icon: <Network className="h-4 w-4" aria-hidden="true" /> },
        { label: "Audit Log", icon: <History className="h-4 w-4" aria-hidden="true" /> },
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
          <Card className="bg-[var(--st-bg-secondary)] border-[var(--st-border)] shadow-none">
            <div className="flex items-start p-4 gap-3">
              <AlertTriangle className="h-5 w-5 text-[var(--st-warn)] mt-0.5" aria-hidden="true" />
              <div>
                <h4 className="text-sm font-semibold text-[var(--st-text)]">Rule Conflict Detected</h4>
                <p className="text-sm text-[var(--st-text-secondary)]">"US Marketing Primary" fully shadows "Global Alert Fallback" for US destinations.</p>
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
            <div className="p-4 border-t border-[var(--st-border)] flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="text-sm text-[var(--st-text-secondary)]">Visual Rule Chain matches table order</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--st-text-secondary)]">Density:</span>
                  <Select value={density} onValueChange={(v) => setDensity(v as "compact" | "comfortable" | "cosy")}>
                    <SelectTrigger aria-label="Table density" className="h-8 w-36">
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
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" aria-hidden="true" /> Global Fallbacks
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="text-sm text-[var(--st-text-secondary)]">If no rules match, messages will route using default fallbacks.</div>
              <Button variant="outline" block>Edit Fallbacks</Button>
            </CardBody>
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
            <Field label="Rule Name">
              <Input
                type="text"
                defaultValue={selectedRuleId !== "new" ? MOCK_RULES.find(r => r.id === selectedRuleId)?.name : ""}
              />
            </Field>

            <div className="pt-4 border-t border-[var(--st-border)]">
              <h4 className="text-sm font-medium mb-3">Conditions</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Destination Country">
                    <Select defaultValue="Any">
                      <SelectTrigger aria-label="Destination country">
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Any">Any</SelectItem>
                        <SelectItem value="US (+1)">US (+1)</SelectItem>
                        <SelectItem value="UK (+44)">UK (+44)</SelectItem>
                        <SelectItem value="IN (+91)">IN (+91)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Category">
                    <Select defaultValue="Any">
                      <SelectTrigger aria-label="Category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Any">Any</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="OTP">OTP</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Time of Day (Sender TZ)">
                  <Select defaultValue="Any Time">
                    <SelectTrigger aria-label="Time of day">
                      <SelectValue placeholder="Select a window" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Any Time">Any Time</SelectItem>
                      <SelectItem value="Business Hours (09:00 - 17:00)">Business Hours (09:00 - 17:00)</SelectItem>
                      <SelectItem value="Night Shift (20:00 - 08:00)">Night Shift (20:00 - 08:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--st-border)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-medium">Routing Flow</h4>
                  <p className="text-xs text-[var(--st-text-secondary)] mt-1">Define primary and fallback providers visually.</p>
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
