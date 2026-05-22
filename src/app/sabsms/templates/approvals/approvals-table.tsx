"use client";

/**
 * SabSMS approval queue — client table for Page 11.
 *
 * Owns interactivity: reviewer assignment, approve/reject dialogs with
 * required notes, bulk approve-by-category, flag-for-compliance, the
 * side-by-side diff drawer, the rotation config + taxonomy editor (both
 * persisted in localStorage), and the export menus.
 *
 * Server mutations live in `./actions.ts`. After every write we
 * `router.refresh()` so the server component re-runs.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  GitCompareArrows,
  ListChecks,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";

import {
  SabsmsBulkActionsBar,
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsRefreshButton,
  SabsmsSavedViews,
  type SabsmsColumn,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";
import {
  Badge,
  Button,
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
  Switch,
  Textarea,
  useZoruToast,
} from "@/components/zoruui";

import {
  approveTemplate,
  assignReviewer,
  bulkApproveByCategory,
  exportApprovedBundle,
  exportDecisionLog,
  flagForCompliance,
  loadApprovalDetail,
  rejectTemplate,
  resubmitAfterRejection,
  type ApprovalDecisionRecord,
  type ApprovalRow,
} from "./actions";

interface ApprovalsTableProps {
  workspaceId: string;
  initialRows: ApprovalRow[];
  perCategoryAvg: Array<{
    category: ApprovalRow["category"];
    minutes: number;
    decisions: number;
  }>;
}

interface RotationConfig {
  reviewers: string[];
  nextIndex: number;
}

interface AutoApproveConfig {
  /** Per-category toggle for the rule-based auto-approve advisory. */
  enabled: Partial<Record<ApprovalRow["category"], boolean>>;
}

const ROTATION_KEY = "sabsms:approvals:rotation";
const AUTO_APPROVE_KEY = "sabsms:approvals:autoApprove";
const TAXONOMY_KEY = "sabsms:approvals:rejectReasons";

const DEFAULT_REJECT_REASONS = [
  { code: "spam", label: "Spam triggers" },
  { code: "compliance", label: "Compliance violation" },
  { code: "missing-vars", label: "Undeclared variables" },
  { code: "duplicate", label: "Duplicate of existing template" },
];

const CATEGORY_OPTIONS = [
  { value: "transactional", label: "Transactional" },
  { value: "otp", label: "OTP" },
  { value: "marketing", label: "Marketing" },
  { value: "alert", label: "Alert" },
  { value: "service", label: "Service" },
];

const AGE_OPTIONS = [
  { value: "lt_1h", label: "< 1h" },
  { value: "lt_24h", label: "1h - 24h" },
  { value: "lt_7d", label: "1d - 7d" },
  { value: "older", label: "Older" },
];

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatRemaining(ms: number | null): string {
  if (ms === null) return "—";
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  return `${sign}${hours}h ${minutes}m`;
}

