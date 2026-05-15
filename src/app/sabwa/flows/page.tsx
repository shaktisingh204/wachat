"use client";

/**
 * /sabwa/flows — Chatbot flows for SabWa.
 *
 * Bridges SabWa to the existing SabFlow visual builder.
 * Real data layer: `listSabFlows(projectId)` from `@/app/actions/sabflow`,
 * filtered to a `sabwa-` projectId prefix so personal-WhatsApp flows stay
 * separate from generic SabFlow ones.
 *
 * If no flows exist (Phase 1 / engine offline), the empty-state still
 * surfaces the SabWa trigger + action catalogue as a collapsible reference
 * so users understand what the builder will give them.
 */

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  CircleSlash,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/context/project-context";
import { listSabFlows } from "@/app/actions/sabflow";

// Same placeholder session id used elsewhere until SessionSwitcher is wired.
const PLACEHOLDER_SESSION_ID = "stub-primary";

interface FlowRow {
  _id: string;
  name: string;
  status?: "active" | "inactive" | string;
  events?: Array<{ type?: string; keyword?: string }>;
  groups?: unknown[];
  updatedAt?: string;
  createdAt?: string;
  runsCount?: number;
  lastRunAt?: string;
}

const SABWA_TRIGGERS = [
  {
    id: "message_received",
    title: "Message received",
    description: "Any inbound DM or group message hits the flow.",
  },
  {
    id: "keyword_match",
    title: "Keyword match",
    description: "Fire only when the inbound body matches a keyword or regex.",
  },
  {
    id: "new_contact",
    title: "New contact",
    description: "Fires the first time a JID messages this session.",
  },
  {
    id: "group_added",
    title: "Group added",
    description: "When this number is added to a new WhatsApp group.",
  },
];

const SABWA_ACTIONS = [
  {
    id: "send_message",
    title: "Send message",
    description: "Reply with text, with template variables for sender vars.",
  },
  {
    id: "send_media",
    title: "Send media",
    description: "Send an image, video, doc, or voice from SabFiles.",
  },
  {
    id: "add_label",
    title: "Add label",
    description: "Tag the chat with a SabWa label for inbox filtering.",
  },
  {
    id: "call_webhook",
    title: "Call webhook",
    description: "POST the inbound payload to an external HTTPS endpoint.",
  },
  {
    id: "pause",
    title: "Pause",
    description: "Wait for N seconds or until the contact replies again.",
  },
  {
    id: "branch_by_input",
    title: "Branch by input",
    description: "Split the flow based on the contact's last reply.",
  },
];

function triggerSummary(row: FlowRow): string {
  const ev = row.events?.[0];
  if (!ev?.type) return "No trigger configured";
  if (ev.type === "keyword_match" && ev.keyword) {
    return `Keyword: "${ev.keyword}"`;
  }
  return ev.type.replace(/_/g, " ");
}

