"use client";

/**
 * SabSMS suppressions - interactive client surface.
 *
 * Renders the filter bar, data table, bulk actions, import flow, audit
 * drawer, campaign-overlap modal, auto-rules editor, and reason
 * taxonomy editor, all hanging off the data the server page passes in.
 *
 * Every mutation routes through a server action exported from
 * `./actions.ts`.
 */

import * as React from "react";
import { formatUTC, fmtQty, fmtINR } from "@/lib/utils";
import {
  Edit3,
  History,
  ListPlus,
  Settings2,
  ShieldOff,
  Tag as TagIcon,
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
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";

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
  const { toast } = useToast();
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
            {r.phoneHash.slice(0, 12)}...{r.phoneHash.slice(-4)}
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
          <Button
            variant="ghost"
            size="sm"
            iconRight={Edit3}
            onClick={() => {
              setEditingRow(r);
              setEditingReason(r.reason ?? "");
            }}
          >
            {r.reason ?? (
              <span className="italic text-[var(--st-text-secondary)]">add reason</span>
            )}
          </Button>
        ),
      },
      {
        id: "tag",
        header: "Tag",
        render: (r) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTagRow(r);
              setTagValue(r.tag ?? "");
            }}
          >
            {r.tag ?? (
              <span className="italic text-[var(--st-text-secondary)]">+ tag</span>
            )}
          </Button>
        ),
        width: "140px",
      },
      {
        id: "createdAt",
        header: "Added",
        render: (r) => (
          <div>
            <div>{formatUTC(r.createdAt, true)}</div>
            {r.expiresAt && (
              <div className="text-xs text-[var(--st-text-secondary)] mt-0.5">
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
          r.lastTouchedAt ? formatUTC(r.lastTouchedAt, true) : "-",
        width: "150px",
      },
    ],
    [],
  );

  const bulkActions: SabsmsBulkAction<SuppressionRow>[] = React.useMemo(
    () => [
      {
        label: "Unsuppress (admin)",
        icon: <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />,
        destructive: true,
        onSelect: () => setBulkUnsupOpen(true),
      },
      {
        label: "Export selection",
        icon: <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />,
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
    setBusy("Importing...");
    try {
      const res = await bulkImportSuppressions({ sabFileUrl: picked.url });
      if (res.ok) {
        setImportOpen(false);
        toast.success("Suppressions imported");
        refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleAddBlock() {
    if (!addPhone.trim()) return;
    setBusy("Adding...");
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
        toast.success("Block added");
        refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveReason() {
    if (!editingRow) return;
    setBusy("Saving reason...");
    try {
      const res = await updateSuppressionReason({
        id: editingRow.id,
        reason: editingReason,
      });
      if (res.ok) {
        setEditingRow(null);
        toast.success("Reason saved");
        refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveTag() {
    if (!tagRow) return;
    setBusy("Saving tag...");
    try {
      const res = await tagSuppression({ id: tagRow.id, tag: tagValue });
      if (res.ok) {
        setTagRow(null);
        toast.success("Tag saved");
        refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleUnsupOne() {
    if (!unsupRow) return;
    setBusy("Unsuppressing...");
    try {
      const res = await unsuppressOne({
        id: unsupRow.id,
        reason: unsupReason,
      });
      if (res.ok) {
        setUnsupRow(null);
        setUnsupReason("");
        toast.success("Entry unsuppressed");
        refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleBulkUnsup() {
    setBusy("Unsuppressing selection...");
    try {
      const res = await bulkUnsuppress({
        ids: selectedIds,
        reason: bulkUnsupReason,
      });
      if (res.ok) {
        setBulkUnsupOpen(false);
        setBulkUnsupReason("");
        setSelectedIds([]);
        toast.success("Selection unsuppressed");
        refresh();
      } else {
        toast.error(res.error);
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
    setBusy("Computing overlap...");
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
    // Privacy-safe export, only the hash column, no reasons / tags.
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
          delta={{
            value: `${fmtQty(coverage.suppressed)} of ${fmtQty(coverage.workspaceContacts)} contacts`,
            tone: "neutral",
          }}
        />
        <StatCard
          label="Total suppressed"
          value={fmtQty(total)}
          delta={{ value: "all sources", tone: "neutral" }}
        />
        <StatCard
          label="Cost avoided 24h"
          value={fmtINR(costAvoidedUsd, "USD")}
          delta={{ value: "messages auto-blocked", tone: "neutral" }}
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
              iconLeft={ListPlus}
              onClick={() => setImportOpen(true)}
            >
              Import
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
                if (r.ok) toast.success("Compliance PDF ready");
                else toast.error(r.error);
              }}
            >
              Compliance PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={Target}
              onClick={() => setOverlapOpen(true)}
            >
              Campaign overlap
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={Settings2}
              onClick={() => setAutoRulesOpen(true)}
            >
              Auto-rules
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={TagIcon}
              onClick={() => setTaxonomyOpen(true)}
            >
              Reasons
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={Webhook}
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/sabsms/webhooks";
                }
              }}
            >
              Webhook
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const r = await requestSharedSuppressionList();
                  if (r.ok) toast.success("Shared list requested");
                  else toast.error(r.error);
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
            icon: <History className="h-3.5 w-3.5" aria-hidden="true" />,
            onSelect: (row) => openAudit(row),
          },
          {
            label: isAdmin ? "Unsuppress" : "Unsuppress (admin only)",
            icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
            destructive: true,
            onSelect: (row) => {
              if (!isAdmin) {
                toast.error("Only admins can unsuppress entries");
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add manual block</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Phone number">
              <Input
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </Field>
            <Field label="Reason (optional)">
              <Input
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                placeholder="e.g. user requested via email"
              />
            </Field>
            <Field label="Auto-expire (days, optional)">
              <Input
                type="number"
                value={addExpiresIn}
                onChange={(e) =>
                  setAddExpiresIn(e.target.value ? Number(e.target.value) : "")
                }
                placeholder="e.g. 30"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBlockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBlock} disabled={!addPhone.trim() || !!busy}>
              {busy ?? "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog, SabFiles picker only (no external URLs). */}
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
      <Dialog open={!!editingRow} onOpenChange={(o) => !o && setEditingRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit reason</DialogTitle>
            <DialogDescription>
              Reason is shown on audit reports and the row hover preview.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveReason} disabled={!!busy}>
              {busy ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag editor */}
      <Dialog open={!!tagRow} onOpenChange={(o) => !o && setTagRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set tag</DialogTitle>
          </DialogHeader>
          <Field label="Tag">
            <Input
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              placeholder="e.g. high-risk"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTag} disabled={!!busy}>
              {busy ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-row unsuppress */}
      <Dialog open={!!unsupRow} onOpenChange={(o) => !o && setUnsupRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsuppress entry</DialogTitle>
            <DialogDescription>
              Audit-trailed, written to the consent log as `opt_in_restart`.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={unsupReason}
            onChange={(e) => setUnsupReason(e.target.value)}
            placeholder="Why are you unsuppressing this entry?"
            rows={3}
          />
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk unsuppress */}
      <Dialog open={bulkUnsupOpen} onOpenChange={setBulkUnsupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk unsuppress {selectedIds.length} entries</DialogTitle>
            <DialogDescription>
              Reason is required and written to every entry&apos;s audit log.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={bulkUnsupReason}
            onChange={(e) => setBulkUnsupReason(e.target.value)}
            placeholder="Why are you unsuppressing this batch?"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkUnsupOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkUnsup}
              disabled={!bulkUnsupReason.trim() || !!busy}
            >
              {busy ?? "Confirm unsuppress"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit drawer */}
      <SabsmsDetailDrawer
        open={!!auditFor}
        onOpenChange={(o) => !o && setAuditFor(null)}
        title="Audit trail"
        description={
          auditFor ? `Phone hash ${auditFor.phoneHash.slice(0, 12)}...` : undefined
        }
      >
        {auditLoading ? (
          <p className="text-sm text-[var(--st-text-secondary)]">Loading...</p>
        ) : auditEntries.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            No events recorded yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {auditEntries.map((e) => (
              <li
                key={e.id}
                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{e.kind}</Badge>
                  <span className="text-[var(--st-text-secondary)]">
                    {formatUTC(e.at, true)}
                  </span>
                </div>
                {e.reason && (
                  <p className="mt-1.5 text-[var(--st-text)]">{e.reason}</p>
                )}
                {e.source && (
                  <p className="mt-0.5 text-[var(--st-text-secondary)]">
                    source: {e.source}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </SabsmsDetailDrawer>

      {/* Campaign overlap dialog */}
      <Dialog open={overlapOpen} onOpenChange={setOverlapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suppression overlap by campaign</DialogTitle>
            <DialogDescription>
              How many recipients in a past campaign are currently suppressed.
            </DialogDescription>
          </DialogHeader>
          <Select value={overlapCampaignId} onValueChange={setOverlapCampaignId}>
            <SelectTrigger aria-label="Campaign">
              <SelectValue placeholder="Pick a campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {overlapResult && (
            <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-sm text-[var(--st-text)]">
              <p>
                <span className="font-medium">{overlapResult.suppressed}</span> of{" "}
                {overlapResult.recipients} recipients are suppressed (
                {overlapResult.pct}%).
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverlapOpen(false)}>
              Close
            </Button>
            <Button onClick={runOverlap} disabled={!overlapCampaignId || !!busy}>
              {busy ?? "Compute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-rules editor */}
      <Dialog open={autoRulesOpen} onOpenChange={setAutoRulesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Auto-suppress rules</DialogTitle>
            <DialogDescription>
              Engine auto-blocks a phone once a rule fires.
            </DialogDescription>
          </DialogHeader>
          <AutoRulesEditor initial={autoRules} refresh={refresh} />
        </DialogContent>
      </Dialog>

      {/* Reason taxonomy editor */}
      <Dialog open={taxonomyOpen} onOpenChange={setTaxonomyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason taxonomy</DialogTitle>
            <DialogDescription>
              Reuse a single, sanctioned list of reasons across the team.
            </DialogDescription>
          </DialogHeader>
          <TaxonomyEditor initial={reasonTaxonomy} refresh={refresh} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Helpers --------------------------------------------------------------

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
  const { toast } = useToast();
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
      toast.success("Rule added");
      refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove(id: string) {
    const res = await deleteAutoSuppressRule({ id });
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Rule deleted");
      refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-3">
      {rules.length === 0 ? (
        <p className="text-sm text-[var(--st-text-secondary)]">
          No rules configured.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-sm text-[var(--st-text)]"
            >
              <span>
                {r.metric} {r.op} {r.threshold} in last {r.windowDays}d
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add a new rule</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-2 text-sm">
          <Field label="Metric">
            <Select
              value={draft.metric}
              onValueChange={(v) =>
                setDraft({ ...draft, metric: v as AutoSuppressRule["metric"] })
              }
            >
              <SelectTrigger aria-label="Metric">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="failure_count">Failures</SelectItem>
                <SelectItem value="complaint_count">Complaints</SelectItem>
                <SelectItem value="stop_count">STOP replies</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Threshold">
            <Input
              type="number"
              value={draft.threshold}
              onChange={(e) =>
                setDraft({ ...draft, threshold: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Window (days)">
            <Input
              type="number"
              value={draft.windowDays}
              onChange={(e) =>
                setDraft({ ...draft, windowDays: Number(e.target.value) })
              }
            />
          </Field>
          <div className="col-span-2">
            <Button onClick={save} block>
              Add rule
            </Button>
          </div>
        </CardBody>
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
  const { toast } = useToast();
  const [labels, setLabels] = React.useState<string[]>(initial);
  const [draft, setDraft] = React.useState("");

  async function add() {
    if (!draft.trim()) return;
    const res = await addReasonTaxonomy({ label: draft });
    if (res.ok) {
      setLabels((p) => Array.from(new Set([...p, draft.trim()])));
      setDraft("");
      toast.success("Reason added");
      refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove(l: string) {
    const res = await removeReasonTaxonomy({ label: l });
    if (res.ok) {
      setLabels((p) => p.filter((x) => x !== l));
      toast.success("Reason removed");
      refresh();
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {labels.map((l) => (
          <li
            key={l}
            className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-1.5 text-sm text-[var(--st-text)]"
          >
            <span>{l}</span>
            <Button variant="ghost" size="sm" onClick={() => remove(l)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Field label="New reason label" className="flex-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New reason label"
          />
        </Field>
        <Button onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