export function ApprovalsTable({
  workspaceId: _workspaceId,
  initialRows,
  perCategoryAvg,
}: ApprovalsTableProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [decisionFor, setDecisionFor] = React.useState<
    | { id: string; name: string; kind: "approved" | "rejected" }
    | null
  >(null);
  const [decisionNotes, setDecisionNotes] = React.useState("");
  const [reasonCode, setReasonCode] = React.useState("");
  const [diffFor, setDiffFor] = React.useState<string | null>(null);
  const [diffData, setDiffData] = React.useState<
    Awaited<ReturnType<typeof loadApprovalDetail>> | null
  >(null);
  const [diffLoading, setDiffLoading] = React.useState(false);
  const [bulkCategory, setBulkCategory] = React.useState<
    ApprovalRow["category"] | null
  >(null);
  const [bulkNotes, setBulkNotes] = React.useState("");
  const [rotation, setRotation] = React.useState<RotationConfig>({
    reviewers: ["reviewer.alice", "reviewer.bob", "reviewer.carol"],
    nextIndex: 0,
  });
  const [autoApprove, setAutoApprove] = React.useState<AutoApproveConfig>({
    enabled: {},
  });
  const [reasons, setReasons] = React.useState(DEFAULT_REJECT_REASONS);
  const [rotationOpen, setRotationOpen] = React.useState(false);
  const [taxonomyOpen, setTaxonomyOpen] = React.useState(false);
  const [newReasonLabel, setNewReasonLabel] = React.useState("");
  const [newReviewer, setNewReviewer] = React.useState("");
  const [auditOpenFor, setAuditOpenFor] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRotation(
      loadJson<RotationConfig>(ROTATION_KEY, {
        reviewers: ["reviewer.alice", "reviewer.bob", "reviewer.carol"],
        nextIndex: 0,
      }),
    );
    setAutoApprove(
      loadJson<AutoApproveConfig>(AUTO_APPROVE_KEY, { enabled: {} }),
    );
    setReasons(loadJson(TAXONOMY_KEY, DEFAULT_REJECT_REASONS));
  }, []);

  function notify(
    res: { ok: true } | { ok: false; error: string },
    okMessage: string,
  ) {
    if (res.ok) {
      toast({ title: okMessage });
      router.refresh();
    } else {
      toast({
        title: "Action failed",
        description: res.error,
        variant: "destructive",
      });
    }
  }

  function openDecision(
    id: string,
    name: string,
    kind: "approved" | "rejected",
  ) {
    setDecisionFor({ id, name, kind });
    setDecisionNotes("");
    setReasonCode(kind === "rejected" ? reasons[0]?.code ?? "" : "");
  }

  async function submitDecision() {
    if (!decisionFor) return;
    if (decisionFor.kind === "approved") {
      const res = await approveTemplate({
        id: decisionFor.id,
        notes: decisionNotes,
      });
      notify(res, `Approved "${decisionFor.name}"`);
    } else {
      const res = await rejectTemplate({
        id: decisionFor.id,
        notes: decisionNotes,
        reasonCode,
      });
      notify(res, `Rejected "${decisionFor.name}"`);
    }
    setDecisionFor(null);
  }

  async function handleAssign(row: ApprovalRow) {
    const reviewer =
      rotation.reviewers[rotation.nextIndex % rotation.reviewers.length] ?? null;
    if (!reviewer) {
      toast({
        title: "No reviewers in rotation",
        description: "Add reviewers in the rotation config first.",
      });
      return;
    }
    const res = await assignReviewer({ id: row.id, reviewerId: reviewer });
    if (res.ok) {
      const next = {
        ...rotation,
        nextIndex: (rotation.nextIndex + 1) % rotation.reviewers.length,
      };
      setRotation(next);
      saveJson(ROTATION_KEY, next);
    }
    notify(res, `Assigned to ${reviewer}`);
  }

  async function handleFlag(row: ApprovalRow) {
    const res = await flagForCompliance({ id: row.id, flagged: true });
    notify(res, `Flagged "${row.name}" for compliance`);
  }

  async function handleResubmit(row: ApprovalRow) {
    const res = await resubmitAfterRejection(row.id);
    notify(res, `Resubmitted "${row.name}"`);
  }

  async function openDiff(row: ApprovalRow) {
    setDiffFor(row.id);
    setDiffLoading(true);
    setDiffData(null);
    try {
      const detail = await loadApprovalDetail(row.id);
      setDiffData(detail);
    } finally {
      setDiffLoading(false);
    }
  }

  async function bulkApprove() {
    if (!bulkCategory) return;
    const res = await bulkApproveByCategory({
      category: bulkCategory,
      notes: bulkNotes,
    });
    if (res.ok) {
      toast({
        title: `Approved ${res.count ?? 0} templates in ${bulkCategory}`,
      });
      router.refresh();
    } else {
      toast({
        title: "Bulk approve failed",
        description: res.error,
        variant: "destructive",
      });
    }
    setBulkCategory(null);
    setBulkNotes("");
  }

  function addReason() {
    const label = newReasonLabel.trim();
    if (!label) return;
    const code = label.toLowerCase().replace(/\s+/g, "-").slice(0, 40);
    if (reasons.some((r) => r.code === code)) return;
    const next = [...reasons, { code, label }];
    setReasons(next);
    saveJson(TAXONOMY_KEY, next);
    setNewReasonLabel("");
  }

  function removeReason(code: string) {
    const next = reasons.filter((r) => r.code !== code);
    setReasons(next);
    saveJson(TAXONOMY_KEY, next);
  }

  function addReviewer() {
    const id = newReviewer.trim();
    if (!id) return;
    if (rotation.reviewers.includes(id)) return;
    const next = { ...rotation, reviewers: [...rotation.reviewers, id] };
    setRotation(next);
    saveJson(ROTATION_KEY, next);
    setNewReviewer("");
  }

  function removeReviewer(id: string) {
    const next = {
      reviewers: rotation.reviewers.filter((r) => r !== id),
      nextIndex: 0,
    };
    setRotation(next);
    saveJson(ROTATION_KEY, next);
  }

  function toggleAutoApprove(category: ApprovalRow["category"]) {
    const next = {
      enabled: {
        ...autoApprove.enabled,
        [category]: !autoApprove.enabled[category],
      },
    };
    setAutoApprove(next);
    saveJson(AUTO_APPROVE_KEY, next);
  }

  const columns: SabsmsColumn<ApprovalRow>[] = [
    {
      id: "name",
      header: "Template",
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-slate-900">{row.name}</span>
          <span className="line-clamp-2 max-w-[420px] text-xs text-slate-500">
            {row.bodyPreview}
          </span>
          {row.undeclaredVariables.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-rose-700">
              <ShieldAlert className="h-3 w-3" />
              Undeclared: {row.undeclaredVariables.join(", ")}
            </span>
          )}
        </div>
      ),
      width: "360px",
    },
    {
      id: "category",
      header: "Category",
      render: (row) => (
        <span className="text-xs uppercase text-slate-600">{row.category}</span>
      ),
      width: "120px",
    },
    {
      id: "sla",
      header: "SLA",
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span
            className={`inline-flex items-center gap-1 text-xs ${
              row.slaBreached ? "text-rose-700" : "text-slate-700"
            }`}
          >
            <Clock className="h-3 w-3" />
            {formatRemaining(row.slaRemainingMs)}
          </span>
          {row.slaBreached && (
            <ZoruBadge variant="destructive" className="w-fit text-[10px]">
              Breached
            </ZoruBadge>
          )}
        </div>
      ),
      width: "120px",
    },
    {
      id: "compliance",
      header: "Compliance",
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span
            className={`text-xs font-mono ${
              row.complianceScore >= 70
                ? "text-emerald-700"
                : row.complianceScore >= 40
                  ? "text-amber-700"
                  : "text-rose-700"
            }`}
          >
            {row.complianceScore}/100
          </span>
        </div>
      ),
      width: "120px",
    },
    {
      id: "ai",
      header: "AI verdict",
      render: (row) => (
        <ZoruBadge
          variant={
            row.aiVerdict.recommendation === "approve"
              ? "default"
              : row.aiVerdict.recommendation === "reject"
                ? "destructive"
                : "outline"
          }
          className="gap-1"
        >
          <Sparkles className="h-3 w-3" />
          {row.aiVerdict.recommendation}
        </ZoruBadge>
      ),
      width: "120px",
    },
    {
      id: "reviewer",
      header: "Reviewer",
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.reviewerId ?? <em className="text-slate-400">unassigned</em>}
        </span>
      ),
      width: "140px",
    },
    {
      id: "submittedAt",
      header: "Submitted",
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.submittedAt
            ? new Date(row.submittedAt).toLocaleString()
            : "—"}
        </span>
      ),
      width: "160px",
    },
  ];

  const rowActions: SabsmsRowAction<ApprovalRow>[] = [
    {
      label: "Approve…",
      icon: <CheckCircle2 className="h-4 w-4" />,
      onSelect: (row) => openDecision(row.id, row.name, "approved"),
    },
    {
      label: "Reject…",
      icon: <XCircle className="h-4 w-4" />,
      destructive: true,
      onSelect: (row) => openDecision(row.id, row.name, "rejected"),
    },
    {
      label: "Assign from rotation",
      icon: <UserCheck className="h-4 w-4" />,
      onSelect: handleAssign,
    },
    {
      label: "Flag for compliance",
      icon: <Flag className="h-4 w-4" />,
      onSelect: handleFlag,
    },
    {
      label: "View diff vs previous approved",
      icon: <GitCompareArrows className="h-4 w-4" />,
      onSelect: openDiff,
    },
    {
      label: "Resubmit (if rejected)",
      icon: <RefreshCcw className="h-4 w-4" />,
      onSelect: handleResubmit,
    },
    {
      label: "Decision history",
      icon: <ListChecks className="h-4 w-4" />,
      onSelect: (row) => setAuditOpenFor(row.id),
    },
  ];

  const auditFor = React.useMemo(
    () => initialRows.find((r) => r.id === auditOpenFor) ?? null,
    [initialRows, auditOpenFor],
  );

  return (
    <div className="space-y-4">
      <SabsmsFilterBar
        searchPlaceholder="Search by name or body…"
        facets={[
          {
            key: "category",
            label: "Category",
            options: CATEGORY_OPTIONS,
            multi: true,
          },
          { key: "age", label: "Age", options: AGE_OPTIONS },
        ]}
        sortOptions={[
          { value: "oldest", label: "Oldest first (SLA priority)" },
          { value: "newest", label: "Newest first" },
        ]}
        defaultSort="oldest"
        trailing={
          <>
            <SabsmsSavedViews scope="templates.approvals" />
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => setRotationOpen(true)}
            >
              <UserCheck className="mr-1.5 h-3.5 w-3.5" />
              Rotation
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => setTaxonomyOpen(true)}
            >
              <ListChecks className="mr-1.5 h-3.5 w-3.5" />
              Reasons
            </ZoruButton>
            <SabsmsExportMenu
              filename="sabsms-approvals"
              toCsv={async () => {
                const res = await exportDecisionLog();
                return res.ok ? res.csv : "";
              }}
              toJson={async () => {
                const res = await exportApprovedBundle();
                return res.ok ? res.json : "{}";
              }}
            />
            <SabsmsRefreshButton
              onRefresh={() => router.refresh()}
              defaultInterval={60}
            />
          </>
        }
      />

      {/* Approver permission audit (feature 18) — surfaces the current
          session as the de-facto reviewer until RBAC ships. */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <UserCheck className="h-3.5 w-3.5" />
        <span>
          Reviewing as this workspace. Cross-workspace admin scope is
          gated behind an admin RBAC helper (not yet shipped).
        </span>
        <div className="ml-auto flex items-center gap-3">
          {CATEGORY_OPTIONS.map((c) => (
            <label
              key={c.value}
              className="flex items-center gap-1.5 text-xs text-slate-600"
            >
              <ZoruSwitch
                checked={
                  autoApprove.enabled[c.value as ApprovalRow["category"]] ?? false
                }
                onCheckedChange={() =>
                  toggleAutoApprove(c.value as ApprovalRow["category"])
                }
                aria-label={`Auto-approve ${c.label}`}
              />
              <span>Auto-approve {c.label}</span>
            </label>
          ))}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <SabsmsBulkActionsBar<ApprovalRow>
          selectedCount={selectedIds.length}
          totalCount={initialRows.length}
          rows={initialRows.filter((r) => selectedIds.includes(r.id))}
          actions={[
            {
              label: "Bulk approve same-category",
              icon: <CheckCircle2 className="h-4 w-4" />,
              onSelect: (rows) => {
                const cats = new Set(rows.map((r) => r.category));
                if (cats.size !== 1) {
                  toast({
                    title: "Pick a single category",
                    description: "Bulk approve requires same-category rows.",
                  });
                  return;
                }
                const [cat] = Array.from(cats);
                setBulkCategory(cat);
                setBulkNotes("Bulk approve via reviewer queue");
              },
            },
          ]}
          onClear={() => setSelectedIds([])}
        />
      )}

      <SabsmsDataTable<ApprovalRow>
        rows={initialRows}
        columns={columns}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyTitle="Inbox zero"
        emptyDescription="No pending submissions. Approved decisions appear in /sabsms/templates."
        emptyIcon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
      />

      {perCategoryAvg.length > 0 && (
        <section className="rounded-md border border-slate-200 bg-white p-3 text-xs">
          <p className="mb-2 font-medium text-slate-700">
            Avg time-to-approval (last 30d)
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {perCategoryAvg.map((c) => (
              <div
                key={c.category}
                className="rounded-md border border-slate-200 p-2"
              >
                <p className="uppercase text-slate-500">{c.category}</p>
                <p className="font-mono text-base text-slate-800">
                  {c.minutes} min
                </p>
                <p className="text-[10px] text-slate-500">
                  {c.decisions} decisions
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Decision dialog */}
      <ZoruDialog
        open={decisionFor !== null}
        onOpenChange={(open) => !open && setDecisionFor(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {decisionFor?.kind === "approved" ? "Approve" : "Reject"} ·{" "}
              {decisionFor?.name}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Reviewer notes are required and are saved into the decision
              trail.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            {decisionFor?.kind === "rejected" && (
              <div className="space-y-2">
                <ZoruLabel>Reason</ZoruLabel>
                <ZoruSelect value={reasonCode} onValueChange={setReasonCode}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Pick a reason" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {reasons.map((r) => (
                      <ZoruSelectItem key={r.code} value={r.code}>
                        {r.label}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            )}
            <div className="space-y-2">
              <ZoruLabel htmlFor="decision-notes">Notes</ZoruLabel>
              <ZoruTextarea
                id="decision-notes"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={
                  decisionFor?.kind === "approved"
                    ? "Looks good. DLT id verified."
                    : "Body uses 'FREE' which is a marketing trigger…"
                }
                className="min-h-[120px]"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton
              variant="outline"
              onClick={() => setDecisionFor(null)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              variant={
                decisionFor?.kind === "rejected" ? "destructive" : "default"
              }
              onClick={submitDecision}
              disabled={!decisionNotes.trim()}
            >
              {decisionFor?.kind === "approved" ? "Approve" : "Reject"}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Diff drawer */}
      <SabsmsDetailDrawer
        open={diffFor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDiffFor(null);
            setDiffData(null);
          }
        }}
        title="Side-by-side diff"
        description={
          diffData?.hasPreviousApproved
            ? "Comparing current submission against the last approved version."
            : "No previously approved version on record."
        }
      >
        {diffLoading ? (
          <p className="text-sm text-slate-500">Loading diff…</p>
        ) : diffData ? (
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                Diff
              </h3>
              <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed">
                {diffData.diff.map((seg, i) => (
                  <span
                    key={i}
                    className={
                      seg.kind === "ins"
                        ? "rounded bg-emerald-100 text-emerald-900"
                        : seg.kind === "del"
                          ? "rounded bg-rose-100 text-rose-900 line-through"
                          : ""
                    }
                  >
                    {seg.text}
                  </span>
                ))}
              </pre>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                AI advisory
              </h3>
              <p className="text-sm text-slate-600">
                {diffData.row.aiVerdict.rationale} (
                {Math.round(diffData.row.aiVerdict.confidence * 100)}%
                confidence)
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Compliance score: {diffData.row.complianceScore}/100
              </p>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                Decision trail
              </h3>
              <DecisionList decisions={diffData.decisions} />
            </section>
          </div>
        ) : null}
      </SabsmsDetailDrawer>

      {/* Audit drawer */}
      <SabsmsDetailDrawer
        open={auditOpenFor !== null}
        onOpenChange={(open) => !open && setAuditOpenFor(null)}
        title={auditFor ? `Decision history · ${auditFor.name}` : "History"}
      >
        <AuditFetcher id={auditOpenFor} />
      </SabsmsDetailDrawer>

      {/* Bulk approve dialog */}
      <ZoruDialog
        open={bulkCategory !== null}
        onOpenChange={(open) => !open && setBulkCategory(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              Bulk approve every submitted "{bulkCategory}" template
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Applies the same reviewer notes to every submission in the
              category.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruTextarea
            value={bulkNotes}
            onChange={(e) => setBulkNotes(e.target.value)}
            placeholder="Notes applied to every approval…"
            className="min-h-[100px]"
          />
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setBulkCategory(null)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={bulkApprove} disabled={!bulkNotes.trim()}>
              Approve all
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Rotation config */}
      <ZoruDialog open={rotationOpen} onOpenChange={setRotationOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Reviewer rotation</ZoruDialogTitle>
            <ZoruDialogDescription>
              Saved locally for now. When a real reviewers collection
              lands, this list will sync to Mongo.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-2">
            {rotation.reviewers.map((r) => (
              <div
                key={r}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2 text-sm"
              >
                <span className="font-mono text-xs">{r}</span>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => removeReviewer(r)}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Remove
                </ZoruButton>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <ZoruInput
                value={newReviewer}
                onChange={(e) => setNewReviewer(e.target.value)}
                placeholder="reviewer.dave"
              />
              <ZoruButton onClick={addReviewer}>Add</ZoruButton>
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton onClick={() => setRotationOpen(false)}>Done</ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Taxonomy editor */}
      <ZoruDialog open={taxonomyOpen} onOpenChange={setTaxonomyOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Reject reasons taxonomy</ZoruDialogTitle>
            <ZoruDialogDescription>
              Reasons appear in the reject dialog and feed the decision
              log export.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-2">
            {reasons.map((r) => (
              <div
                key={r.code}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2 text-sm"
              >
                <div>
                  <p className="font-medium">{r.label}</p>
                  <p className="font-mono text-[10px] text-slate-500">{r.code}</p>
                </div>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => removeReason(r.code)}
                >
                  <AlertTriangle className="mr-1 h-3 w-3" /> Remove
                </ZoruButton>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <ZoruInput
                value={newReasonLabel}
                onChange={(e) => setNewReasonLabel(e.target.value)}
                placeholder="Length exceeds 1000 chars"
              />
              <ZoruButton onClick={addReason}>Add</ZoruButton>
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton onClick={() => setTaxonomyOpen(false)}>Done</ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}

function DecisionList({ decisions }: { decisions: ApprovalDecisionRecord[] }) {
  if (decisions.length === 0) {
    return <p className="text-sm text-slate-500">No prior decisions.</p>;
  }
  return (
    <ol className="space-y-2">
      {decisions.map((d) => (
        <li
          key={d.id}
          className="rounded-md border border-slate-200 p-2 text-sm"
        >
          <div className="flex items-center gap-2">
            <ZoruBadge
              variant={
                d.kind === "approved"
                  ? "default"
                  : d.kind === "rejected"
                    ? "destructive"
                    : "outline"
              }
            >
              {d.kind}
            </ZoruBadge>
            <span className="text-xs text-slate-500">
              {new Date(d.at).toLocaleString()} · {d.reviewerId}
            </span>
          </div>
          <p className="mt-1 text-slate-700">{d.notes}</p>
          {d.reasonCode && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              code: {d.reasonCode}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function AuditFetcher({ id }: { id: string | null }) {
  const [decisions, setDecisions] = React.useState<ApprovalDecisionRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    loadApprovalDetail(id)
      .then((data) => {
        if (cancelled) return;
        setDecisions(data?.decisions ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  return <DecisionList decisions={decisions} />;
}
