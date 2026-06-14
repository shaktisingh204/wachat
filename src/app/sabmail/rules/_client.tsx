"use client";

import * as React from "react";
import {
  Archive,
  CheckCircle2,
  Eye,
  MailCheck,
  Plus,
  Power,
  PowerOff,
  Sparkles,
  Tag,
  Trash2,
  Wand2,
  Workflow,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";

import {
  createSabmailRuleFromNl,
  deleteSabmailRule,
  previewSabmailRule,
  toggleSabmailRule,
  type SabmailRulePreviewSample,
  type SabmailRuleRow,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

interface AccountOption {
  id: string;
  email: string;
  displayName: string | null;
  provider: string;
}

type CompiledShape = SabmailRuleRow["compiled"];

const ACTION_META: Record<
  CompiledShape["action"],
  { label: string; Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> }
> = {
  label: { label: "Label", Icon: Tag },
  archive: { label: "Archive", Icon: Archive },
  markRead: { label: "Mark read", Icon: MailCheck },
};

/** Build the human-readable one-liner the same way the engine does. */
function describeCompiled(compiled: CompiledShape): string {
  const conds: string[] = [];
  if (compiled.match.fromContains) conds.push(`from contains “${compiled.match.fromContains}”`);
  if (compiled.match.subjectContains) conds.push(`subject contains “${compiled.match.subjectContains}”`);
  if (typeof compiled.match.olderThanDays === "number") {
    conds.push(
      `older than ${compiled.match.olderThanDays} day${compiled.match.olderThanDays === 1 ? "" : "s"}`,
    );
  }
  const when = conds.length ? conds.join(" and ") : "any message";
  const act =
    compiled.action === "archive"
      ? "archive it"
      : compiled.action === "markRead"
        ? "mark it read"
        : `label it “${compiled.label ?? ""}”`;
  return `When ${when}, ${act}.`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SabmailRulesClient({
  initialRules,
  accounts,
}: {
  initialRules: SabmailRuleRow[];
  accounts: AccountOption[];
}) {
  const { toast } = useToast();
  const [rules, setRules] = React.useState<SabmailRuleRow[]>(initialRules);

  // New-rule dialog state.
  const [newOpen, setNewOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [nl, setNl] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [createErr, setCreateErr] = React.useState<string | null>(null);
  const [compiledPreview, setCompiledPreview] = React.useState<CompiledShape | null>(null);

  // Per-row busy + preview state.
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Preview dialog state.
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewRule, setPreviewRule] = React.useState<SabmailRuleRow | null>(null);
  const [previewAccountId, setPreviewAccountId] = React.useState<string>(accounts[0]?.id ?? "");
  const [previewing, setPreviewing] = React.useState(false);
  const [previewErr, setPreviewErr] = React.useState<string | null>(null);
  const [previewResult, setPreviewResult] = React.useState<{
    count: number;
    scanned: number;
    sample: SabmailRulePreviewSample[];
  } | null>(null);

  const resetNew = React.useCallback(() => {
    setName("");
    setNl("");
    setCreateErr(null);
    setCompiledPreview(null);
  }, []);

  const handleCreate = React.useCallback(async () => {
    const desc = nl.trim();
    if (!desc) {
      setCreateErr("Describe the rule in a sentence first.");
      return;
    }
    setCreating(true);
    setCreateErr(null);
    setCompiledPreview(null);
    const res = await createSabmailRuleFromNl({ name: name.trim(), nl: desc });
    if (!res.ok) {
      setCreateErr(res.error);
      setCreating(false);
      return;
    }
    setRules((prev) => [res.rule, ...prev]);
    setCompiledPreview(res.rule.compiled);
    setCreating(false);
    toast({ title: "Rule created", description: describeCompiled(res.rule.compiled) });
  }, [name, nl, toast]);

  const handleToggle = React.useCallback(
    async (rule: SabmailRuleRow) => {
      const next = !rule.enabled;
      setTogglingId(rule.id);
      const res = await toggleSabmailRule(rule.id, next);
      if (!res.ok) {
        toast({ title: "Could not update rule", description: res.error, variant: "destructive" });
        setTogglingId(null);
        return;
      }
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: next } : r)));
      setTogglingId(null);
      toast({ title: next ? "Rule enabled" : "Rule paused" });
    },
    [toast],
  );

  const handleDelete = React.useCallback(
    async (id: string) => {
      setDeletingId(id);
      const res = await deleteSabmailRule(id);
      if (!res.ok) {
        toast({ title: "Could not delete rule", description: res.error, variant: "destructive" });
        setDeletingId(null);
        return;
      }
      setRules((prev) => prev.filter((r) => r.id !== id));
      setDeletingId(null);
      toast({ title: "Rule deleted" });
    },
    [toast],
  );

  const openPreview = React.useCallback(
    (rule: SabmailRuleRow) => {
      setPreviewRule(rule);
      setPreviewErr(null);
      setPreviewResult(null);
      setPreviewAccountId((curr) => curr || accounts[0]?.id || "");
      setPreviewOpen(true);
    },
    [accounts],
  );

  const runPreview = React.useCallback(async () => {
    if (!previewRule) return;
    if (!previewAccountId) {
      setPreviewErr("Pick a mailbox to preview against.");
      return;
    }
    setPreviewing(true);
    setPreviewErr(null);
    setPreviewResult(null);
    const res = await previewSabmailRule(previewRule.id, previewAccountId);
    if (!res.ok) {
      setPreviewErr(res.error);
      setPreviewing(false);
      return;
    }
    setPreviewResult({ count: res.count, scanned: res.scanned, sample: res.sample });
    setPreviewing(false);
  }, [previewRule, previewAccountId]);

  return (
    <div className="sabmail-canvas min-h-full p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--st-text)]">Rules</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--st-text-secondary)]">
              Describe what to do with incoming mail in plain language — SabMail
              compiles it into a structured rule. Rules run on the inbox you open
              and via automation; live auto-apply lands with the sync engine.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            className="shrink-0"
            onClick={() => {
              resetNew();
              setNewOpen(true);
            }}
          >
            New rule
          </Button>
        </div>

        <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Your rules</CardTitle>
            <CardDescription>
              {rules.length} rule{rules.length === 1 ? "" : "s"}
              {rules.length
                ? ` · ${rules.filter((r) => r.enabled).length} active`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardBody>
            {rules.length === 0 ? (
              <EmptyState
                icon={<Workflow aria-hidden />}
                title="No rules yet"
                description="Write a rule in plain English — e.g. “Archive newsletters older than 30 days” — and SabMail turns it into a structured inbox rule."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => {
                      resetNew();
                      setNewOpen(true);
                    }}
                  >
                    New rule
                  </Button>
                }
              />
            ) : (
              <ul className="sabmail-motion flex flex-col gap-2">
                {rules.map((rule, idx) => {
                  const meta = ACTION_META[rule.compiled.action];
                  const ActionIcon = meta.Icon;
                  return (
                    <li
                      key={rule.id}
                      data-selected={false}
                      className="sabmail-stagger-item sabmail-listrow flex items-start justify-between gap-3 rounded-lg border border-[var(--st-border)] px-3 py-3 hover:bg-[var(--st-bg-muted)]"
                      style={{ ["--i" as string]: idx } as React.CSSProperties}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                          <ActionIcon className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-[var(--st-text)]">
                              {rule.name}
                            </span>
                            <Badge variant={rule.enabled ? "success" : "outline"}>
                              {rule.enabled ? "Active" : "Paused"}
                            </Badge>
                            <Badge variant="secondary">{meta.label}</Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-[var(--st-text-secondary)]">
                            {describeCompiled(rule.compiled)}
                          </p>
                          {rule.nl ? (
                            <p className="mt-0.5 truncate text-xs italic text-[var(--st-text-secondary)]">
                              “{rule.nl}”
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={Eye}
                          onClick={() => openPreview(rule)}
                        >
                          Preview
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={rule.enabled ? PowerOff : Power}
                          loading={togglingId === rule.id}
                          disabled={togglingId === rule.id}
                          onClick={() => void handleToggle(rule)}
                        >
                          {rule.enabled ? "Pause" : "Enable"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={Trash2}
                          loading={deletingId === rule.id}
                          disabled={deletingId === rule.id}
                          onClick={() => void handleDelete(rule.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
        </div>
      </div>

      {/* New rule */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New rule</DialogTitle>
            <DialogDescription>
              Name it, then describe what to do in a sentence. SabMail compiles
              your description into a structured rule and shows you the result.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field label="Name (optional)">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Archive old newsletters"
              />
            </Field>
            <Field label="What should this rule do?" error={createErr ?? undefined}>
              <Textarea
                value={nl}
                onChange={(e) => {
                  setNl(e.target.value);
                  if (compiledPreview) setCompiledPreview(null);
                }}
                placeholder={
                  "e.g. Archive anything from notifications@github.com that's older than 14 days"
                }
                rows={4}
              />
            </Field>

            {compiledPreview ? (
              <div className="flex flex-col gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--st-text)]">
                  <CheckCircle2 className="h-4 w-4 text-[var(--st-status-ok,#16a34a)]" aria-hidden />
                  Compiled rule
                </div>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  {describeCompiled(compiledPreview)}
                </p>
                <pre className="overflow-x-auto rounded bg-[var(--st-bg)] p-2 text-[11px] leading-relaxed text-[var(--st-text-secondary)]">
                  {JSON.stringify(compiledPreview, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Saving compiles your description with AI, then shows the
                structured rule it produced.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewOpen(false)}
              disabled={creating}
            >
              {compiledPreview ? "Done" : "Cancel"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Wand2}
              loading={creating}
              disabled={creating || !nl.trim()}
              onClick={() => void handleCreate()}
            >
              {compiledPreview ? "Save again" : "Compile & save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview rule</DialogTitle>
            <DialogDescription>
              {previewRule
                ? describeCompiled(previewRule.compiled)
                : "See which inbox messages this rule would catch."}{" "}
              This is read-only — nothing is archived, labelled, or marked.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {accounts.length === 0 ? (
              <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-xs text-[var(--st-text-secondary)]">
                Connect a mailbox first to preview rules against your inbox.
              </div>
            ) : (
              <Field label="Mailbox" error={previewErr ?? undefined}>
                <Select value={previewAccountId} onValueChange={setPreviewAccountId}>
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
            )}

            {previewResult ? (
              <div className="flex flex-col gap-2">
                <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm text-[var(--st-text)]">
                  <span className="font-medium">{previewResult.count}</span> message
                  {previewResult.count === 1 ? "" : "s"} in your inbox match this rule
                  <span className="text-[var(--st-text-secondary)]">
                    {" "}
                    (scanned {previewResult.scanned}).
                  </span>
                </div>
                {previewResult.sample.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {previewResult.sample.map((m) => (
                      <li
                        key={m.uid}
                        className="rounded-md border border-[var(--st-border)] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-[var(--st-text)]">
                            {m.subject}
                          </span>
                          <span className="shrink-0 text-xs text-[var(--st-text-secondary)]">
                            {formatWhen(m.date)}
                          </span>
                        </div>
                        <span className="truncate text-xs text-[var(--st-text-secondary)]">
                          {m.fromName ? `${m.fromName} · ` : ""}
                          {m.fromEmail || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    No inbox messages match this rule right now.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(false)}
              disabled={previewing}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Eye}
              loading={previewing}
              disabled={previewing || accounts.length === 0 || !previewAccountId}
              onClick={() => void runPreview()}
            >
              Run preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
