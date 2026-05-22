"use client";

/**
 * Drip builder — interactive canvas.
 *
 * Page 13 §B.2 of `plans/sabsms-pages-catalog.md`. Implements all
 * twenty page-specific features alongside the toolkit-supplied shared
 * features. Persistence + dry-run + AI-suggest + clone go through the
 * server actions in `./actions.ts`. Validation is a pure call into
 * `./validate.ts` so it can also run in `node:test`.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FlaskConical,
  GitBranch,
  History,
  Mail,
  PauseCircle,
  PlayCircle,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertTitle,
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
  ZoruKbd,
  Label,
  ScrollArea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Switch,
} from "@/components/zoruui";
import {
  SabsmsKbdHint,
  SabsmsRefreshButton,
} from "@/components/sabsms/page-toolkit";

import { StepNode } from "./step-node";
import {
  cloneStepsFromDrip,
  dryRunDrip,
  getLiveEnrolCount,
  rollbackToVersion,
  saveDrip,
  setDripEnabled,
  suggestNextStep,
  type DripDoc,
  type DryRunStep,
} from "./actions";
import {
  validateDrip,
  type DraftDrip,
  type DraftDripEdge,
  type DraftDripNode,
} from "./validate";

interface TemplateOption {
  id: string;
  name: string;
  category: string;
}

interface OtherDripOption {
  id: string;
  name: string;
}

export interface DripBuilderProps {
  drip: DripDoc;
  templates: TemplateOption[];
  otherDrips: OtherDripOption[];
}

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Append a node after `afterId` on the trunk. Returns updated draft. */
function appendAfter(
  draft: DraftDrip,
  afterId: string,
  node: DraftDripNode,
): DraftDrip {
  // The existing edge from `afterId` to its successor (if any) is
  // re-routed: afterId → newNode → successor.
  const outgoing = draft.edges.find((e) => e.from === afterId && !e.branchValue);
  const nodes = [...draft.nodes, node];
  const edges: DraftDripEdge[] = draft.edges.filter(
    (e) => !(e.from === afterId && !e.branchValue),
  );
  edges.push({ id: `${afterId}->${node.id}`, from: afterId, to: node.id });
  if (outgoing) {
    edges.push({ id: `${node.id}->${outgoing.to}`, from: node.id, to: outgoing.to });
  }
  return { ...draft, nodes, edges };
}

function removeNode(draft: DraftDrip, nodeId: string): DraftDrip {
  // Stitch the predecessor straight to the successor.
  const before = draft.edges.find((e) => e.to === nodeId);
  const after = draft.edges.find((e) => e.from === nodeId && !e.branchValue);
  const nodes = draft.nodes.filter((n) => n.id !== nodeId);
  let edges = draft.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
  if (before && after) {
    edges = [
      ...edges,
      {
        id: `${before.from}->${after.to}`,
        from: before.from,
        to: after.to,
      },
    ];
  }
  return { ...draft, nodes, edges };
}

