"use client";

/**
 * /dashboard/facebook/agents — Messenger AI agents.
 *
 * Rebuilt on ZoruUI primitives. Same `getFacebookAgents`,
 * `createFacebookAgent`, `updateFacebookAgent`, `deleteFacebookAgent`
 * server actions as before — visual layer is pure zoru, neutral palette.
 *
 * Dialogs: assign-agent (create), remove-agent-confirm.
 */

import * as React from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  Bot,
  CircleCheck,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  getFacebookAgents,
  updateFacebookAgent,
} from "@/app/actions/facebook.actions";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  cn,
  useZoruToast,
} from "@/components/zoruui";

import { NoProjectState } from "../_components/no-project-state";
import { AgentFormDialog } from "../_components/agent-form-dialog";
import { DeleteAgentDialog } from "../_components/delete-agent-dialog";

/* ── types ───────────────────────────────────────────────────────── */

type Agent = {
  _id: string;
  name: string;
  personality?: string;
  welcomeMessage?: string;
  fallbackMessage?: string;
  isActive: boolean;
};

/* ── skeleton ────────────────────────────────────────────────────── */

function AgentsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-48" />
      <div className="mt-5 flex flex-col gap-2">
        <ZoruSkeleton className="h-3 w-24" />
        <ZoruSkeleton className="h-7 w-72" />
        <ZoruSkeleton className="h-3 w-96" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}

/* ── stat tile ───────────────────────────────────────────────────── */

function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4">
      <div className="flex items-start justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
          {icon}
        </span>
      </div>
      <div className="mt-3 text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
        {label}
      </div>
      <div className="mt-1 text-[22px] tracking-[-0.01em] text-zoru-ink leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-[11px] text-zoru-ink-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/* ── agent card ──────────────────────────────────────────────────── */

function AgentCard({
  agent,
  onToggle,
  onDelete,
  isPending,
}: {
  agent: Agent;
  onToggle: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  return (
    <ZoruCard className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] [&_svg]:size-4",
              agent.isActive
                ? "bg-zoru-ink text-zoru-on-primary"
                : "bg-zoru-surface-2 text-zoru-ink",
            )}
          >
            <Bot />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] text-zoru-ink">{agent.name}</p>
            <p className="mt-0.5 text-[11px] text-zoru-ink-muted">
              Messenger agent
            </p>
          </div>
        </div>
        <ZoruBadge variant={agent.isActive ? "outline" : "secondary"} className="gap-1">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              agent.isActive ? "bg-zoru-success" : "bg-zoru-ink-subtle",
            )}
          />
          {agent.isActive ? "Active" : "Inactive"}
        </ZoruBadge>
      </div>

      <p className="line-clamp-2 min-h-[2.4em] text-[12.5px] text-zoru-ink-muted leading-snug">
        {agent.personality || "No personality set yet."}
      </p>

      {agent.welcomeMessage ? (
        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
          <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-subtle">
            Welcome message
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] text-zoru-ink">
            {agent.welcomeMessage}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-zoru-line pt-3">
        <ZoruButton
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={onToggle}
        >
          {agent.isActive ? <Pause /> : <Play />}
          {agent.isActive ? "Deactivate" : "Activate"}
        </ZoruButton>
        <ZoruButton
          variant="ghost"
          size="icon-sm"
          aria-label="Delete agent"
          onClick={onDelete}
          className="text-zoru-danger hover:text-zoru-danger"
        >
          <Trash2 />
        </ZoruButton>
      </div>
    </ZoruCard>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutate] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const { toast } = useZoruToast();

  const fetchAgents = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { agents: fetched, error: fetchError } = await getFacebookAgents(
        projectId,
      );
      if (fetchError) {
        setError(fetchError);
        return;
      }
      setError(null);
      setAgents((fetched || []) as Agent[]);
    });
  }, [projectId]);

  useEffect(() => {
    setProjectId(localStorage.getItem("activeProjectId"));
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [projectId, fetchAgents]);

  const handleToggle = (agent: Agent) => {
    startMutate(async () => {
      const result = await updateFacebookAgent(agent._id, {
        isActive: !agent.isActive,
      });
      if (result.error) {
        toast({
          title: "Couldn’t update agent",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: agent.isActive ? "Agent deactivated" : "Agent activated",
        description: `${agent.name} is now ${
          agent.isActive ? "inactive" : "active"
        }.`,
        variant: "success",
      });
      fetchAgents();
    });
  };

  const stats = useMemo(() => {
    const active = agents.filter((a) => a.isActive).length;
    return {
      total: agents.length,
      active,
      inactive: agents.length - active,
    };
  }, [agents]);

  if (isLoading && agents.length === 0 && projectId) {
    return <AgentsSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Agents</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5" bordered={false}>
        <ZoruPageHeading>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
            Messenger AI
          </p>
          <ZoruPageTitle>AI agents</ZoruPageTitle>
          <ZoruPageDescription>
            Build, manage and deploy conversational AI agents that handle
            Messenger conversations on this Page.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <div className="flex items-center gap-2">
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={fetchAgents}
            disabled={!projectId}
          >
            <RefreshCw /> Refresh
          </ZoruButton>
          <ZoruButton
            size="sm"
            disabled={!projectId}
            onClick={() => setCreateOpen(true)}
          >
            <Plus /> Create agent
          </ZoruButton>
        </div>
      </ZoruPageHeader>

      {!projectId ? (
        <div className="mt-6">
          <NoProjectState />
        </div>
      ) : error ? (
        <div className="mt-6">
          <ZoruAlert variant="destructive">
            <AlertCircle />
            <ZoruAlertTitle>Couldn’t load agents</ZoruAlertTitle>
            <ZoruAlertDescription>{error}</ZoruAlertDescription>
          </ZoruAlert>
        </div>
      ) : (
        <>
          {/* ── Stats row ── */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="Total agents"
              value={String(stats.total)}
              hint="Configured for this Page"
              icon={<Bot />}
            />
            <StatTile
              label="Active"
              value={String(stats.active)}
              hint="Currently handling conversations"
              icon={<CircleCheck />}
            />
            <StatTile
              label="Inactive"
              value={String(stats.inactive)}
              hint="Paused agents"
              icon={<Pause />}
            />
          </div>

          {/* ── Agents grid ── */}
          {agents.length === 0 ? (
            <div className="mt-6">
              <ZoruEmptyState
                icon={<Sparkles />}
                title="No agents yet"
                description="Create your first AI agent to start automating Messenger replies."
                action={
                  <ZoruButton onClick={() => setCreateOpen(true)}>
                    <Plus /> Create agent
                  </ZoruButton>
                }
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => (
                <AgentCard
                  key={agent._id}
                  agent={agent}
                  isPending={isMutating}
                  onToggle={() => handleToggle(agent)}
                  onDelete={() => setDeleteTarget(agent)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Dialogs ── */}
      {projectId ? (
        <AgentFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId}
          onCreated={fetchAgents}
        />
      ) : null}

      <DeleteAgentDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        agentId={deleteTarget?._id || null}
        agentName={deleteTarget?.name || null}
        onDeleted={fetchAgents}
      />
    </div>
  );
}
