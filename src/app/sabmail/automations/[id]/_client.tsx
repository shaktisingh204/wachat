"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  GitBranch,
  Save,
  Send,
  Workflow,
  Zap,
} from "lucide-react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  Badge,
  Button,
  Card,
  Input,
  SelectField,
  Switch,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import { CreatingOverlay, SuccessCheck } from "@/components/sabmail/motion";

import { saveSabmailJourney, type SabmailJourneyDetail } from "../actions";
import "@/components/sabmail/motion/sabmail-motion.css";

/* ── palette of node kinds (default node type, labelled) ──────────────── */

type PaletteKind = "trigger" | "send" | "wait" | "condition";

const PALETTE: Array<{
  kind: PaletteKind;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}> = [
  { kind: "trigger", label: "Trigger", icon: Zap },
  { kind: "send", label: "Send email", icon: Send },
  { kind: "wait", label: "Wait", icon: Clock },
  { kind: "condition", label: "Condition", icon: GitBranch },
];

const KIND_LABEL: Record<PaletteKind, string> = {
  trigger: "Trigger",
  send: "Send email",
  wait: "Wait",
  condition: "Condition",
};

/**
 * What real event enrolls a person when this journey is enabled. Read at
 * runtime by `enrollMatchingJourneys()` (the trigger binding) off the trigger
 * node's `data.event`. `manual` = only enrolled explicitly (never auto-fires).
 */
const TRIGGER_EVENTS: Array<{ value: string; label: string }> = [
  { value: "manual", label: "Manual / API only" },
  { value: "form_submit", label: "Form submission" },
  { value: "contact_created", label: "Contact created" },
  { value: "inbound_email", label: "Inbound email received" },
];

const WAIT_UNITS: Array<{ value: string; label: string }> = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
];

/**
 * Condition fields. These map onto the per-person facts assembled by
 * `buildConditionContext()` and read by `evaluateSabmailCondition()` — keep the
 * `value` strings aligned with the engine's field resolver. Picking "custom"
 * surfaces a free-text field input so any contact attribute can be addressed.
 */
const CONDITION_FIELDS: Array<{ value: string; label: string }> = [
  { value: "tag", label: "Tag" },
  { value: "email", label: "Email" },
  { value: "emailDomain", label: "Email domain" },
  { value: "name", label: "Name" },
  { value: "opened", label: "Opened" },
  { value: "clicked", label: "Clicked" },
  { value: "replied", label: "Replied" },
  { value: "bounced", label: "Bounced" },
  { value: "__custom__", label: "Custom field…" },
];

/** Sentinel for the "Custom field…" choice — never written to the predicate. */
const CONDITION_CUSTOM = "__custom__";

/** Mirrors `SabmailConditionOp` in src/lib/sabmail/journey-engine.ts. */
const CONDITION_OPS: Array<{ value: string; label: string }> = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "exists" },
  { value: "notExists", label: "does not exist" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
];

/** Ops that need no comparison value (presence checks). */
const VALUELESS_OPS = new Set(["exists", "notExists"]);

/** Built-in field keys — anything else is treated as a custom field. */
const KNOWN_CONDITION_FIELDS = new Set(
  CONDITION_FIELDS.map((f) => f.value).filter((v) => v !== CONDITION_CUSTOM),
);

/** A mailbox the Send node can dispatch from (passed from the server page). */
export interface SabmailJourneyMailbox {
  id: string;
  email: string;
  displayName: string | null;
}

function dataStr(node: Node | null, key: string, fallback = ""): string {
  const v = (node?.data as Record<string, unknown> | undefined)?.[key];
  return v == null ? fallback : String(v);
}

/**
 * Read a condition node's predicate, accepting either the nested
 * `node.data.predicate = {field,op,value}` shape (what we write) or the flat
 * `node.data.{field,op,value}` fallback the engine also tolerates.
 */
function readNodePredicate(node: Node | null): {
  field: string;
  op: string;
  value: string;
} {
  const data = (node?.data ?? {}) as Record<string, unknown>;
  const nested =
    data.predicate && typeof data.predicate === "object"
      ? (data.predicate as Record<string, unknown>)
      : data;
  const str = (v: unknown) => (v == null ? "" : String(v));
  return {
    field: str(nested.field),
    op: str(nested.op),
    value: str(nested.value),
  };
}

