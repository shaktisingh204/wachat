"use client";

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCollapsible,
  ZoruCollapsibleContent,
  ZoruCollapsibleTrigger,
  EmptyState,
  Skeleton,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  ChevronDown,
  CircleSlash,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Smartphone,
  Workflow,
  } from "lucide-react";

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
 *
 * Rebuilt on ZoruUI primitives — neutral zoru-* tokens only, no tab UI.
 */

import * as React from "react";
import Link from "next/link";

import { useProject } from "@/context/project-context";
import { listSabFlows } from "@/app/actions/sabflow";
import { useSabwaSession } from "@/lib/sabwa/session-context";

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
  const toast = useZoruToast();
  const { activeProjectId } = useProject();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';

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
    sessionId,
  )}&projectId=${encodeURIComponent(sabwaProjectScope)}`;

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Chatbot flows</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink"
        >
          <Workflow className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] tracking-[-0.015em] text-zoru-ink leading-[1.2]">
              Chatbot Flows
            </h1>
            <Badge variant="secondary">SabFlow-powered</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-[13px] text-zoru-ink-muted">
            Chatbot flows for your personal WhatsApp use{" "}
            <strong className="font-medium text-zoru-ink">SabFlow</strong>{" "}
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
              <Skeleton key={i} className="h-28 w-full rounded-[var(--zoru-radius-lg)]" />
            ))}
          </div>
        )}

        {!loading && error && (
          <Card>
            <ZoruCardContent className="flex flex-col items-start gap-2 p-4 text-[13px]">
              <div className="flex items-center gap-2 text-zoru-danger">
                <CircleSlash className="h-4 w-4" />
                <span className="font-medium">Couldn&apos;t load flows</span>
              </div>
              <p className="text-zoru-ink-muted">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  toast.toast({ title: "Retrying flows fetch" });
                  void load();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Try again
              </Button>
            </ZoruCardContent>
          </Card>
        )}

        {!loading && !error && flows.length === 0 && (
          <Card className="border-dashed">
            <ZoruCardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-[var(--zoru-radius-lg)] bg-zoru-surface text-zoru-ink"
              >
                <Workflow className="h-6 w-6" />
              </div>
              <h3 className="text-[15px] font-semibold text-zoru-ink">
                No flows yet
              </h3>
              <p className="max-w-md text-[13px] text-zoru-ink-muted">
                Spin up your first chatbot for personal WhatsApp. The builder
                opens scoped to SabWa — only triggers and actions that work
                on personal WhatsApp accounts are shown.
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
            </ZoruCardContent>
          </Card>
        )}

        {!loading && !error && flows.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {flows.map((flow) => {
              const isActive = flow.status === "active";
              return (
                <Card
                  key={flow._id}
                  className="transition hover:shadow-[var(--zoru-shadow-md)]"
                >
                  <ZoruCardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold text-zoru-ink">
                          {flow.name || "Untitled flow"}
                        </h3>
                        <p className="mt-1 truncate text-[11.5px] text-zoru-ink-muted">
                          Trigger: {triggerSummary(flow)}
                        </p>
                      </div>
                      <Badge
                        variant={isActive ? "success" : "secondary"}
                        className="shrink-0"
                      >
                        {isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-[11.5px] text-zoru-ink-muted">
                      <div>
                        <dt className="font-medium text-zoru-ink">Runs</dt>
                        <dd>{flow.runsCount ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-zoru-ink">
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
                  </ZoruCardContent>
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
          className="text-[15px] font-semibold tracking-[-0.01em] text-zoru-ink"
        >
          SabWa builder catalogue
        </h2>
        <p className="text-[13px] text-zoru-ink-muted">
          Reference for the triggers and actions the SabFlow builder exposes
          when scoped to SabWa.
        </p>

        <ZoruCollapsible defaultOpen>
          <Card>
            <ZoruCollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-t-[var(--zoru-radius-lg)] p-4 text-left transition hover:bg-zoru-surface-2"
                aria-label="Toggle SabWa triggers reference"
              >
                <ZoruCardHeader className="p-0">
                  <ZoruCardTitle className="text-[13px]">
                    Available triggers
                  </ZoruCardTitle>
                  <ZoruCardDescription className="text-[11.5px]">
                    What can start a SabWa flow.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ChevronDown className="h-4 w-4 transition data-[state=open]:rotate-180" />
              </button>
            </ZoruCollapsibleTrigger>
            <ZoruCollapsibleContent>
              <ZoruCardContent className="grid gap-3 pt-0 md:grid-cols-2">
                {SABWA_TRIGGERS.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-zoru-ink">
                        {trigger.title}
                      </span>
                      <code className="rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 px-1.5 py-0.5 text-[10px] text-zoru-ink-muted">
                        {trigger.id}
                      </code>
                    </div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
                      {trigger.description}
                    </p>
                  </div>
                ))}
              </ZoruCardContent>
            </ZoruCollapsibleContent>
          </Card>
        </ZoruCollapsible>

        <ZoruCollapsible defaultOpen>
          <Card>
            <ZoruCollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-t-[var(--zoru-radius-lg)] p-4 text-left transition hover:bg-zoru-surface-2"
                aria-label="Toggle SabWa actions reference"
              >
                <ZoruCardHeader className="p-0">
                  <ZoruCardTitle className="text-[13px]">
                    Available actions
                  </ZoruCardTitle>
                  <ZoruCardDescription className="text-[11.5px]">
                    What a SabWa flow can do after a trigger fires.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ChevronDown className="h-4 w-4 transition data-[state=open]:rotate-180" />
              </button>
            </ZoruCollapsibleTrigger>
            <ZoruCollapsibleContent>
              <ZoruCardContent className="grid gap-3 pt-0 md:grid-cols-2">
                {SABWA_ACTIONS.map((action) => (
                  <div
                    key={action.id}
                    className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-zoru-ink">
                        {action.title}
                      </span>
                      <code className="rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 px-1.5 py-0.5 text-[10px] text-zoru-ink-muted">
                        {action.id}
                      </code>
                    </div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
                      {action.description}
                    </p>
                  </div>
                ))}
              </ZoruCardContent>
            </ZoruCollapsibleContent>
          </Card>
        </ZoruCollapsible>
      </section>
    </div>
  );
}
