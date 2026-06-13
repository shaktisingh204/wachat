"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { formatUTC } from "@/lib/utils";
import {
  ShieldAlert,
  User,
  Activity,
  Database,
  Info,
} from "lucide-react";
import { Badge, ScrollArea } from "@/components/sabcrm/20ui";
import { toast } from "sonner";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDetailDrawer,
  SabsmsRefreshButton,
  SabsmsExportMenu,
  SabsmsDataTable,
  SabsmsEmpty,
  useSabsmsUrlState,
  rowsToCsv,
  type SabsmsFacet,
  type SabsmsColumn,
} from "@/components/sabsms/page-toolkit";

import { loadAuditPage, type AuditPageData, type AuditRow } from "./actions";

const FACETS: SabsmsFacet[] = [
  {
    key: "kind",
    label: "Type",
    multi: true,
    options: [
      { value: "consent", label: "Consent event" },
      { value: "send-block", label: "Send blocked" },
    ],
  },
  {
    key: "severity",
    label: "Severity",
    multi: true,
    options: [
      { value: "info", label: "Info" },
      { value: "warning", label: "Warning" },
    ],
  },
];

export default function ComplianceAuditPage() {
  const url = useSabsmsUrlState();
  const [data, setData] = useState<AuditPageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    const res = await loadAuditPage({ limit: 500 });
    if (res.success) {
      setData(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const q = url.get("q")?.toLowerCase() ?? "";
  const kindFilters = url.getAll("kind");
  const severityFilters = url.getAll("severity");

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((r) => {
      if (kindFilters.length && !kindFilters.includes(r.kind)) return false;
      if (severityFilters.length && !severityFilters.includes(r.severity)) return false;
      if (q) {
        const hay = `${r.action} ${r.subject} ${r.detail ?? ""} ${r.source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, kindFilters, severityFilters, q]);

  const selectedRow = filteredRows.find((r) => r.id === detailRowId) ?? null;

  const columns: SabsmsColumn<AuditRow>[] = [
    {
      id: "at",
      header: "Time",
      render: (r) => (
        <span className="text-sm whitespace-nowrap">
          {formatUTC(new Date(r.at), true)}
        </span>
      ),
    },
    {
      id: "action",
      header: "Action",
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.kind === "send-block" ? (
            <ShieldAlert className="h-4 w-4 text-[var(--st-text-secondary)]" />
          ) : (
            <User className="h-4 w-4 text-[var(--st-text-secondary)]" />
          )}
          <span className="font-medium">{r.action}</span>
        </div>
      ),
    },
    {
      id: "subject",
      header: "Subject",
      render: (r) => <span className="font-mono text-sm">{r.subject}</span>,
    },
    {
      id: "detail",
      header: "Detail",
      render: (r) => (
        <span className="text-sm text-[var(--st-text-secondary)]">
          {r.detail || "—"}
        </span>
      ),
    },
    {
      id: "severity",
      header: "Severity",
      render: (r) => (
        <Badge variant={r.severity === "warning" ? "outline" : "secondary"}>
          {r.severity}
        </Badge>
      ),
    },
    {
      id: "source",
      header: "Source",
      render: (r) => (
        <span className="font-mono text-xs text-[var(--st-text-secondary)]">
          {r.source}
        </span>
      ),
    },
  ];

  const toCsv = useCallback(async () => {
    return rowsToCsv(
      filteredRows.map((r) => ({
        time: r.at,
        kind: r.kind,
        action: r.action,
        subject: r.subject,
        detail: r.detail ?? "",
        severity: r.severity,
        source: r.source,
      })),
      [
        { key: "time", header: "Time" },
        { key: "kind", header: "Type" },
        { key: "action", header: "Action" },
        { key: "subject", header: "Subject" },
        { key: "detail", header: "Detail" },
        { key: "severity", header: "Severity" },
        { key: "source", header: "Source" },
      ],
    );
  }, [filteredRows]);

  const toJson = useCallback(
    async () => JSON.stringify(filteredRows, null, 2),
    [filteredRows],
  );

  return (
    <SabsmsPageShell
      title="Audit Log & Compliance"
      eyebrow="Compliance"
      description="Append-only compliance ledger — consent events and engine-blocked sends, straight from the live collections."
      breadcrumbs={[
        { label: "Compliance", href: "/sabsms/compliance" },
        { label: "Audit Log" },
      ]}
      toolbar={
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <SabsmsFilterBar
              facets={FACETS}
              searchKey="q"
              searchPlaceholder="Search action, subject, detail…"
            />
          </div>
          <div className="flex items-center gap-2">
            <SabsmsRefreshButton onRefresh={refresh} />
            <SabsmsExportMenu
              toCsv={toCsv}
              toJson={toJson}
              filename="sabsms-audit-ledger"
            />
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 p-4 text-sm">
          <Info className="h-5 w-5 shrink-0 text-[var(--st-text-secondary)]" />
          <p className="text-[var(--st-text-secondary)]">
            These are real, append-only compliance events read live from{" "}
            <code>sabsms_consent_log</code> and blocked rows in{" "}
            <code>sabsms_messages</code>. There is no cryptographic hash chain
            in this build, so no integrity-verification claim is made here.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--st-border)] p-4">
            <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
              <Database className="h-4 w-4" />
              <span className="text-sm">Consent events</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {data ? data.totals.consentEvents.toLocaleString() : "…"}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--st-border)] p-4">
            <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-sm">Sends blocked</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {data ? data.totals.sendBlocks.toLocaleString() : "…"}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--st-border)] p-4">
            <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Rows shown</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {filteredRows.length.toLocaleString()}
            </p>
          </div>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-[var(--st-border)] p-6">
            <p className="text-sm text-[var(--st-text)]">{loadError}</p>
          </div>
        ) : data && filteredRows.length === 0 ? (
          <SabsmsEmpty
            icon={<Database className="h-6 w-6" />}
            title="No audit events"
            description="No consent events or blocked sends match the current filters."
          />
        ) : (
          <SabsmsDataTable
            rowKey={(r) => r.id}
            rows={filteredRows}
            columns={columns}
            onRowClick={(r) => setDetailRowId(r.id)}
            loading={!data && !loadError}
            pageSize={20}
            total={filteredRows.length}
          />
        )}
      </div>

      <SabsmsDetailDrawer
        open={!!detailRowId}
        onOpenChange={(v) => !v && setDetailRowId(null)}
        title={selectedRow ? selectedRow.action : "Audit record"}
        description={selectedRow?.source}
      >
        {selectedRow && (
          <ScrollArea className="h-[calc(100vh-120px)] px-6 pb-6">
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[var(--st-text-secondary)] mb-1">Time</p>
                  <p className="font-medium">
                    {formatUTC(new Date(selectedRow.at), true)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--st-text-secondary)] mb-1">
                    Severity
                  </p>
                  <Badge
                    variant={
                      selectedRow.severity === "warning" ? "outline" : "secondary"
                    }
                  >
                    {selectedRow.severity}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-[var(--st-text-secondary)] mb-1">
                    Subject
                  </p>
                  <p className="font-mono text-sm">{selectedRow.subject}</p>
                </div>
                <div>
                  <p className="text-sm text-[var(--st-text-secondary)] mb-1">
                    Source
                  </p>
                  <p className="font-mono text-xs">{selectedRow.source}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-[var(--st-text-secondary)] mb-2">
                  Raw payload
                </p>
                <div className="bg-[var(--st-bg-muted)] p-4 rounded-md font-mono text-sm overflow-x-auto">
                  <pre>{JSON.stringify(selectedRow.payload, null, 2)}</pre>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </SabsmsDetailDrawer>
    </SabsmsPageShell>
  );
}
