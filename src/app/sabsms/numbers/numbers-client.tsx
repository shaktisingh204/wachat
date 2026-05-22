"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Trash, UserX, Star, Phone, History, ScrollText } from "lucide-react";

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

import { Badge, Button } from "@/components/zoruui";

export interface NumberRow {
  id: string;
  e164: string;
  country: string;
  type: string;
  provider: string;
  status: string;
  capabilities: { sms: boolean; mms: boolean; rcs: boolean; voice: boolean };
  // Extended fields
  healthDlr?: number;
  healthComplaint?: number;
  monthlyCost?: number;
  lastUsedAt?: string;
  sendVolume24h?: number;
}

interface NumbersClientProps {
  rows: NumberRow[];
  fallbackFrom: string;
}

export function NumbersClient({ rows, fallbackFrom }: NumbersClientProps) {
  const router = useRouter();
  const urlState = useSabsmsUrlState();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailRow, setDetailRow] = useState<NumberRow | null>(null);

  // Apply filters from URL
  const q = urlState.get("q")?.toLowerCase() || "";
  const filterCountry = urlState.getAll("country");
  const filterType = urlState.getAll("type");
  const filterProvider = urlState.getAll("provider");
  const filterCapabilities = urlState.getAll("capabilities");
  
  const filteredRows = rows.filter((r) => {
    if (q && !r.e164.includes(q) && !r.country.toLowerCase().includes(q)) return false;
    if (filterCountry.length > 0 && !filterCountry.includes(r.country)) return false;
    if (filterType.length > 0 && !filterType.includes(r.type)) return false;
    if (filterProvider.length > 0 && !filterProvider.includes(r.provider)) return false;
    
    if (filterCapabilities.length > 0) {
      const hasCap = filterCapabilities.some(cap => {
        if (cap === "sms") return r.capabilities.sms;
        if (cap === "mms") return r.capabilities.mms;
        if (cap === "rcs") return r.capabilities.rcs;
        if (cap === "voice") return r.capabilities.voice;
        return false;
      });
      if (!hasCap) return false;
    }
    
    return true;
  });

  // Unique facet options
  const uniqueCountries = Array.from(new Set(rows.map(r => r.country))).filter(c => c !== "—");
  const uniqueProviders = Array.from(new Set(rows.map(r => r.provider))).filter(p => p !== "—");

  const capPill = (label: string, on: boolean) => (
    <Badge variant={on ? "default" : "secondary"} className="text-[10px]">
      {label}
    </Badge>
  );

  const columns: SabsmsColumn<NumberRow>[] = [
    {
      id: "number",
      header: "Number",
      render: (r) => <span className="font-mono text-sm font-medium">{r.e164}</span>,
      width: "140px",
    },
    {
      id: "country",
      header: "Country",
      render: (r) => <span className="text-xs">{r.country}</span>,
      width: "80px",
    },
    {
      id: "type",
      header: "Type",
      render: (r) => <span className="text-xs capitalize">{r.type}</span>,
      width: "110px",
    },
    {
      id: "provider",
      header: "Provider",
      render: (r) => <span className="text-xs capitalize">{r.provider}</span>,
      width: "100px",
    },
    {
      id: "capabilities",
      header: "Capabilities",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {capPill("SMS", r.capabilities.sms)}
          {capPill("MMS", r.capabilities.mms)}
          {capPill("RCS", r.capabilities.rcs)}
          {capPill("Voice", r.capabilities.voice)}
        </div>
      ),
      width: "200px",
    },
    {
      id: "health",
      header: "Health",
      render: (r) => (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-600 font-medium">{r.healthDlr ?? "99"}% DLR</span>
          <span className="text-slate-500">{r.healthComplaint ?? "<0.1"}% CMP</span>
        </div>
      ),
      width: "130px",
      hideByDefault: false,
    },
    {
      id: "cost",
      header: "Monthly Cost",
      render: (r) => <span className="text-xs">${r.monthlyCost?.toFixed(2) ?? "1.00"}</span>,
      width: "100px",
      hideByDefault: true,
    },
    {
      id: "volume",
      header: "Vol (24h)",
      render: (r) => <span className="text-xs">{r.sendVolume24h?.toLocaleString() ?? "0"} msgs</span>,
      width: "100px",
      hideByDefault: true,
    },
    {
      id: "lastUsedAt",
      header: "Last Used",
      render: (r) => <span className="text-xs text-slate-500">{r.lastUsedAt ?? "Never"}</span>,
      width: "120px",
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

  const rowActions: SabsmsRowAction<NumberRow>[] = [
    {
      label: "Set as default sender",
      icon: <Star className="h-4 w-4" />,
      onSelect: (r) => console.log("Set default", r.id),
    },
    {
      label: "Set as fallback sender",
      onSelect: (r) => console.log("Set fallback", r.id),
    },
    {
      label: "Edit quiet hours",
      onSelect: (r) => console.log("Quiet hours", r.id),
    },
    {
      label: "Edit throttle",
      onSelect: (r) => console.log("Throttle", r.id),
    },
    {
      label: "Assign to campaign",
      onSelect: (r) => console.log("Campaign", r.id),
    },
    {
      label: "Reassign workspace",
      icon: <UserX className="h-4 w-4" />,
      onSelect: (r) => console.log("Reassign", r.id),
    },
    {
      label: "Release number",
      icon: <Trash className="h-4 w-4" />,
      destructive: true,
      onSelect: (r) => console.log("Release", r.id),
    },
  ];

  const visibleColumnIds = urlState.get("cols")?.split(",") || columns.filter(c => !c.hideByDefault).map(c => c.id);

  return (
    <div className="flex h-full flex-col">
      <SabsmsPageShell
        title="Numbers"
        description="Provisioned senders for this workspace."
        breadcrumbs={[
          { label: "Infrastructure", href: "/sabsms/numbers" },
          { label: "Numbers" }
        ]}
        primaryAction={{
          label: "Provision new number",
          onClick: () => router.push("/sabsms/numbers/new"),
        }}
        secondaryActions={[
          {
            label: "Configure providers",
            onClick: () => router.push("/sabsms/providers"),
          }
        ]}
        helpContent={
          <div className="text-sm">
            Manage your phone numbers across all providers. 
            Phase 1 reads numbers from <code>sabsms_numbers</code> collection.
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SabsmsFilterBar
              searchPlaceholder="Search numbers..."
              facets={[
                {
                  key: "country",
                  label: "Country",
                  multi: true,
                  options: uniqueCountries.map(c => ({ label: c, value: c }))
                },
                {
                  key: "type",
                  label: "Type",
                  multi: true,
                  options: [
                    { label: "Longcode", value: "longcode" },
                    { label: "Shortcode", value: "shortcode" },
                    { label: "Toll-Free", value: "tollfree" },
                    { label: "Alphanumeric", value: "alphanumeric" }
                  ]
                },
                {
                  key: "provider",
                  label: "Provider",
                  multi: true,
                  options: uniqueProviders.map(p => ({ label: p, value: p }))
                },
                {
                  key: "capabilities",
                  label: "Capabilities",
                  multi: true,
                  options: [
                    { label: "SMS", value: "sms" },
                    { label: "MMS", value: "mms" },
                    { label: "RCS", value: "rcs" },
                    { label: "Voice", value: "voice" }
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
                      a.download = "numbers-export.csv";
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
            emptyTitle="No numbers provisioned yet"
            emptyDescription={
              fallbackFrom
                ? `Sends will go out from ${fallbackFrom} (engine env fallback) until a workspace number is added.`
                : "Configure a provider, then provision a number. The provisioning UI ships in Phase 1.5."
            }
            emptyAction={{ label: "Open providers", onClick: () => router.push("/sabsms/providers") }}
            emptyIcon={<Phone className="h-8 w-8 text-slate-400" />}
            bulkActions={[
              {
                label: "Bulk port numbers",
                onAction: (rows) => console.log("Porting", rows.map(r => r.id))
              },
              {
                label: "Set as default sender",
                onAction: (rows) => console.log("Set default", rows.map(r => r.id))
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
        title={detailRow?.e164 ?? "Number details"}
        subtitle={`${detailRow?.country} ${detailRow?.type}`}
        tabs={[
          {
            value: "history",
            label: "Rental History",
            icon: <History className="h-4 w-4" />,
            content: (
              <div className="p-4 text-sm text-slate-500">
                <h4 className="font-medium text-slate-900 mb-2">Rental History</h4>
                <p>Provisioned on: 2026-05-01</p>
                <p>Last billed: 2026-05-01 ($1.00)</p>
              </div>
            )
          },
          {
            value: "audit",
            label: "Audit Log",
            icon: <ScrollText className="h-4 w-4" />,
            content: (
              <div className="p-4 text-sm text-slate-500">
                <h4 className="font-medium text-slate-900 mb-2">Audit Log</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Added to sender pool (2026-05-01)</li>
                  <li>Provisioned via Twilio (2026-05-01)</li>
                </ul>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}