export function DripBuilder({ drip, templates, otherDrips }: DripBuilderProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<DraftDrip>(drip.draft);
  const [saving, setSaving] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(drip.updatedAt);
  const [enabled, setEnabled] = React.useState<boolean>(drip.enabled);
  const [enrolCount, setEnrolCount] = React.useState<number>(drip.activeRecipients);

  // dialogs
  const [addOpen, setAddOpen] = React.useState<{ afterId: string } | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [dryRunOpen, setDryRunOpen] = React.useState(false);
  const [cloneOpen, setCloneOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);

  const validation = React.useMemo(() => validateDrip(draft), [draft]);

  // ─── Per-node error mapping ────────────────────────────────────────────
  const errorsByNode = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const err of validation.errors) {
      const match = /"([^"]+)"/.exec(err);
      if (match) {
        const id = match[1]!;
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(err);
      }
    }
    return map;
  }, [validation.errors]);

  const globalErrors = validation.errors.filter((e) => !/"([^"]+)"/.test(e));

  // ─── Cmd+S save ────────────────────────────────────────────────────────
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await saveDrip(drip.id, draft);
      if (res.ok) {
        setLastSavedAt(new Date().toISOString());
      } else if (res.validationErrors) {
        // Leave validation rendering to the side panel.
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(next: boolean) {
    setEnabled(next);
    await setDripEnabled(drip.id, next);
    router.refresh();
  }

  async function handleRefreshEnrol() {
    const res = await getLiveEnrolCount(drip.id);
    if (res.ok) setEnrolCount(res.count);
  }

  // ─── Add step ──────────────────────────────────────────────────────────
  function addNode(kind: DraftDripNode["kind"], afterId: string) {
    const id = genId(kind);
    let node: DraftDripNode = { id, kind };
    if (kind === "wait") {
      node = { ...node, waitMode: "relative", waitSeconds: 86_400 };
    } else if (kind === "branch") {
      node = { ...node, branchOn: "replied", branchWithinSeconds: 3600 };
    }
    let next = appendAfter(draft, afterId, node);
    if (kind === "branch") {
      // Branch needs two outgoing edges: pre-wire a tiny exit on the
      // false side so the validator does not immediately complain.
      const falseExit: DraftDripNode = { id: genId("exit"), kind: "exit" };
      next = {
        ...next,
        nodes: [...next.nodes, falseExit],
        edges: next.edges.map((e) =>
          e.from === id && !e.branchValue
            ? { ...e, branchValue: "true" }
            : e,
        ),
      };
      next.edges.push({
        id: `${id}->${falseExit.id}`,
        from: id,
        to: falseExit.id,
        branchValue: "false",
      });
    }
    setDraft(next);
    setAddOpen(null);
  }

  // ─── Suggest next step ────────────────────────────────────────────────
  async function handleSuggest(afterId: string) {
    const res = await suggestNextStep(draft);
    addNode(res.kind, afterId);
  }

  // ─── Clone ─────────────────────────────────────────────────────────────
  async function handleClone(sourceId: string) {
    const res = await cloneStepsFromDrip(drip.id, sourceId, draft);
    if (res.ok && res.draft) {
      setDraft(res.draft);
      setCloneOpen(false);
    }
  }

  // ─── Export ────────────────────────────────────────────────────────────
  function handleExport() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sabsms-drip-${draft.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Render: traverse trunk in order ──────────────────────────────────
  // For visual simplicity we render the trunk top-down. Branches get
  // rendered as two horizontally-stacked sub-columns underneath.
  const start = draft.nodes.find((n) => n.kind === "start");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── Canvas ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Card>
          <ZoruCardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <ZoruCardTitle>Canvas</ZoruCardTitle>
              <ZoruCardDescription>
                Vertical flow — each card is a step. Add waits, branches, or
                messages between any two nodes.
              </ZoruCardDescription>
            </div>
            <div className="flex items-center gap-2">
              <SabsmsKbdHint
                shortcuts={[
                  { keys: ["⌘", "S"], description: "Save drip" },
                  { keys: ["?"], description: "Open this dialog" },
                ]}
              />
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="px-4 pb-6">
            <ScrollArea className="max-h-[68vh] pr-3">
              <div className="mx-auto max-w-md space-y-2">
                {start ? (
                  <CanvasTrunk
                    startId={start.id}
                    draft={draft}
                    templates={templates}
                    errorsByNode={errorsByNode}
                    dripId={drip.id}
                    onChange={(nextNode) =>
                      setDraft((d) => ({
                        ...d,
                        nodes: d.nodes.map((n) => (n.id === nextNode.id ? nextNode : n)),
                      }))
                    }
                    onDelete={(id) => setConfirmDelete(id)}
                    onAdd={(afterId) => setAddOpen({ afterId })}
                    onSuggest={handleSuggest}
                  />
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <ZoruAlertTitle>Empty drip</ZoruAlertTitle>
                    <ZoruAlertDescription>
                      No start node. Reset the drip JSON or import a valid
                      definition.
                    </ZoruAlertDescription>
                  </Alert>
                )}
              </div>
            </ScrollArea>
          </ZoruCardContent>
        </Card>
      </div>

      {/* ── Side rail ─────────────────────────────────────────── */}
      <aside className="space-y-4">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">Drip settings</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="drip-name">Name</Label>
              <Input
                id="drip-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Entry trigger</Label>
              <Select
                value={draft.entryTrigger.kind}
                onValueChange={(v) => {
                  if (v === "manual") {
                    setDraft({ ...draft, entryTrigger: { kind: "manual" } });
                  } else if (v === "segment_join") {
                    setDraft({
                      ...draft,
                      entryTrigger: { kind: "segment_join", segmentId: "" },
                    });
                  } else if (v === "event") {
                    setDraft({
                      ...draft,
                      entryTrigger: { kind: "event", eventKey: "" },
                    });
                  }
                }}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="manual">Manual enrol</ZoruSelectItem>
                  <ZoruSelectItem value="segment_join">Segment join</ZoruSelectItem>
                  <ZoruSelectItem value="event">Custom event</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
              {draft.entryTrigger.kind === "segment_join" && (
                <Input
                  placeholder="segmentId"
                  value={draft.entryTrigger.segmentId}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      entryTrigger: { kind: "segment_join", segmentId: e.target.value },
                    })
                  }
                />
              )}
              {draft.entryTrigger.kind === "event" && (
                <Input
                  placeholder="event_key e.g. checkout.completed"
                  value={draft.entryTrigger.eventKey}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      entryTrigger: { kind: "event", eventKey: e.target.value },
                    })
                  }
                />
              )}
            </div>
            <Separator />
            <label className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-slate-700">
                {enabled ? (
                  <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                )}
                {enabled ? "Running" : "Paused"}
              </span>
              <Switch checked={enabled} onCheckedChange={handleToggleEnabled} />
            </label>
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Users className="h-3 w-3" /> Live enrolments
              </span>
              <span className="font-semibold text-slate-900">{enrolCount}</span>
            </div>
            <SabsmsRefreshButton onRefresh={handleRefreshEnrol} defaultInterval={30} />
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">Exit conditions</ZoruCardTitle>
            <ZoruCardDescription>
              Auto-exit a contact when any of these become true.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-2">
            {(
              [
                ["replied", "When contact replies"],
                ["clicked", "When contact clicks a link"],
                ["converted", "When contact converts"],
                ["unsubscribed", "When contact unsubscribes"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between text-xs text-slate-700"
              >
                {label}
                <Switch
                  checked={!!draft.exitConditions?.[key]}
                  onCheckedChange={(v) =>
                    setDraft({
                      ...draft,
                      exitConditions: { ...(draft.exitConditions ?? {}), [key]: !!v },
                    })
                  }
                />
              </label>
            ))}
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">Validation</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            {validation.ok ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> No issues.
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium text-rose-800">
                  <AlertTriangle className="h-4 w-4" />
                  {validation.errors.length} issue{validation.errors.length === 1 ? "" : "s"}
                </div>
                <ul className="ml-2 list-disc space-y-0.5 text-[11px] text-rose-700">
                  {validation.errors.slice(0, 6).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
                {globalErrors.length === 0 && validation.errors.length > 6 && (
                  <div className="text-[11px] text-slate-500">
                    …and {validation.errors.length - 6} more (see node cards).
                  </div>
                )}
              </div>
            )}
          </ZoruCardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="mr-1.5 h-3.5 w-3.5" /> History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDryRunOpen(true)}
          >
            <FlaskConical className="mr-1.5 h-3.5 w-3.5" /> Dry-run
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Clone from
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export JSON
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-500">
          <span>
            Last saved{" "}
            {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "—"}
          </span>
          <Button size="sm" onClick={handleSave} disabled={saving || !validation.ok}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        <div className="text-[11px] text-slate-500">
          Tip: press <ZoruKbd>⌘</ZoruKbd>
          <ZoruKbd>S</ZoruKbd> to save without leaving the canvas.
        </div>
      </aside>

      {/* ── Add step dialog ───────────────────────────────────── */}
      <Dialog open={!!addOpen} onOpenChange={(o) => !o && setAddOpen(null)}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add a step</ZoruDialogTitle>
            <ZoruDialogDescription>
              Pick the kind of step to insert after this node.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="grid grid-cols-1 gap-2">
            <AddOptionButton
              icon={<Mail className="h-4 w-4" />}
              label="Send message"
              description="Send a template-driven SMS / MMS."
              onClick={() => addOpen && addNode("message", addOpen.afterId)}
            />
            <AddOptionButton
              icon={<Clock className="h-4 w-4" />}
              label="Wait"
              description="Wait a relative duration or an absolute timestamp."
              onClick={() => addOpen && addNode("wait", addOpen.afterId)}
            />
            <AddOptionButton
              icon={<GitBranch className="h-4 w-4" />}
              label="Branch"
              description="Split the path based on replied / clicked / opened."
              onClick={() => addOpen && addNode("branch", addOpen.afterId)}
            />
            <AddOptionButton
              icon={<Sparkles className="h-4 w-4" />}
              label="Let AI suggest"
              description="Pick the most likely next step."
              onClick={() => addOpen && handleSuggest(addOpen.afterId)}
            />
          </div>
        </ZoruDialogContent>
      </Dialog>

      {/* ── History dialog ────────────────────────────────────── */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <ZoruDialogContent className="max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Version history</ZoruDialogTitle>
            <ZoruDialogDescription>
              Rolling back creates a fresh save — you can roll forward again.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {drip.versions.length === 0 ? (
              <div className="text-sm text-slate-500">
                No prior versions yet. Save once to create the first snapshot.
              </div>
            ) : (
              drip.versions
                .slice()
                .reverse()
                .map((v) => (
                  <div
                    key={v.versionId}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div className="space-y-0.5">
                      <div className="font-medium text-slate-800">
                        {new Date(v.savedAt).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {v.draft.nodes.length} nodes · {v.draft.edges.length} edges
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await rollbackToVersion(drip.id, v.versionId);
                        router.refresh();
                        setHistoryOpen(false);
                      }}
                    >
                      Roll back
                    </Button>
                  </div>
                ))
            )}
          </div>
        </ZoruDialogContent>
      </Dialog>

      {/* ── Dry-run dialog ────────────────────────────────────── */}
      <DryRunDialog
        open={dryRunOpen}
        onOpenChange={setDryRunOpen}
        dripId={drip.id}
        templates={templates}
      />

      {/* ── Clone dialog ──────────────────────────────────────── */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Clone steps from another drip</ZoruDialogTitle>
            <ZoruDialogDescription>
              Pick a source drip — its middle steps are appended after the
              current ones with a fresh id prefix.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-2">
            {otherDrips.length === 0 ? (
              <div className="text-sm text-slate-500">No other drips to clone from.</div>
            ) : (
              otherDrips.map((d) => (
                <Button
                  key={d.id}
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => handleClone(d.id)}
                >
                  <span>{d.name}</span>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              ))
            )}
          </div>
        </ZoruDialogContent>
      </Dialog>

      {/* ── Confirm delete ────────────────────────────────────── */}
      <ZoruAlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this step?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              The predecessor will be stitched directly to the successor.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  setDraft((d) => removeNode(d, confirmDelete));
                  setConfirmDelete(null);
                }
              }}
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function AddOptionButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3 text-left transition hover:border-slate-400"
    >
      <span className="rounded-md bg-slate-100 p-1.5 text-slate-700">{icon}</span>
      <span className="space-y-0.5">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function CanvasTrunk({
  startId,
  draft,
  templates,
  errorsByNode,
  dripId,
  onChange,
  onDelete,
  onAdd,
  onSuggest,
}: {
  startId: string;
  draft: DraftDrip;
  templates: TemplateOption[];
  errorsByNode: Map<string, string[]>;
  dripId: string;
  onChange: (n: DraftDripNode) => void;
  onDelete: (id: string) => void;
  onAdd: (afterId: string) => void;
  onSuggest: (afterId: string) => Promise<void>;
}) {
  // Pre-order trunk: follow first non-branch outgoing edge. Branch
  // nodes show both children in a horizontally-stacked pair.
  const elements: React.ReactNode[] = [];
  const seen = new Set<string>();
  function render(nodeId: string) {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = draft.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    elements.push(
      <React.Fragment key={node.id}>
        <StepNode
          node={node}
          templates={templates}
          errors={errorsByNode.get(node.id) ?? []}
          dripId={dripId}
          onChange={onChange}
          onDelete={() => onDelete(node.id)}
          onSuggest={() => onSuggest(node.id)}
        />
        {node.kind !== "exit" && (
          <div className="flex flex-col items-center gap-1 py-1">
            <ArrowDown className="h-3.5 w-3.5 text-slate-400" />
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-[11px]"
              onClick={() => onAdd(node.id)}
            >
              <Plus className="h-3 w-3" /> Add step
            </Button>
            <ArrowDown className="h-3.5 w-3.5 text-slate-400" />
          </div>
        )}
      </React.Fragment>,
    );
    if (node.kind === "branch") {
      const tEdge = draft.edges.find((e) => e.from === node.id && e.branchValue === "true");
      const fEdge = draft.edges.find((e) => e.from === node.id && e.branchValue === "false");
      elements.push(
        <div
          key={`${node.id}-branch`}
          className="grid grid-cols-2 gap-3 rounded-md border border-dashed border-slate-200 p-2"
        >
          <div>
            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
              <Badge variant="default" className="h-4 px-1 text-[9px]">YES</Badge>
            </div>
            {tEdge && <CanvasSub edgeTo={tEdge.to} draft={draft} templates={templates} errorsByNode={errorsByNode} dripId={dripId} onChange={onChange} onDelete={onDelete} onAdd={onAdd} onSuggest={onSuggest} seen={seen} />}
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-rose-700">
              <Badge variant="secondary" className="h-4 px-1 text-[9px]">NO</Badge>
            </div>
            {fEdge && <CanvasSub edgeTo={fEdge.to} draft={draft} templates={templates} errorsByNode={errorsByNode} dripId={dripId} onChange={onChange} onDelete={onDelete} onAdd={onAdd} onSuggest={onSuggest} seen={seen} />}
          </div>
        </div>,
      );
      return;
    }
    const next = draft.edges.find((e) => e.from === node.id && !e.branchValue);
    if (next) render(next.to);
  }
  render(startId);
  return <>{elements}</>;
}