function timeAgo(iso?: string): string {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "Never";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function SabWaFlowsPage() {
  const { toast } = useToast();
  const { activeProjectId } = useProject();

  const sabwaProjectScope = activeProjectId
    ? `sabwa-${activeProjectId}`
    : "sabwa";

  const [flows, setFlows] = React.useState<FlowRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSabFlows(sabwaProjectScope);
      if (Array.isArray(result)) {
        setFlows(result as unknown as FlowRow[]);
      } else if (result && typeof result === "object" && "error" in result) {
        setError(String((result as { error: string }).error));
        setFlows([]);
      } else {
        setFlows([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFlows([]);
    } finally {
      setLoading(false);
    }
  }, [sabwaProjectScope]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const newFlowHref = `/dashboard/sabflow/flow-builder?context=sabwa&sessionId=${encodeURIComponent(
    PLACEHOLDER_SESSION_ID,
  )}&projectId=${encodeURIComponent(sabwaProjectScope)}`;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          aria-hidden
          className="rounded-xl bg-secondary p-3 text-secondary-foreground"
        >
          <Workflow className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Chatbot Flows
            </h1>
            <Badge variant="secondary">SabFlow-powered</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Chatbot flows for your personal WhatsApp use{" "}
            <strong className="font-medium text-foreground">SabFlow</strong>{" "}
            under the hood. Build once with the visual editor, route every
            inbound to the right reply — labels, webhooks, branches included.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
          <Button asChild type="button">
            <Link href={newFlowHref} target="_blank" rel="noopener noreferrer">
              <Plus className="h-4 w-4" />
              <span className="ml-2">New flow</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Flow list ────────────────────────────────────────────────── */}
      <section aria-labelledby="flows-list-heading" className="space-y-3">
        <h2 id="flows-list-heading" className="sr-only">
          Your SabWa flows
        </h2>

        {loading && (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && error && (
          <Card>
            <CardContent className="flex flex-col items-start gap-2 p-4 text-sm">
              <div className="flex items-center gap-2 text-destructive">
                <CircleSlash className="h-4 w-4" />
                <span className="font-medium">Couldn&apos;t load flows</span>
              </div>
              <p className="text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  toast({ title: "Retrying flows fetch" });
                  void load();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && flows.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div
                aria-hidden
                className="rounded-2xl bg-secondary/60 p-3 text-secondary-foreground"
              >
                <Workflow className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">No flows yet</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Spin up your first chatbot for personal WhatsApp. The builder
                opens scoped to SabWa — only triggers and actions that work on
                Baileys are shown.
              </p>
              <Button asChild type="button">
                <Link
                  href={newFlowHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Plus className="mr-2 h-4 w-4" /> Create your first flow
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && flows.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {flows.map((flow) => {
              const isActive = flow.status === "active";
              return (
                <Card key={flow._id} className="transition hover:shadow-md">
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold">
                          {flow.name || "Untitled flow"}
                        </h3>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          Trigger: {triggerSummary(flow)}
                        </p>
                      </div>
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                        className="shrink-0"
                      >
                        {isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <dt className="font-medium text-foreground">Runs</dt>
                        <dd>{flow.runsCount ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">
                          Last run
                        </dt>
                        <dd>{timeAgo(flow.lastRunAt)}</dd>
                      </div>
                    </dl>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/dashboard/sabflow/flow-builder/${flow._id}?context=sabwa`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span className="ml-2">Open in builder</span>
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Trigger + action reference ───────────────────────────────── */}
      <section aria-labelledby="catalogue-heading" className="space-y-3">
        <h2
          id="catalogue-heading"
          className="text-base font-semibold tracking-tight"
        >
          SabWa builder catalogue
        </h2>
        <p className="text-sm text-muted-foreground">
          Reference for the triggers and actions the SabFlow builder exposes
          when scoped to SabWa.
        </p>

        <Collapsible defaultOpen>
          <Card>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-t-lg p-4 text-left transition hover:bg-muted/40"
                aria-label="Toggle SabWa triggers reference"
              >
                <CardHeader className="p-0">
                  <CardTitle className="text-sm">Available triggers</CardTitle>
                  <CardDescription className="text-xs">
                    What can start a SabWa flow.
                  </CardDescription>
                </CardHeader>
                <ChevronDown className="h-4 w-4 transition data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
                {SABWA_TRIGGERS.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="rounded-md border bg-card/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {trigger.title}
                      </span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {trigger.id}
                      </code>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {trigger.description}
                    </p>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible defaultOpen>
          <Card>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-t-lg p-4 text-left transition hover:bg-muted/40"
                aria-label="Toggle SabWa actions reference"
              >
                <CardHeader className="p-0">
                  <CardTitle className="text-sm">Available actions</CardTitle>
                  <CardDescription className="text-xs">
                    What a SabWa flow can do after a trigger fires.
                  </CardDescription>
                </CardHeader>
                <ChevronDown className="h-4 w-4 transition data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
                {SABWA_ACTIONS.map((action) => (
                  <div
                    key={action.id}
                    className="rounded-md border bg-card/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {action.title}
                      </span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {action.id}
                      </code>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </section>
    </div>
  );
}