let nodeSeq = 0;
function nextNodeId(): string {
  nodeSeq += 1;
  return `n_${Date.now().toString(36)}_${nodeSeq}`;
}

export function SabmailJourneyEditorClient({
  journey,
  mailboxes = [],
}: {
  journey: SabmailJourneyDetail;
  mailboxes?: SabmailJourneyMailbox[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  // React Flow's persisted arrays are loosely typed across versions — cast on
  // the load boundary, and cast back to any[] when persisting.
  const [nodes, setNodes, onNodesChange] = useNodesState(
    (journey.nodes as unknown as Node[]) ?? [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (journey.edges as unknown as Edge[]) ?? [],
  );

  const [name, setName] = React.useState(journey.name);
  const [enabled, setEnabled] = React.useState(journey.enabled);
  const [saving, setSaving] = React.useState(false);
  const [savedTick, setSavedTick] = React.useState(false);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  const onConnect = React.useCallback(
    (connection: Connection) =>
      setEdges((eds) => {
        // Auto-label a CONDITION node's two outgoing edges yes/no so the engine
        // can branch (TRUE → "yes" edge, FALSE → "no" edge). First connection
        // from a condition node becomes "yes", the second "no".
        const srcNode = nodes.find((n) => n.id === connection.source);
        const srcKind = (srcNode?.data as { kind?: string } | undefined)?.kind;
        if (srcKind === "condition" && connection.source && connection.target) {
          const existing = eds.filter((e) => e.source === connection.source).length;
          const label = existing === 0 ? "yes" : existing === 1 ? "no" : null;
          if (label) {
            const labeled: Edge = {
              id: `e_${connection.source}_${connection.target}_${Math.round(
                Math.random() * 1e9,
              ).toString(36)}`,
              source: connection.source,
              target: connection.target,
              sourceHandle: connection.sourceHandle ?? null,
              targetHandle: connection.targetHandle ?? null,
              label,
            };
            return addEdge(labeled, eds);
          }
        }
        return addEdge(connection, eds);
      }),
    [setEdges, nodes],
  );

  const onNodeClick = React.useCallback(
    (_: React.MouseEvent, node: Node) => setSelectedNodeId(node.id),
    [],
  );

  const patchNodeData = React.useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      );
    },
    [setNodes],
  );

  const selectedNode = React.useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const selectedKind = (selectedNode?.data as { kind?: PaletteKind } | undefined)
    ?.kind;

  // Mailbox <SelectField> options for the Send node (manual fallback handled in
  // the inspector when this is empty).
  const mailboxOptions = React.useMemo(
    () =>
      mailboxes.map((m) => ({
        value: m.id,
        label: m.displayName ? `${m.displayName} <${m.email}>` : m.email,
      })),
    [mailboxes],
  );

  // Current predicate (nested or flat) for the selected condition node.
  const predicate = React.useMemo(
    () => readNodePredicate(selectedNode),
    [selectedNode],
  );
  // Whether the field is a known key or a custom attribute (drives the picker +
  // the custom-field text input).
  const predicateIsCustom =
    predicate.field !== "" && !KNOWN_CONDITION_FIELDS.has(predicate.field);
  const predicateFieldChoice = predicateIsCustom
    ? CONDITION_CUSTOM
    : predicate.field;

  // Write a {field,op,value} patch as `node.data.predicate`, merging with the
  // current predicate so each control edits one part. `exists`/`notExists` drop
  // the comparison value.
  const patchPredicate = React.useCallback(
    (id: string, patch: { field?: string; op?: string; value?: string }) => {
      const current = readNodePredicate(
        nodes.find((n) => n.id === id) ?? null,
      );
      const next = {
        field: patch.field ?? current.field,
        op: patch.op ?? current.op,
        value: patch.value ?? current.value,
      };
      if (VALUELESS_OPS.has(next.op)) next.value = "";
      patchNodeData(id, { predicate: next });
    },
    [nodes, patchNodeData],
  );

  const addNode = React.useCallback(
    (kind: PaletteKind) => {
      const id = nextNodeId();
      const node: Node = {
        id,
        type: "default",
        // Spread placement so stacked adds don't overlap perfectly.
        position: {
          x: 80 + (nodeSeq % 4) * 40,
          y: 60 + nodeSeq * 70,
        },
        data: { label: KIND_LABEL[kind], kind },
      };
      setNodes((nds) => [...nds, node]);
    },
    [setNodes],
  );

  const handleSave = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: "Name required",
        description: "Give your journey a name before saving.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const res = await saveSabmailJourney(journey.id, {
      name: trimmed,
      enabled,
      nodes: nodes as unknown as unknown[],
      edges: edges as unknown as unknown[],
    });
    setSaving(false);
    if (!res.ok) {
      toast({
        title: "Could not save journey",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    setSavedTick(true);
    window.setTimeout(() => setSavedTick(false), 1400);
    toast({ title: "Journey saved" });
    router.refresh();
  }, [name, enabled, nodes, edges, journey.id, router, toast]);

  return (
    <div className="relative flex h-[calc(100vh-7rem)] flex-col gap-3 p-4">
      <CreatingOverlay
        show={saving}
        variant="process"
        title="Saving journey…"
        subtitle="Persisting your flow"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={ArrowLeft}
            onClick={() => router.push("/sabmail/automations")}
            aria-label="Back to automations"
          />
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
            <Workflow className="h-4 w-4" aria-hidden />
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Journey name"
            maxLength={120}
            className="w-64 max-w-full font-semibold"
            aria-label="Journey name"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Enable journey"
            />
            <span>{enabled ? "Enabled" : "Disabled"}</span>
          </label>
          {savedTick ? <SuccessCheck size={28} /> : null}
          <Button
            variant="primary"
            size="sm"
            iconLeft={Save}
            loading={saving}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </div>
      </div>

      {/* Engine note */}
      <div
        className="flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-xs text-[var(--st-text-secondary)]"
        role="note"
      >
        <Workflow className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Runs automatically while enabled — set the trigger node’s event to
          decide what enrolls people. Click any node to edit its settings.
        </span>
      </div>

      {/* Builder: palette + canvas + inspector */}
      <div
        className={`grid min-h-0 flex-1 gap-3 ${
          selectedNode
            ? "grid-cols-[200px_1fr_300px]"
            : "grid-cols-[200px_1fr]"
        }`}
      >
        <Card className="flex flex-col gap-2 p-3">
          <div className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Add node
          </div>
          {PALETTE.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => addNode(kind)}
              className="flex items-center gap-2 rounded-md border border-[var(--st-border)] px-3 py-2 text-left text-sm text-[var(--st-text)] transition-colors hover:bg-[var(--st-bg-muted)]"
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          ))}
          <div className="mt-auto px-1 pt-2">
            <Badge variant="outline">
              {nodes.length} {nodes.length === 1 ? "node" : "nodes"}
            </Badge>
          </div>
        </Card>

        <Card className="min-h-0 overflow-hidden p-0">
          <div className="h-full w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
        </Card>

        {selectedNode ? (
          <Card className="flex min-h-0 flex-col gap-3 overflow-y-auto p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                {(selectedKind ? KIND_LABEL[selectedKind] : "Node")} settings
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedNodeId(null)}
                aria-label="Close settings"
              >
                ✕
              </Button>
            </div>

            {selectedKind === "trigger" ? (
              <label className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                <span>Enroll people when…</span>
                <SelectField
                  value={dataStr(selectedNode, "event", "manual")}
                  onChange={(v) =>
                    patchNodeData(selectedNode.id, { event: v ?? "manual" })
                  }
                  options={TRIGGER_EVENTS}
                  aria-label="Trigger event"
                />
                <span className="text-[var(--st-text-tertiary)]">
                  “Manual” never auto-enrolls — use it for API/contact-list
                  enrollment only.
                </span>
              </label>
            ) : null}

            {selectedKind === "send" ? (
              <>
                <label className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                  <span>From mailbox</span>
                  {mailboxOptions.length > 0 ? (
                    <SelectField
                      value={dataStr(selectedNode, "accountId")}
                      onChange={(v) =>
                        patchNodeData(selectedNode.id, {
                          accountId: (v ?? "").trim(),
                        })
                      }
                      options={[
                        { value: "", label: "Journey default mailbox" },
                        ...mailboxOptions,
                      ]}
                      aria-label="Send mailbox"
                    />
                  ) : (
                    <Input
                      value={dataStr(selectedNode, "accountId")}
                      onChange={(e) =>
                        patchNodeData(selectedNode.id, {
                          accountId: e.target.value.trim(),
                        })
                      }
                      placeholder="Defaults to the journey’s mailbox"
                      aria-label="Send mailbox id"
                    />
                  )}
                  <span className="text-[var(--st-text-tertiary)]">
                    {mailboxOptions.length > 0
                      ? "Leave on the default to use the journey’s mailbox."
                      : "No mailboxes connected — paste a mailbox id, or leave blank for the journey default."}
                  </span>
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                  <span>Subject</span>
                  <Input
                    value={dataStr(selectedNode, "subject")}
                    onChange={(e) =>
                      patchNodeData(selectedNode.id, { subject: e.target.value })
                    }
                    placeholder="Subject line"
                    maxLength={998}
                    aria-label="Email subject"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                  <span>Body (HTML)</span>
                  <Textarea
                    value={dataStr(selectedNode, "html")}
                    onChange={(e) =>
                      patchNodeData(selectedNode.id, { html: e.target.value })
                    }
                    rows={8}
                    placeholder="<p>Hello {{name}}…</p>"
                    aria-label="Email body"
                  />
                </label>
              </>
            ) : null}

            {selectedKind === "wait" ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                  <span>Wait amount</span>
                  <Input
                    type="number"
                    min={1}
                    value={dataStr(selectedNode, "delay", "1")}
                    onChange={(e) =>
                      patchNodeData(selectedNode.id, {
                        delay: Number(e.target.value) || 1,
                      })
                    }
                    aria-label="Wait amount"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                  <span>Unit</span>
                  <SelectField
                    value={dataStr(selectedNode, "unit", "days")}
                    onChange={(v) =>
                      patchNodeData(selectedNode.id, { unit: v ?? "days" })
                    }
                    options={WAIT_UNITS}
                    aria-label="Wait unit"
                  />
                </label>
              </div>
            ) : null}

            {selectedKind === "condition" ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                  <span>Field</span>
                  <SelectField
                    value={predicateFieldChoice}
                    onChange={(v) => {
                      const choice = v ?? "";
                      // Picking "Custom field…" clears the field so the text
                      // input below starts empty; built-ins write directly.
                      patchPredicate(selectedNode.id, {
                        field: choice === CONDITION_CUSTOM ? "" : choice,
                      });
                    }}
                    options={CONDITION_FIELDS}
                    aria-label="Condition field"
                  />
                </label>

                {predicateFieldChoice === CONDITION_CUSTOM ? (
                  <label className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                    <span>Custom field key</span>
                    <Input
                      value={predicate.field}
                      onChange={(e) =>
                        patchPredicate(selectedNode.id, {
                          field: e.target.value.trim(),
                        })
                      }
                      placeholder="e.g. plan, country, lifecycleStage"
                      aria-label="Custom condition field key"
                    />
                  </label>
                ) : null}

                <label className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                  <span>Operator</span>
                  <SelectField
                    value={predicate.op || "equals"}
                    onChange={(v) =>
                      patchPredicate(selectedNode.id, { op: v ?? "equals" })
                    }
                    options={CONDITION_OPS}
                    aria-label="Condition operator"
                  />
                </label>

                {VALUELESS_OPS.has(predicate.op) ? null : (
                  <label className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                    <span>Value</span>
                    <Input
                      value={predicate.value}
                      onChange={(e) =>
                        patchPredicate(selectedNode.id, {
                          value: e.target.value,
                        })
                      }
                      placeholder="Value to compare against"
                      aria-label="Condition value"
                    />
                  </label>
                )}

                <p className="text-xs text-[var(--st-text-tertiary)]">
                  Label this node’s two outgoing edges{" "}
                  <span className="font-medium">yes</span> and{" "}
                  <span className="font-medium">no</span>: the engine routes a{" "}
                  TRUE result to the <span className="font-medium">yes</span>{" "}
                  edge and FALSE to the <span className="font-medium">no</span>{" "}
                  edge.
                </p>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
