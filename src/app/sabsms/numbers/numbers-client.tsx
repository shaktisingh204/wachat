"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash, Phone, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  type SabsmsColumn,
  type SabsmsRowAction,
  type SabsmsBulkAction,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsColumnPicker,
  useSabsmsUrlState,
  rowsToCsv,
} from "@/components/sabsms/page-toolkit";

import { Badge, Button } from "@/components/sabcrm/20ui";
import { releaseNumbersAction } from "./actions";

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
  webhookUrl?: string;
  routingUrl?: string;
  lastUsedAt?: string;
  sendVolume24h?: number;
}

interface NumbersClientProps {
  rows: NumberRow[];
  fallbackFrom: string;
}

/** Providers whose numbers can actually be released at the carrier. */
const RELEASABLE_PROVIDERS = new Set(["twilio", "telnyx"]);

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
      const hasCap = filterCapabilities.some((cap) => {
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
  const uniqueCountries = Array.from(new Set(rows.map((r) => r.country))).filter((c) => c !== "—");
  const uniqueProviders = Array.from(new Set(rows.map((r) => r.provider))).filter((p) => p !== "—");

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
          <span className="text-[var(--st-text)] font-medium">
            {r.healthDlr != null ? `${r.healthDlr}%` : "—"} DLR
          </span>
          <span className="text-[var(--st-text)]">
            {r.healthComplaint != null ? `${r.healthComplaint}%` : "—"} CMP
          </span>
        </div>
      ),
      width: "130px",
    },
    {
      id: "cost",
      header: "Monthly Cost",
      render: (r) =>
        r.monthlyCost != null && r.monthlyCost > 0 ? (
          <span className="text-xs">${(r.monthlyCost / 100).toFixed(2)}</span>
        ) : (
          <span className="text-xs text-[var(--st-text-secondary)]">—</span>
        ),
      width: "100px",
      hideByDefault: true,
    },
    {
      id: "volume",
      header: "Vol (24h)",
      render: (r) => <span className="text-xs">{(r.sendVolume24h ?? 0).toLocaleString()} msgs</span>,
      width: "100px",
      hideByDefault: true,
    },
    {
      id: "lastUsedAt",
      header: "Last Used",
      render: (r) => <span className="text-xs text-[var(--st-text)]">{r.lastUsedAt ?? "Never"}</span>,
      width: "120px",
      hideByDefault: true,
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
      ),
      width: "90px",
    },
  ];

  const handleRelease = async (numberIds: string[]) => {
    const releasable = numberIds.filter((id) => {
      const row = rows.find((r) => r.id === id);
      return row && RELEASABLE_PROVIDERS.has(row.provider);
    });
    if (releasable.length === 0) {
      toast.error("Only Twilio/Telnyx numbers can be released at the provider.");
      return;
    }
    if (
      !window.confirm(
        `Release ${releasable.length} number(s) at the provider? This is permanent — the number is given up at Twilio/Telnyx and stops billing.`,
      )
    ) {
      return;
    }
    const res = await releaseNumbersAction(releasable);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const { released, errors } = res.result;
    if (released.length > 0) {
      toast.success(`Released ${released.length} number(s) at the provider.`);
    }
    for (const err of errors) {
      const row = rows.find((r) => r.id === err.id);
      toast.error(`${row?.e164 ?? err.id}: ${err.error}`);
    }
    setSelectedIds([]);
    router.refresh();
  };

  const rowActions: SabsmsRowAction<NumberRow>[] = [
    {
      label: "View details",
      icon: <ExternalLink className="h-4 w-4" />,
      onSelect: (r) => router.push(`/sabsms/numbers/${r.id}`),
    },
    {
      label: "Release number",
      icon: <Trash className="h-4 w-4" />,
      destructive: true,
      onSelect: (r) => void handleRelease([r.id]),
    },
  ];

  const bulkActions: SabsmsBulkAction<NumberRow>[] = [
    {
      label: "Release numbers",
      icon: <Trash className="h-4 w-4" />,
      destructive: true,
      onSelect: (selected) => handleRelease(selected.map((r) => r.id)),
    },
  ];

  const visibleColumnIds =
    urlState.get("cols")?.split(",") || columns.filter((c) => !c.hideByDefault).map((c) => c.id);

  return (
    <div className="flex h-full flex-col">
      <SabsmsPageShell
        title="Numbers"
        description="Provisioned senders for this workspace."
        breadcrumbs={[
          { label: "Infrastructure", href: "/sabsms/numbers" },
          { label: "Numbers" },
        ]}
        primaryAction={{
          label: "Buy number",
          href: "/sabsms/numbers/buy",
        }}
        secondaryActions={[
          {
            label: "Configure providers",
            onSelectHref: "/sabsms/providers",
          },
        ]}
        helpTitle="About numbers"
        helpBody={
          <div className="text-sm">
            Manage your phone numbers across all providers. Numbers are bought and released
            through the engine against your connected Twilio/Telnyx account.
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
                  options: uniqueCountries.map((c) => ({ label: c, value: c })),
                },
                {
                  key: "type",
                  label: "Type",
                  multi: true,
                  options: [
                    { label: "Longcode", value: "longcode" },
                    { label: "Shortcode", value: "shortcode" },
                    { label: "Toll-Free", value: "tollfree" },
                    { label: "Alphanumeric", value: "alphanumeric" },
                  ],
                },
                {
                  key: "provider",
                  label: "Provider",
                  multi: true,
                  options: uniqueProviders.map((p) => ({ label: p, value: p })),
                },
                {
                  key: "capabilities",
                  label: "Capabilities",
                  multi: true,
                  options: [
                    { label: "SMS", value: "sms" },
                    { label: "MMS", value: "mms" },
                    { label: "RCS", value: "rcs" },
                    { label: "Voice", value: "voice" },
                  ],
                },
              ]}
              trailing={
                <div className="flex gap-2">
                  <SabsmsColumnPicker
                    columns={columns.map((c) => ({
                      id: c.id,
                      label: typeof c.header === "string" ? c.header : c.id,
                      required: !c.hideByDefault,
                    }))}
                    visible={visibleColumnIds}
                    onChange={(ids) => urlState.setOne("cols", ids.join(","))}
                  />
                  <SabsmsExportMenu
                    filename="numbers-export"
                    toCsv={async () =>
                      rowsToCsv(filteredRows as unknown as Record<string, unknown>[], [
                        { key: "e164", header: "Number" },
                        { key: "country", header: "Country" },
                        { key: "type", header: "Type" },
                        { key: "provider", header: "Provider" },
                        { key: "status", header: "Status" },
                        { key: "sendVolume24h", header: "Volume 24h" },
                      ])
                    }
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
                : "Configure a provider, then buy a number through the engine."
            }
            emptyAction={{ label: "Open providers", onClick: () => router.push("/sabsms/providers") }}
            emptyIcon={<Phone className="h-8 w-8 text-[var(--st-text-secondary)]" />}
            bulkActions={bulkActions}
          />
        </div>
      </SabsmsPageShell>

      <SabsmsDetailDrawer
        open={!!detailRow}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
        title={detailRow?.e164 ?? "Number details"}
        description={detailRow ? `${detailRow.country} · ${detailRow.type} · ${detailRow.provider}` : undefined}
      >
        {detailRow ? (
          <div className="space-y-4 py-2 text-sm text-[var(--st-text)]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={detailRow.status === "active" ? "default" : "secondary"}>
                {detailRow.status}
              </Badge>
              {capPill("SMS", detailRow.capabilities.sms)}
              {capPill("MMS", detailRow.capabilities.mms)}
              {capPill("RCS", detailRow.capabilities.rcs)}
              {capPill("Voice", detailRow.capabilities.voice)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-[var(--st-text-secondary)]">DLR (24h)</div>
                <div>{detailRow.healthDlr != null ? `${detailRow.healthDlr}%` : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--st-text-secondary)]">Complaint (24h)</div>
                <div>{detailRow.healthComplaint != null ? `${detailRow.healthComplaint}%` : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--st-text-secondary)]">Volume (24h)</div>
                <div>{(detailRow.sendVolume24h ?? 0).toLocaleString()} msgs</div>
              </div>
              <div>
                <div className="text-xs text-[var(--st-text-secondary)]">Last used</div>
                <div>{detailRow.lastUsedAt ?? "Never"}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-[var(--st-border)] pt-3">
              <Button
                variant="outline"
                onClick={() => router.push(`/sabsms/numbers/${detailRow.id}`)}
              >
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                Open full detail (history, charts, overrides)
              </Button>
              {RELEASABLE_PROVIDERS.has(detailRow.provider) ? (
                <Button
                  variant="ghost"
                  className="text-[var(--st-danger)]"
                  onClick={() => void handleRelease([detailRow.id])}
                >
                  <Trash className="mr-2 h-4 w-4" aria-hidden="true" />
                  Release at provider
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SabsmsDetailDrawer>
    </div>
  );
}
