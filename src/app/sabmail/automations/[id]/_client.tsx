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
  Switch,
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

let nodeSeq = 0;
function nextNodeId(): string {
  nodeSeq += 1;
  return `n_${Date.now().toString(36)}_${nodeSeq}`;
}

export function SabmailJourneyEditorClient({
  journey,
}: {
  journey: SabmailJourneyDetail;
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

  const onConnect = React.useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
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
        <span>Automation runs when the engine is enabled (coming soon).</span>
      </div>

      {/* Builder: palette + canvas */}
      <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-3">
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
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
        </Card>
      </div>
    </div>
  );
}
