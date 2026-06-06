"use client";

/**
 * SabSMS suppressions — interactive client surface.
 *
 * Renders the filter bar, data table, bulk actions, import flow, audit
 * drawer, campaign-overlap modal, auto-rules editor, and reason
 * taxonomy editor — all hanging off the data the server page passes in.
 *
 * Every mutation routes through a server action exported from
 * `./actions.ts`.
 */

import * as React from "react";
import { fmtDate, formatUTC, fmtQty, fmtINR } from "@/lib/utils";
import {
  Edit3,
  History,
  ListPlus,
  Settings2,
  ShieldOff,
  Tag,
  Target,
  Trash2,
  Webhook,
} from "lucide-react";

import { SabFilePicker } from "@/components/sabfiles";
import {
  SabsmsBulkAction,
  SabsmsColumn,
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsRefreshButton,
  SabsmsSavedViews,
  rowsToCsv,
} from "@/components/sabsms/page-toolkit";
import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Textarea,
} from "@/components/sabcrm/20ui/zoru";

import {
  type AuditTrailEntry,
  type AutoSuppressRule,
  type SuppressionCoverage,
  type SuppressionRow,
  addReasonTaxonomy,
  addSuppression,
  bulkImportSuppressions,
  bulkUnsuppress,
  computeCampaignOverlap,
  deleteAutoSuppressRule,
  exportCompliancePdf,
  loadAuditTrail,
  removeReasonTaxonomy,
  requestSharedSuppressionList,
  tagSuppression,
  unsuppressOne,
  updateSuppressionReason,
  upsertAutoSuppressRule,
} from "./actions";

const SOURCE_OPTIONS = [
  { value: "stop", label: "STOP keyword" },
  { value: "complaint", label: "Carrier complaint" },
  { value: "bounce", label: "Bounce" },
  { value: "manual", label: "Manual block" },
  { value: "carrier_block", label: "Carrier block" },
  { value: "import", label: "Imported" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "source", label: "By source" },
];

export interface SuppressionsTableProps {
  rows: SuppressionRow[];
  total: number;
  page: number;
  pageSize: number;
  coverage: SuppressionCoverage;
  costAvoidedUsd: number;
  campaigns: Array<{ id: string; name: string }>;
  autoRules: AutoSuppressRule[];
  reasonTaxonomy: string[];
  isAdmin: boolean;
}

