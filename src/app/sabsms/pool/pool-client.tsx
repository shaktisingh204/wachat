"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash, Activity, History, LineChart, Sparkles, SlidersHorizontal, ArrowLeftRight, Users, Settings2, GripVertical, Plus } from "lucide-react";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  type SabsmsColumn,
  type SabsmsRowAction,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsColumnPicker,
  useSabsmsUrlState,
  rowsToCsv
} from "@/components/sabsms/page-toolkit";

import { Badge, Button, Switch, Label, Input, Select, ZoruSelectContent as SelectContent, ZoruSelectItem as SelectItem, ZoruSelectTrigger as SelectTrigger, ZoruSelectValue as SelectValue } from "@/components/zoruui";

export interface PoolRow {
  id: string;
  name: string;
  rotationStrategy: string;
  stickyPerRecipient: boolean;
  throttlePerSecond: number;
  quietHours: { enabled: boolean; start: string; end: string; tz: string };
  numbersCount: number;
  campaignsAssigned: number;
  healthDlr: number;
  healthComplaint: number;
  monthlyCost: number;
  capacityMsgsSec: number;
  status: string;
}

interface PoolClientProps {
  rows: PoolRow[];
}

export function PoolClient({ rows }: PoolClientProps) {
  const router = useRouter();
  const urlState = useSabsmsUrlState();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailRow, setDetailRow] = useState<PoolRow | null>(null);

  // Apply filters from URL
  const q = urlState.get("q")?.toLowerCase() || "";
  const filterStrategy = urlState.getAll("strategy");
  
  const filteredRows = rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q)) return false;
    if (filterStrategy.length > 0 && !filterStrategy.includes(r.rotationStrategy)) return false;
    return true;
  });

  const columns: SabsmsColumn<PoolRow>[] = [
    {
      id: "name",
      header: "Pool Name",
      render: (r) => <span className="font-medium text-sm">{r.name}</span>,
      width: "180px",
    },
    {
      id: "strategy",
      header: "Rotation Strategy",
      render: (r) => <span className="text-xs capitalize">{r.rotationStrategy.replace(/-/g, ' ')}</span>,
      width: "140px",
    },
    {
      id: "numbers",
      header: "Numbers",
      render: (r) => <span className="text-xs">{r.numbersCount} active</span>,
      width: "100px",
    },
    {
      id: "campaigns",
      header: "Campaigns",
      render: (r) => <span className="text-xs">{r.campaignsAssigned} assigned</span>,
      width: "100px",
    },
    {
      id: "capacity",
      header: "Capacity",
      render: (r) => <span className="text-xs">{r.capacityMsgsSec} msg/s</span>,
      width: "100px",
    },
    {
      id: "health",
      header: "Health",
      render: (r) => (
        <div className="flex flex-col gap-1 text-[11px]">
          <span className={r.healthDlr > 98 ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>{r.healthDlr}% DLR</span>
          <span className="text-slate-500">{r.healthComplaint}% CMP</span>
        </div>
      ),
      width: "100px",
    },
    {
      id: "cost",
      header: "Monthly Cost",
      render: (r) => <span className="text-xs">${r.monthlyCost.toFixed(2)}</span>,
      width: "100px",
      hideByDefault: true,
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={r.status === "active" ? "default" : "secondary"}>
          {r.status}
        </Badge>
      ),
      width: "90px",
    },
  ];

  const rowActions: SabsmsRowAction<PoolRow>[] = [
    {
      label: "Clone pool",
      icon: <Copy className="h-4 w-4" />,
      onSelect: (r) => console.log("Clone", r.id),
    },
    {
      label: "Compare A/B test",
      icon: <ArrowLeftRight className="h-4 w-4" />,
      onSelect: (r) => console.log("A/B Test", r.id),
    },
    {
      label: "AI: Suggest composition",
      icon: <Sparkles className="h-4 w-4" />,
      onSelect: (r) => console.log("AI Composition", r.id),
    },
    {
      label: "Archive pool",
      icon: <Trash className="h-4 w-4" />,
      destructive: true,
      onSelect: (r) => console.log("Archive", r.id),
    },
  ];

  const visibleColumnIds = urlState.get("cols")?.split(",") || columns.filter(c => !c.hideByDefault).map(c => c.id);

  return (
    <div className="flex h-full flex-col">
      <SabsmsPageShell
        title="Sender Pools"
        description="Group multiple numbers for load balancing, failover, and high-volume sending."
        breadcrumbs={[
          { label: "Infrastructure", href: "/sabsms/numbers" },
          { label: "Sender Pools" }
        ]}
        primaryAction={{
          label: "Create pool",
          onClick: () => console.log("Create Pool"),
        }}
        secondaryActions={[
          {
            label: "Routing rules",
            onClick: () => router.push("/sabsms/routing"),
          }
        ]}
        helpContent={
          <div className="text-sm">
            Sender pools allow distributing volume across multiple numbers using specific strategies (e.g. round-robin).
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SabsmsFilterBar
              searchPlaceholder="Search pools..."
              facets={[
                {
                  key: "strategy",
                  label: "Strategy",
                  multi: true,
                  options: [
                    { label: "Round Robin", value: "round-robin" },
                    { label: "Least Loaded", value: "least-loaded" },
                    { label: "Hash by Recipient", value: "hash-by-recipient" }
                  ]
                }
              ]}
              trailing={
                <div className="flex gap-2">
                  <SabsmsColumnPicker
                    columns={columns.map(c => ({ id: c.id, label: c.header as string, hideByDefault: c.hideByDefault }))}
                    visibleIds={visibleColumnIds}
                    onChange={(ids) => urlState.setOne("cols", ids.join(","))}
                  />
                  <SabsmsExportMenu
                    onExportCsv={() => {
                      const csv = rowsToCsv(filteredRows, visibleColumnIds);
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "sender-pools.csv";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  />
                </div>
              }
            />
          </div>

          <SabsmsDataTable
            rows={filteredRows}
            columns={columns}
            visibleColumnIds={visibleColumnIds}
            rowKey={(r) => r.id}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            rowActions={rowActions}
            onRowClick={setDetailRow}
            emptyTitle="No sender pools configured"
            emptyDescription="Create a pool to group numbers together for better deliverability and throughput."
            emptyAction={{ label: "Create pool", onClick: () => console.log("Create") }}
            emptyIcon={<Users className="h-8 w-8 text-slate-400" />}
            bulkActions={[
              {
                label: "Archive pools",
                onAction: (rows) => console.log("Archive", rows.map(r => r.id))
              }
            ]}
          />
        </div>
      </SabsmsPageShell>

      <SabsmsDetailDrawer
        open={!!detailRow}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
        title={detailRow?.name ?? "Pool Details"}
        subtitle={\`Strategy: \${detailRow?.rotationStrategy.replace(/-/g, ' ')}\`}
        tabs={[
          {
            value: "config",
            label: "Configuration",
            icon: <Settings2 className="h-4 w-4" />,
            content: (
              <div className="p-4 space-y-6 text-sm text-slate-700">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-slate-900 border-b pb-2">Strategy & Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Rotation Strategy</Label>
                        <Select value={detailRow?.rotationStrategy}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Strategy" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="round-robin">Round Robin</SelectItem>
                            <SelectItem value="least-loaded">Least Loaded</SelectItem>
                            <SelectItem value="hash-by-recipient">Hash by Recipient</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Sticky-per-recipient</Label>
                        <Switch checked={detailRow?.stickyPerRecipient} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Per-pool Throttle (msg/s)</Label>
                        <Input type="number" defaultValue={detailRow?.throttlePerSecond} className="w-[100px]" />
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <Label>Health-based degrade rules</Label>
                        <Button variant="outline" size="sm">Configure</Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-slate-900 border-b pb-2">Quiet Hours</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Enable Quiet Hours</Label>
                        <Switch checked={detailRow?.quietHours.enabled} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type="time" defaultValue={detailRow?.quietHours.start} />
                        <span className="text-slate-400">to</span>
                        <Input type="time" defaultValue={detailRow?.quietHours.end} />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1 block">Timezone</Label>
                        <Select value={detailRow?.quietHours.tz}>
                          <SelectTrigger>
                            <SelectValue placeholder="Timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UTC">UTC</SelectItem>
                            <SelectItem value="America/New_York">America/New_York</SelectItem>
                            <SelectItem value="Europe/London">Europe/London</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-900">Pool Definition ({detailRow?.numbersCount} Numbers)</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-7"><Plus className="w-3 h-3 mr-1"/> Add</Button>
                      <Button variant="outline" size="sm" className="h-7"><Sparkles className="w-3 h-3 mr-1 text-purple-500"/> AI Suggest</Button>
                    </div>
                  </div>
                  <div className="border rounded-md bg-slate-50 divide-y text-xs">
                    {/* Mock list of numbers for drag-and-drop allocation representation */}
                    {[1, 2, 3].slice(0, detailRow?.numbersCount || 3).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-slate-400 cursor-grab" />
                          <span className="font-mono text-slate-700">+1234567890{i}</span>
                          <Badge variant="secondary" className="text-[9px]">Twilio</Badge>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500">
                          <Trash className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-xs flex justify-between items-center">
                    <span>Live Size Preview: <strong>{detailRow?.numbersCount}</strong> senders</span>
                    <span>Assigned to <strong>{detailRow?.campaignsAssigned}</strong> campaigns</span>
                  </div>
                </div>
              </div>
            )
          },
          {
            value: "analytics",
            label: "Analytics",
            icon: <LineChart className="h-4 w-4" />,
            content: (
              <div className="p-4 text-sm text-slate-600 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3 bg-white">
                    <p className="text-xs text-slate-500 mb-1">Capacity Simulation</p>
                    <p className="text-lg font-semibold text-slate-900">{detailRow?.capacityMsgsSec} msgs/sec</p>
                    <p className="text-[10px] text-emerald-600 mt-1">Sufficient for active campaigns</p>
                  </div>
                  <div className="border rounded-lg p-3 bg-white">
                    <p className="text-xs text-slate-500 mb-1">Avg Deliverability</p>
                    <p className="text-lg font-semibold text-slate-900">{detailRow?.healthDlr}%</p>
                  </div>
                  <div className="border rounded-lg p-3 bg-white">
                    <p className="text-xs text-slate-500 mb-1">Complaint Rate</p>
                    <p className="text-lg font-semibold text-slate-900">{detailRow?.healthComplaint}%</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900 border-b pb-2">Per-pool Charts</h4>
                  <div className="h-32 border border-dashed rounded-lg flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                    Deliverability Trend Chart (Phase 2)
                  </div>
                  <div className="h-32 border border-dashed rounded-lg flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                    Cost Trend Chart (Phase 2)
                  </div>
                  <div className="h-32 border border-dashed rounded-lg flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                    Complaint-rate Chart (Phase 2)
                  </div>
                </div>
              </div>
            )
          },
          {
            value: "history",
            label: "History",
            icon: <History className="h-4 w-4" />,
            content: (
              <div className="p-4 text-sm text-slate-500 space-y-6">
                <div>
                  <h4 className="font-medium text-slate-900 mb-3 border-b pb-2">Membership Change History</h4>
                  <ul className="space-y-3 relative border-l ml-2 pl-4 border-slate-200">
                    <li className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white"></div>
                      <p className="text-slate-800 text-xs font-medium">Number +12345678902 added to pool</p>
                      <p className="text-[10px] text-slate-400">2 hours ago by admin@example.com</p>
                    </li>
                    <li className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-white"></div>
                      <p className="text-slate-800 text-xs font-medium">Number +1987654321 removed from pool</p>
                      <p className="text-[10px] text-slate-400">Yesterday by auto-degrade rule</p>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-slate-900 mb-3 border-b pb-2">Audit Log</h4>
                  <ul className="space-y-3 relative border-l ml-2 pl-4 border-slate-200">
                    <li className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-slate-300 rounded-full border-2 border-white"></div>
                      <p className="text-slate-800 text-xs font-medium">Throttle increased to {detailRow?.throttlePerSecond} msg/s</p>
                      <p className="text-[10px] text-slate-400">Last week by admin@example.com</p>
                    </li>
                    <li className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-slate-300 rounded-full border-2 border-white"></div>
                      <p className="text-slate-800 text-xs font-medium">Pool created</p>
                      <p className="text-[10px] text-slate-400">2 months ago by admin@example.com</p>
                    </li>
                  </ul>
                </div>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}