function CanvasSub(props: {
  edgeTo: string;
  draft: DraftDrip;
  templates: TemplateOption[];
  errorsByNode: Map<string, string[]>;
  dripId: string;
  onChange: (n: DraftDripNode) => void;
  onDelete: (id: string) => void;
  onAdd: (afterId: string) => void;
  onSuggest: (afterId: string) => Promise<void>;
  seen: Set<string>;
}) {
  const { edgeTo, draft, templates, errorsByNode, dripId, onChange, onDelete, onAdd, onSuggest, seen } = props;
  if (seen.has(edgeTo)) return null;
  const node = draft.nodes.find((n) => n.id === edgeTo);
  if (!node) return null;
  seen.add(edgeTo);
  return (
    <div className="space-y-2">
      <StepNode
        node={node}
        templates={templates}
        errors={errorsByNode.get(node.id) ?? []}
        dripId={dripId}
        onChange={onChange}
        onDelete={() => onDelete(node.id)}
        onSuggest={() => onSuggest(node.id)}
      />
    </div>
  );
}

function DryRunDialog({
  open,
  onOpenChange,
  dripId,
  templates,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dripId: string;
  templates: TemplateOption[];
}) {
  const [phone, setPhone] = React.useState("+15555550100");
  const [firstName, setFirstName] = React.useState("Sample");
  const [steps, setSteps] = React.useState<DryRunStep[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await dryRunDrip(dripId, { phoneE164: phone, firstName });
      if (res.ok) setSteps(res.steps);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Dry-run with a sample contact</ZoruDialogTitle>
          <ZoruDialogDescription>
            No messages are actually sent. The engine simulates the schedule.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Phone (E.164)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
        </div>
        {steps && (
          <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
            {steps.length === 0 && <div className="text-slate-500">No steps simulated.</div>}
            {steps.map((s) => {
              const tpl = templates.find((t) => t.id === s.templateId);
              return (
                <div
                  key={`${s.index}-${s.templateId}`}
                  className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 shadow-sm"
                >
                  <div>
                    <div className="font-medium text-slate-800">
                      #{s.index + 1} {tpl?.name ?? s.templateId}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Scheduled {new Date(s.scheduledAt).toLocaleString()}
                    </div>
                  </div>
                  {s.skipped && (
                    <Badge variant="secondary" className="text-[10px]">
                      skipped
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <ZoruDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={run} disabled={busy}>
            {busy ? "Simulating…" : "Run"}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