export function SuppressionsTable({
  rows,
  total,
  page,
  pageSize,
  coverage,
  costAvoidedUsd,
  campaigns,
  autoRules,
  reasonTaxonomy,
  isAdmin,
}: SuppressionsTableProps) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [addBlockOpen, setAddBlockOpen] = React.useState(false);
  const [addPhone, setAddPhone] = React.useState("");
  const [addReason, setAddReason] = React.useState("");
  const [addExpiresIn, setAddExpiresIn] = React.useState<number | "">("");
  const [importOpen, setImportOpen] = React.useState(false);
  const [bulkUnsupOpen, setBulkUnsupOpen] = React.useState(false);
  const [bulkUnsupReason, setBulkUnsupReason] = React.useState("");
  const [editingRow, setEditingRow] = React.useState<SuppressionRow | null>(null);
  const [editingReason, setEditingReason] = React.useState("");
  const [tagRow, setTagRow] = React.useState<SuppressionRow | null>(null);
  const [tagValue, setTagValue] = React.useState("");
  const [unsupRow, setUnsupRow] = React.useState<SuppressionRow | null>(null);
  const [unsupReason, setUnsupReason] = React.useState("");
  const [auditFor, setAuditFor] = React.useState<SuppressionRow | null>(null);
  const [auditEntries, setAuditEntries] = React.useState<AuditTrailEntry[]>([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [overlapOpen, setOverlapOpen] = React.useState(false);
  const [overlapCampaignId, setOverlapCampaignId] = React.useState<string>("");
  const [overlapResult, setOverlapResult] = React.useState<{
    recipients: number;
    suppressed: number;
    pct: number;
  } | null>(null);
  const [autoRulesOpen, setAutoRulesOpen] = React.useState(false);
  const [taxonomyOpen, setTaxonomyOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  // Column defs are static for SSR/CSR alignment.
  const columns: SabsmsColumn<SuppressionRow>[] = React.useMemo(
    () => [
      {
        id: "phoneHash",
        header: "Phone hash",
        render: (r) => (
          <span className="font-mono text-xs text-[var(--st-text)]">
            {r.phoneHash.slice(0, 12)}…{r.phoneHash.slice(-4)}
          </span>
        ),
        width: "200px",
      },
      {
        id: "source",
        header: "Source",
        render: (r) => <Badge variant="secondary">{r.source}</Badge>,
        width: "130px",
      },
      {
        id: "reason",
        header: "Reason",
        render: (r) => (
          <button
            type="button"
            className="text-left text-sm text-[var(--st-text)] hover:text-[var(--st-text)]"
            onClick={() => {
              setEditingRow(r);
              setEditingReason(r.reason ?? "");
            }}
          >
            {r.reason ?? <span className="italic text-[var(--st-text-secondary)]">add reason…</span>}
            <Edit3 className="ml-1.5 inline h-3 w-3 text-[var(--st-text-secondary)]" />
          </button>
        ),
      },
      {
        id: "tag",
        header: "Tag",
        render: (r) => (
          <button
            type="button"
            className="text-xs text-[var(--st-text)] hover:text-[var(--st-text)]"
            onClick={() => {
              setTagRow(r);
              setTagValue(r.tag ?? "");
            }}
          >
            {r.tag ?? <span className="italic text-[var(--st-text-secondary)]">+ tag</span>}
          </button>
        ),
        width: "140px",
      },
      {
        id: "createdAt",
        header: "Added",
        render: (r) => (
          <div>
            <div>
              {formatUTC(r.createdAt, true)}
            </div>
            {r.expiresAt && (
              <div className="text-xs text-[var(--st-text)] mt-0.5">
                Expires: {formatUTC(r.expiresAt, true)}
              </div>
            )}
          </div>
        ),
        width: "160px",
      },
      {
        id: "lastTouchedAt",
        header: "Last touched",
        render: (r) =>
          r.lastTouchedAt
            ? formatUTC(r.lastTouchedAt, true)
            : "—",
        width: "150px",
      },
    ],
    [],
  );

  const bulkActions: SabsmsBulkAction<SuppressionRow>[] = React.useMemo(
    () => [
      {
        label: "Unsuppress (admin)",
        icon: <ShieldOff className="h-3.5 w-3.5" />,
        destructive: true,
        onSelect: () => setBulkUnsupOpen(true),
      },
      {
        label: "Export selection",
        icon: <ListPlus className="h-3.5 w-3.5" />,
        onSelect: (selected) => {
          const csv = rowsToCsv(
            selected as unknown as Array<Record<string, unknown>>,
            [
              { key: "phoneHash", header: "phone_hash" },
              { key: "source", header: "source" },
              { key: "reason", header: "reason" },
              { key: "tag", header: "tag" },
              { key: "createdAt", header: "created_at" },
            ],
          );
          downloadText(`sabsms-suppressions-selection-${Date.now()}.csv`, csv);
        },
      },
    ],
    [],
  );

  async function handleImport(picked: { url?: string; name: string }) {
    if (!picked.url) return;
    setBusy("Importing…");
    try {
      const res = await bulkImportSuppressions({ sabFileUrl: picked.url });
      if (res.ok) {
        setImportOpen(false);
        refresh();
      } else {
        alert(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleAddBlock() {
    if (!addPhone.trim()) return;
    setBusy("Adding…");
    try {
      const res = await addSuppression({
        phone: addPhone,
        source: "manual",
        reason: addReason,
        expiresInDays: typeof addExpiresIn === "number" ? addExpiresIn : undefined,
      });
      if (res.ok) {
        setAddBlockOpen(false);
        setAddPhone("");
        setAddReason("");
        setAddExpiresIn("");
        refresh();
      } else {
        alert(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveReason() {
    if (!editingRow) return;
    setBusy("Saving reason…");
    try {
      const res = await updateSuppressionReason({
        id: editingRow.id,
        reason: editingReason,
      });
      if (res.ok) {
        setEditingRow(null);
        refresh();
      } else {
        alert(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveTag() {
    if (!tagRow) return;
    setBusy("Saving tag…");
    try {
      const res = await tagSuppression({ id: tagRow.id, tag: tagValue });
      if (res.ok) {
        setTagRow(null);
        refresh();
      } else {
        alert(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleUnsupOne() {
    if (!unsupRow) return;
    setBusy("Unsuppressing…");
    try {
      const res = await unsuppressOne({
        id: unsupRow.id,
        reason: unsupReason,
      });
      if (res.ok) {
        setUnsupRow(null);
        setUnsupReason("");
        refresh();
      } else {
        alert(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleBulkUnsup() {
    setBusy("Unsuppressing selection…");
    try {
      const res = await bulkUnsuppress({
        ids: selectedIds,
        reason: bulkUnsupReason,
      });
      if (res.ok) {
        setBulkUnsupOpen(false);
        setBulkUnsupReason("");
        setSelectedIds([]);
        refresh();
      } else {
        alert(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function openAudit(row: SuppressionRow) {
    setAuditFor(row);
    setAuditLoading(true);
    try {
      const entries = await loadAuditTrail("", row.phoneHash);
      setAuditEntries(entries);
    } finally {
      setAuditLoading(false);
    }
  }

  async function runOverlap() {
    if (!overlapCampaignId) return;
    setBusy("Computing overlap…");
    try {
      const r = await computeCampaignOverlap("", overlapCampaignId);
      setOverlapResult(r);
    } finally {
      setBusy(null);
    }
  }

  const exportCsv = React.useCallback(async () => {
    return rowsToCsv(rows as unknown as Array<Record<string, unknown>>, [
      { key: "phoneHash", header: "phone_hash" },
      { key: "source", header: "source" },
      { key: "reason", header: "reason" },
      { key: "tag", header: "tag" },
      { key: "createdAt", header: "created_at" },
      { key: "lastTouchedAt", header: "last_touched_at" },
    ]);
  }, [rows]);

  const exportJson = React.useCallback(async () => {
    return rows.map((r) => JSON.stringify(r)).join("\n");
  }, [rows]);

  const exportHashOnlyCsv = React.useCallback(async () => {
    // Privacy-safe export — only the hash column, no reasons / tags.
    const out = ["phone_hash"];
    for (const r of rows) out.push(r.phoneHash);
    return out.join("\n");
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Suppression coverage"
          value={`${coverage.coveragePct.toFixed(1)}%`}
          period={`${fmtQty(coverage.suppressed)} of ${fmtQty(coverage.workspaceContacts)} contacts`}
        />
        <StatCard
          label="Total suppressed"
          value={fmtQty(total)}
          period="all sources"
        />
        <StatCard
          label="Cost avoided 24h"
          value={fmtINR(costAvoidedUsd, "USD")}
          period="messages auto-blocked"
        />
      </div>

      <SabsmsFilterBar
        searchPlaceholder="Phone (+E.164) or 64-char hash"
        facets={[
          {
            key: "source",
            label: "Source",
            options: SOURCE_OPTIONS.map((s) => ({
              value: s.value,
              label: s.label,
            })),
            multi: true,
          },
        ]}
        sortOptions={SORT_OPTIONS}
        defaultSort="newest"
        dateRangeKey={{ from: "from", to: "to" }}
        trailing={
          <>
            <SabsmsSavedViews scope="suppressions" />
            <SabsmsRefreshButton onRefresh={refresh} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddBlockOpen(true)}
            >
              Add block
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <ListPlus className="mr-1.5 h-3.5 w-3.5" /> Import
            </Button>
            <SabsmsExportMenu
              filename="sabsms-suppressions"
              toCsv={exportCsv}
              toJson={exportJson}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const csv = await exportHashOnlyCsv();
                downloadText(`sabsms-suppressions-hashes-${Date.now()}.csv`, csv);
              }}
            >
              hash-only export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const r = await exportCompliancePdf();
                alert(r.ok ? "ok" : r.error);
              }}
            >
              Compliance PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOverlapOpen(true)}
            >
              <Target className="mr-1.5 h-3.5 w-3.5" /> Campaign overlap
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRulesOpen(true)}
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Auto-rules
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTaxonomyOpen(true)}
            >
              <Tag className="mr-1.5 h-3.5 w-3.5" /> Reasons
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/sabsms/webhooks">
                <Webhook className="mr-1.5 h-3.5 w-3.5" /> Webhook
              </a>
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const r = await requestSharedSuppressionList();
                  alert(r.ok ? "ok" : r.error);
                }}
              >
                Shared list
              </Button>
            )}
          </>
        }
      />

      <SabsmsDataTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={bulkActions}
        rowActions={[
          {
            label: "Audit trail",
            icon: <History className="h-3.5 w-3.5" />,
            onSelect: (row) => openAudit(row),
          },
          {
            label: isAdmin ? "Unsuppress" : "Unsuppress (admin only)",
            icon: <Trash2 className="h-3.5 w-3.5" />,
            destructive: true,
            onSelect: (row) => {
              if (!isAdmin) {
                alert("Only admins can unsuppress entries");
                return;
              }
              setUnsupRow(row);
            },
          },
        ]}
        emptyTitle="No suppressed phones"
        emptyDescription="STOP replies, complaints, and manual blocks land here automatically."
      />

      {/* Add block dialog */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add manual block</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Phone number</Label>
              <Input
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                placeholder="e.g. user requested via email"
              />
            </div>
            <div>
              <Label>Auto-expire (days, optional)</Label>
              <Input
                type="number"
                value={addExpiresIn}
                onChange={(e) => setAddExpiresIn(e.target.value ? Number(e.target.value) : "")}
                placeholder="e.g. 30"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setAddBlockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBlock} disabled={!addPhone.trim() || !!busy}>
              {busy ?? "Add"}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Import dialog — SabFiles picker only (no external URLs). */}
      <SabFilePicker
        open={importOpen}
        onOpenChange={setImportOpen}
        onPick={(p) => {
          void handleImport({ url: p.url, name: p.name });
        }}
        accept="document"
        title="Pick a CSV from SabFiles"
      />

      {/* Inline reason editor */}
      <Dialog
        open={!!editingRow}
        onOpenChange={(o) => !o && setEditingRow(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit reason</ZoruDialogTitle>
            <ZoruDialogDescription>
              Reason is shown on audit reports and the row hover preview.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <Textarea
            value={editingReason}
            onChange={(e) => setEditingReason(e.target.value)}
            rows={3}
            placeholder="e.g. user replied STOP after a marketing blast"
          />
          {reasonTaxonomy.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {reasonTaxonomy.map((label) => (
                <Badge
                  key={label}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setEditingReason(label)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          )}
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveReason} disabled={!!busy}>
              {busy ?? "Save"}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Tag editor */}
      <Dialog open={!!tagRow} onOpenChange={(o) => !o && setTagRow(null)}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Set tag</ZoruDialogTitle>
          </ZoruDialogHeader>
          <Input
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            placeholder="e.g. high-risk"
          />
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setTagRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTag} disabled={!!busy}>
              {busy ?? "Save"}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Per-row unsuppress */}
      <Dialog
        open={!!unsupRow}
        onOpenChange={(o) => !o && setUnsupRow(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Unsuppress entry</ZoruDialogTitle>
            <ZoruDialogDescription>
              Audit-trailed — written to the consent log as `opt_in_restart`.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <Textarea
            value={unsupReason}
            onChange={(e) => setUnsupReason(e.target.value)}
            placeholder="Why are you unsuppressing this entry?"
            rows={3}
          />
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setUnsupRow(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnsupOne}
              disabled={!unsupReason.trim() || !!busy}
            >
              {busy ?? "Unsuppress"}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Bulk unsuppress */}
      <Dialog open={bulkUnsupOpen} onOpenChange={setBulkUnsupOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              Bulk unsuppress {selectedIds.length} entries
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Reason is required and written to every entry's audit log.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <Textarea
            value={bulkUnsupReason}
            onChange={(e) => setBulkUnsupReason(e.target.value)}
            placeholder="Why are you unsuppressing this batch?"
            rows={3}
          />
          <ZoruDialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkUnsupOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkUnsup}
              disabled={!bulkUnsupReason.trim() || !!busy}
            >
              {busy ?? "Confirm unsuppress"}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Audit drawer */}
      <SabsmsDetailDrawer
        open={!!auditFor}
        onOpenChange={(o) => !o && setAuditFor(null)}
        title="Audit trail"
        description={
          auditFor
            ? `Phone hash ${auditFor.phoneHash.slice(0, 12)}…`
            : undefined
        }
      >
        {auditLoading ? (
          <p className="text-sm text-[var(--st-text)]">Loading…</p>
        ) : auditEntries.length === 0 ? (
          <p className="text-sm text-[var(--st-text)]">No events recorded yet.</p>
        ) : (
          <ol className="space-y-3">
            {auditEntries.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{e.kind}</Badge>
                  <span className="text-[var(--st-text)]">
                    {formatUTC(e.at, true)}
                  </span>
                </div>
                {e.reason && <p className="mt-1.5 text-[var(--st-text)]">{e.reason}</p>}
                {e.source && (
                  <p className="mt-0.5 text-[var(--st-text)]">source: {e.source}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </SabsmsDetailDrawer>

      {/* Campaign overlap dialog */}
      <Dialog open={overlapOpen} onOpenChange={setOverlapOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Suppression overlap by campaign</ZoruDialogTitle>
            <ZoruDialogDescription>
              How many recipients in a past campaign are currently suppressed.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <Select
            value={overlapCampaignId}
            onValueChange={setOverlapCampaignId}
          >
            <ZoruSelectTrigger>
              <ZoruSelectValue placeholder="Pick a campaign" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {campaigns.map((c) => (
                <ZoruSelectItem key={c.id} value={c.id}>
                  {c.name}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
          {overlapResult && (
            <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm">
              <p>
                <span className="font-medium">{overlapResult.suppressed}</span>{" "}
                of {overlapResult.recipients} recipients are suppressed (
                {overlapResult.pct}%).
              </p>
            </div>
          )}
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setOverlapOpen(false)}>
              Close
            </Button>
            <Button onClick={runOverlap} disabled={!overlapCampaignId || !!busy}>
              {busy ?? "Compute"}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Auto-rules editor */}
      <Dialog open={autoRulesOpen} onOpenChange={setAutoRulesOpen}>
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Auto-suppress rules</ZoruDialogTitle>
            <ZoruDialogDescription>
              Engine auto-blocks a phone once a rule fires.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <AutoRulesEditor initial={autoRules} refresh={refresh} />
        </ZoruDialogContent>
      </Dialog>

      {/* Reason taxonomy editor */}
      <Dialog open={taxonomyOpen} onOpenChange={setTaxonomyOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Reason taxonomy</ZoruDialogTitle>
            <ZoruDialogDescription>
              Reuse a single, sanctioned list of reasons across the team.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <TaxonomyEditor initial={reasonTaxonomy} refresh={refresh} />
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function downloadText(filename: string, contents: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([contents], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AutoRulesEditor({
  initial,
  refresh,
}: {
  initial: AutoSuppressRule[];
  refresh: () => void;
}) {
  const [rules, setRules] = React.useState<AutoSuppressRule[]>(initial);
  const [draft, setDraft] = React.useState<{
    metric: AutoSuppressRule["metric"];
    op: AutoSuppressRule["op"];
    threshold: number;
    windowDays: number;
  }>({ metric: "failure_count", op: "gte", threshold: 3, windowDays: 7 });

  async function save() {
    const res = await upsertAutoSuppressRule({ ...draft, enabled: true });
    if (res.ok) {
      setRules((prev) => [
        ...prev,
        { id: `tmp-${Math.random()}`, enabled: true, ...draft },
      ]);
      refresh();
    } else {
      alert(res.error);
    }
  }

  async function remove(id: string) {
    const res = await deleteAutoSuppressRule({ id });
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== id));
      refresh();
    } else {
      alert(res.error);
    }
  }

  return (
    <div className="space-y-3">
      {rules.length === 0 ? (
        <p className="text-sm text-[var(--st-text)]">No rules configured.</p>
      ) : (
        <ul className="space-y-1.5">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm"
            >
              <span>
                {r.metric} {r.op} {r.threshold} in last {r.windowDays}d
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(r.id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-sm">Add a new rule</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <Label>Metric</Label>
            <Select
              value={draft.metric}
              onValueChange={(v) =>
                setDraft({ ...draft, metric: v as AutoSuppressRule["metric"] })
              }
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="failure_count">Failures</ZoruSelectItem>
                <ZoruSelectItem value="complaint_count">
                  Complaints
                </ZoruSelectItem>
                <ZoruSelectItem value="stop_count">STOP replies</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          <div>
            <Label>Threshold</Label>
            <Input
              type="number"
              value={draft.threshold}
              onChange={(e) =>
                setDraft({ ...draft, threshold: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Window (days)</Label>
            <Input
              type="number"
              value={draft.windowDays}
              onChange={(e) =>
                setDraft({ ...draft, windowDays: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-span-2">
            <Button onClick={save} className="w-full">
              Add rule
            </Button>
          </div>
        </ZoruCardContent>
      </Card>
    </div>
  );
}

function TaxonomyEditor({
  initial,
  refresh,
}: {
  initial: string[];
  refresh: () => void;
}) {
  const [labels, setLabels] = React.useState<string[]>(initial);
  const [draft, setDraft] = React.useState("");

  async function add() {
    if (!draft.trim()) return;
    const res = await addReasonTaxonomy({ label: draft });
    if (res.ok) {
      setLabels((p) => Array.from(new Set([...p, draft.trim()])));
      setDraft("");
      refresh();
    } else {
      alert(res.error);
    }
  }

  async function remove(l: string) {
    const res = await removeReasonTaxonomy({ label: l });
    if (res.ok) {
      setLabels((p) => p.filter((x) => x !== l));
      refresh();
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {labels.map((l) => (
          <li
            key={l}
            className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-1.5 text-sm"
          >
            <span>{l}</span>
            <Button variant="ghost" size="sm" onClick={() => remove(l)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New reason label"
        />
        <Button onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
