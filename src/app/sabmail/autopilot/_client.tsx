"use client";

import * as React from "react";
import {
  Archive,
  Bot,
  Check,
  Clock,
  History,
  Mail,
  Sparkles,
  Tag,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@/components/sabcrm/20ui";
import { ProcessingDots } from "@/components/sabmail/motion";
import type { SabmailAccountRow } from "@/app/actions/sabmail-projects.actions";
import type { AutopilotProposal, AutopilotSuggestion } from "@/lib/sabmail/autopilot";

import {
  applyAutopilotAction,
  getAutopilotProposals,
  listAutopilotAudit,
  type AutopilotAuditRow,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

type SuggestionMeta = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const SUGGESTION_META: Record<AutopilotSuggestion, SuggestionMeta> = {
  archive: { label: "Archive", variant: "secondary", Icon: Archive },
  label: { label: "Label", variant: "outline", Icon: Tag },
  keep: { label: "Keep", variant: "default", Icon: Mail },
};

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SabmailAutopilotClient({
  accounts,
  initialAudit,
}: {
  accounts: SabmailAccountRow[];
  initialAudit: AutopilotAuditRow[];
}) {
  const { toast } = useToast();

  const [accountId, setAccountId] = React.useState<string>(accounts[0]?.id ?? "");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzed, setAnalyzed] = React.useState(false);
  const [proposals, setProposals] = React.useState<AutopilotProposal[]>([]);
  const [applyingUid, setApplyingUid] = React.useState<number | null>(null);
  const [audit, setAudit] = React.useState<AutopilotAuditRow[]>(initialAudit);

  const refreshAudit = React.useCallback(async () => {
    const rows = await listAutopilotAudit();
    setAudit(rows);
  }, []);

  const analyze = React.useCallback(async () => {
    if (!accountId) {
      toast({ title: "Pick a mailbox to analyze.", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    setAnalyzed(true);
    setProposals([]);

    const res = await getAutopilotProposals(accountId);
    setAnalyzing(false);

    if (!res.ok) {
      toast({
        title: "Couldn't analyze the inbox",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    setProposals(res.proposals);
    if (res.proposals.length === 0) {
      toast({ title: "Inbox is clear — nothing to propose." });
    }
  }, [accountId, toast]);

  // Approve = execute the proposed action (the ONLY path that mutates the mailbox).
  const approve = React.useCallback(
    async (p: AutopilotProposal) => {
      setApplyingUid(p.uid);
      const res = await applyAutopilotAction(accountId, {
        uid: p.uid,
        action: p.suggested,
        label: p.label,
      });
      setApplyingUid(null);

      if (!res.ok) {
        toast({
          title: "Could not apply",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      setProposals((prev) => prev.filter((x) => x.uid !== p.uid));
      toast({ title: `${SUGGESTION_META[p.suggested].label} applied` });
      void refreshAudit();
    },
    [accountId, toast, refreshAudit],
  );

  // Dismiss = drop the proposal locally; no mailbox change, no audit.
  const dismiss = React.useCallback((uid: number) => {
    setProposals((prev) => prev.filter((x) => x.uid !== uid));
  }, []);

  if (accounts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Autopilot</PageTitle>
            <PageDescription>
              Let AI propose inbox clean-up actions — you approve every one.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>
        <Card className="mt-6 p-10">
          <EmptyState
            icon={<Mail aria-hidden />}
            title="No mailbox connected"
            description="Connect a mailbox first — then Autopilot can suggest what to archive, label, or keep."
            action={
              <Button variant="primary" size="sm" asChild>
                <a href="/sabmail/accounts">Connect a mailbox</a>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-2">
              <Bot className="h-5 w-5 text-[var(--st-accent)]" aria-hidden />
              Autopilot
            </span>
          </PageTitle>
          <PageDescription>
            AI proposes tidy-up actions for your newest inbox mail — archive,
            label, or keep. Nothing happens until you approve a proposal, and
            every action you approve is recorded in the audit log below.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-6 grid gap-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Analyze inbox</CardTitle>
            <CardDescription>
              Reviews up to 15 of your newest INBOX messages by subject and
              sender — no message bodies are read.
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {accounts.length > 1 ? (
              <Field label="Mailbox">
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a mailbox" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.displayName ? `${a.displayName} · ${a.email}` : a.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--st-text-secondary)]">
                The model only proposes — destructive changes need your explicit
                approval.
              </p>
              <Button
                variant="primary"
                size="sm"
                iconLeft={Sparkles}
                loading={analyzing}
                disabled={analyzing || !accountId}
                onClick={() => void analyze()}
              >
                Analyze inbox
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Proposals */}
        {analyzing ? (
          <Card>
            <CardBody>
              <div className="flex items-center gap-3 py-4 text-sm text-[var(--st-text-secondary)]">
                <ProcessingDots className="text-[var(--st-accent)]" />
                <span>Reading your newest inbox mail and proposing actions…</span>
              </div>
            </CardBody>
          </Card>
        ) : analyzed && proposals.length === 0 ? (
          <Card className="p-10">
            <EmptyState
              icon={<Check aria-hidden />}
              title="Nothing to propose"
              description="Your inbox is already tidy, or you've handled every suggestion. Run Analyze again any time."
            />
          </Card>
        ) : !analyzed ? (
          <Card className="p-10">
            <EmptyState
              icon={<Bot aria-hidden />}
              title="Run Autopilot to get suggestions"
              description="Click “Analyze inbox” and the assistant will propose what to archive, label, or keep — each with a one-line reason and an Approve/Dismiss choice."
            />
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Proposed actions</CardTitle>
              <CardDescription>
                {proposals.length} suggestion{proposals.length === 1 ? "" : "s"} —
                approve to apply, dismiss to ignore.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <ul className="sabmail-motion flex flex-col gap-2">
                {proposals.map((p, idx) => {
                  const meta = SUGGESTION_META[p.suggested];
                  const Icon = meta.Icon;
                  const busy = applyingUid === p.uid;
                  return (
                    <li
                      key={p.uid}
                      className="sabmail-stagger-item flex flex-col gap-3 rounded-md border border-[var(--st-border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      style={{ ["--i" as string]: idx } as React.CSSProperties}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-[var(--st-text)]">
                              {p.subject}
                            </span>
                            <Badge variant={meta.variant} className="shrink-0">
                              {meta.label}
                              {p.suggested === "label" && p.label ? `: ${p.label}` : ""}
                            </Badge>
                          </div>
                          <div className="truncate text-xs text-[var(--st-text-secondary)]">
                            {p.from || "(unknown sender)"}
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                            {p.reason}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={X}
                          disabled={busy}
                          onClick={() => dismiss(p.uid)}
                        >
                          Dismiss
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          iconLeft={Check}
                          loading={busy}
                          disabled={busy}
                          onClick={() => void approve(p)}
                        >
                          Approve
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        )}

        {/* Audit log */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <History className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
                Recent activity
              </span>
            </CardTitle>
            <CardDescription>
              Every approved Autopilot action, with who approved it.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {audit.length === 0 ? (
              <EmptyState
                icon={<History aria-hidden />}
                title="No activity yet"
                description="Approved actions appear here so you always have a record of what changed."
              />
            ) : (
              <ul className="sabmail-motion flex flex-col gap-2">
                {audit.map((row, idx) => (
                  <li
                    key={row.id}
                    className="sabmail-stagger-item flex items-center justify-between gap-3 rounded-md border border-[var(--st-border)] px-3 py-2.5"
                    style={{ ["--i" as string]: idx } as React.CSSProperties}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                        <Bot className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="shrink-0 capitalize">
                            {row.action}
                          </Badge>
                          <span className="truncate text-sm text-[var(--st-text)]">
                            {row.detail}
                          </span>
                        </div>
                        <div className="truncate text-xs text-[var(--st-text-secondary)]">
                          {row.approvedBy ? `Approved by ${row.approvedBy}` : "Approved"}
                          {row.uid != null ? ` · uid ${row.uid}` : ""}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--st-text-secondary)]">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {formatTs(row.ts)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
