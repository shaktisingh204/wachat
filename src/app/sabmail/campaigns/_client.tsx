"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  FlaskConical,
  Megaphone,
  Plus,
  Send,
  Trash2,
  Trophy,
  Users,
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
  useToast,
} from "@/components/sabcrm/20ui";
import { CreatingOverlay } from "@/components/sabmail/motion";
import type { SabmailAccountRow } from "@/app/actions/sabmail-projects.actions";

import { RichTextEditor, type RichTextEditorHandle } from "../_components/rich-text-editor";
import {
  createSabmailCampaign,
  deleteSabmailCampaign,
  listCampaignSegments,
  listRecipientOptions,
  loadCampaignSegmentEmails,
  sendSabmailCampaign,
  type SabmailCampaignRow,
  type SabmailCampaignSegmentOption,
  type SabmailCampaignSendWindow,
  type SabmailCampaignStatus,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

const STATUS_BADGE: Record<
  SabmailCampaignStatus,
  { label: string; variant: "default" | "secondary" | "success" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  sending: { label: "Sending", variant: "default" },
  sent: { label: "Sent", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  scheduled: { label: "Scheduled", variant: "outline" },
};

function countRecipients(raw: string): number {
  const seen = new Set<string>();
  for (const line of raw.split(/[\n,]/)) {
    const email = line.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) seen.add(email);
  }
  return seen.size;
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SabmailCampaignsClient({
  initialCampaigns,
  accounts,
}: {
  initialCampaigns: SabmailCampaignRow[];
  accounts: SabmailAccountRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = React.useState<SabmailCampaignRow[]>(initialCampaigns);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [createErr, setCreateErr] = React.useState<string | null>(null);
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = React.useState(false);
  const [loadingSegment, setLoadingSegment] = React.useState(false);

  // New-campaign form fields.
  const [name, setName] = React.useState("");
  const [accountId, setAccountId] = React.useState<string>(accounts[0]?.id ?? "");
  const [subject, setSubject] = React.useState("");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [recipientsText, setRecipientsText] = React.useState("");
  const editorRef = React.useRef<RichTextEditorHandle>(null);

  // A/B test variant (optional).
  const [abEnabled, setAbEnabled] = React.useState(false);
  const [subjectB, setSubjectB] = React.useState("");
  const [bodyHtmlB, setBodyHtmlB] = React.useState("");
  const [abSplitPct, setAbSplitPct] = React.useState(50);
  const editorBRef = React.useRef<RichTextEditorHandle>(null);

  // Send-time optimization.
  const [sendWindow, setSendWindow] = React.useState<SabmailCampaignSendWindow>("now");

  // Segment targeting.
  const [segments, setSegments] = React.useState<SabmailCampaignSegmentOption[]>([]);
  const [segmentId, setSegmentId] = React.useState<string>("");
  const [segmentsLoaded, setSegmentsLoaded] = React.useState(false);

  const resetForm = React.useCallback(() => {
    setName("");
    setAccountId(accounts[0]?.id ?? "");
    setSubject("");
    setBodyHtml("");
    setRecipientsText("");
    setAbEnabled(false);
    setSubjectB("");
    setBodyHtmlB("");
    setAbSplitPct(50);
    setSendWindow("now");
    setSegmentId("");
    setCreateErr(null);
  }, [accounts]);

  const recipientCount = countRecipients(recipientsText);

  const loadFromContacts = React.useCallback(async () => {
    setLoadingContacts(true);
    try {
      const options = await listRecipientOptions();
      if (options.length === 0) {
        toast({ title: "No contacts found", description: "This workspace has no contacts with emails yet." });
        return;
      }
      setRecipientsText((prev) => {
        const existing = new Set(
          prev
            .split(/[\n,]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        );
        const additions = options.map((o) => o.email).filter((e) => !existing.has(e));
        const merged = [...prev.split(/[\n,]/).map((s) => s.trim()).filter(Boolean), ...additions];
        return merged.join("\n");
      });
      toast({ title: `Loaded ${options.length} contact${options.length === 1 ? "" : "s"}` });
    } finally {
      setLoadingContacts(false);
    }
  }, [toast]);

  // Lazily fetch the segment list the first time the dialog opens.
  const ensureSegments = React.useCallback(async () => {
    if (segmentsLoaded) return;
    setSegmentsLoaded(true);
    try {
      const rows = await listCampaignSegments();
      setSegments(rows);
    } catch {
      // Non-fatal — the picker just stays empty.
    }
  }, [segmentsLoaded]);

  const loadFromSegment = React.useCallback(
    async (id: string) => {
      setSegmentId(id);
      if (!id) return;
      setLoadingSegment(true);
      try {
        const res = await loadCampaignSegmentEmails(id);
        if (!res.ok) {
          toast({ title: "Could not load segment", description: res.error, variant: "destructive" });
          return;
        }
        if (res.emails.length === 0) {
          toast({ title: "No contacts in this segment", description: "Nothing to add." });
          return;
        }
        setRecipientsText((prev) => {
          const existing = new Set(
            prev
              .split(/[\n,]/)
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean),
          );
          const additions = res.emails.filter((e) => !existing.has(e));
          const merged = [
            ...prev.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
            ...additions,
          ];
          return merged.join("\n");
        });
        toast({
          title: `Loaded ${res.emails.length} email${res.emails.length === 1 ? "" : "s"} from segment`,
        });
      } finally {
        setLoadingSegment(false);
      }
    },
    [toast],
  );

  const openNew = React.useCallback(() => {
    resetForm();
    setOpen(true);
    void ensureSegments();
  }, [resetForm, ensureSegments]);

  const handleCreate = React.useCallback(async () => {
    setCreateErr(null);
    if (!name.trim()) {
      setCreateErr("Campaign name is required.");
      return;
    }
    if (!accountId) {
      setCreateErr("Pick a sending mailbox.");
      return;
    }
    if (!subject.trim()) {
      setCreateErr("Subject is required.");
      return;
    }
    if (!bodyHtml.trim()) {
      setCreateErr("Add an email body.");
      return;
    }
    const recipients = parseRecipients(recipientsText);
    if (recipients.length === 0) {
      setCreateErr("Add at least one recipient email.");
      return;
    }

    setBusy(true);
    const res = await createSabmailCampaign({
      name: name.trim(),
      accountId,
      subject: subject.trim(),
      bodyHtml,
      recipients,
      ...(abEnabled
        ? {
            subjectB: subjectB.trim() || undefined,
            bodyHtmlB: bodyHtmlB.trim() ? bodyHtmlB : undefined,
            abSplitPct,
          }
        : {}),
      sendWindow,
    });
    setBusy(false);
    if (!res.ok) {
      setCreateErr(res.error);
      return;
    }
    setCampaigns((prev) => [res.campaign, ...prev]);
    setOpen(false);
    resetForm();
    toast({
      title: "Campaign created",
      description:
        sendWindow === "next-morning"
          ? "Saved as a draft — sending will batch for the next morning."
          : "It's saved as a draft — send when you're ready.",
    });
  }, [
    name,
    accountId,
    subject,
    bodyHtml,
    recipientsText,
    abEnabled,
    subjectB,
    bodyHtmlB,
    abSplitPct,
    sendWindow,
    resetForm,
    toast,
  ]);

  const handleSend = React.useCallback(
    async (id: string) => {
      setSendingId(id);
      const res = await sendSabmailCampaign(id);
      setSendingId(null);
      if (!res.ok) {
        toast({ title: "Send failed", description: res.error, variant: "destructive" });
        return;
      }
      setCampaigns((prev) => prev.map((c) => (c.id === id ? res.campaign : c)));
      if (res.campaign.status === "scheduled") {
        toast({
          title: "Campaign scheduled",
          description: "Recipients are queued to send the next morning (~9am).",
        });
        router.refresh();
        return;
      }
      const { sent, failed } = res.campaign.stats;
      const winnerNote =
        res.campaign.isAbTest && res.campaign.winner
          ? ` · variant ${res.campaign.winner} leads`
          : "";
      toast({
        title: failed === 0 ? "Campaign sent" : "Campaign finished with errors",
        description: `${sent} delivered, ${failed} failed${winnerNote}.`,
        variant: failed > 0 && sent === 0 ? "destructive" : undefined,
      });
      router.refresh();
    },
    [router, toast],
  );

  const handleDelete = React.useCallback(
    async (id: string) => {
      setDeletingId(id);
      const res = await deleteSabmailCampaign(id);
      setDeletingId(null);
      if (!res.ok) {
        toast({ title: "Could not delete campaign", description: res.error, variant: "destructive" });
        return;
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Campaign deleted" });
    },
    [toast],
  );

  const hasAccounts = accounts.length > 0;

  return (
    <div className="sabmail-canvas relative min-h-full p-4 sm:p-6">
      <CreatingOverlay
        show={sendingId !== null}
        variant="process"
        title="Sending campaign…"
        subtitle="Delivering to every recipient — this can take a moment."
      />

      <div className="mx-auto w-full max-w-4xl">
        <PageHeaderBlock onNew={openNew} disabled={!hasAccounts} />

        <div className="mt-6 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Broadcasts</CardTitle>
            <CardDescription>{campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}</CardDescription>
          </CardHeader>
          <CardBody>
            {campaigns.length === 0 ? (
              <EmptyState
                icon={<Megaphone aria-hidden />}
                title="No campaigns yet"
                description={
                  hasAccounts
                    ? "Create a broadcast to send a one-shot email to a list of recipients."
                    : "Connect a mailbox first — campaigns send through a connected account's SMTP."
                }
                action={
                  hasAccounts ? (
                    <Button variant="primary" size="sm" iconLeft={Plus} onClick={openNew}>
                      New campaign
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="sabmail-motion flex flex-col gap-2">
                {campaigns.map((c, idx) => {
                  const badge = STATUS_BADGE[c.status];
                  const isSending = sendingId === c.id || c.status === "sending";
                  return (
                    <li
                      key={c.id}
                      className="sabmail-stagger-item sabmail-listrow flex items-center justify-between gap-3 rounded-lg border border-[var(--st-border)] px-3 py-2.5 hover:bg-[var(--st-bg-muted)]"
                      style={{ ["--i" as string]: idx } as React.CSSProperties}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                          <Megaphone className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[var(--st-text)]">{c.name}</div>
                          <div className="truncate text-xs text-[var(--st-text-secondary)]">
                            {c.subject}
                            {" · "}
                            {c.stats.total} recipient{c.stats.total === 1 ? "" : "s"}
                            {c.status === "sent" || c.status === "failed"
                              ? ` · ${c.stats.sent} sent${c.stats.failed ? `, ${c.stats.failed} failed` : ""}`
                              : ""}
                            {c.isAbTest && (c.status === "sent" || c.status === "failed")
                              ? ` · A ${c.stats.aSent ?? 0}/B ${c.stats.bSent ?? 0}`
                              : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {c.isAbTest ? (
                          <Badge variant="outline" className="gap-1">
                            {c.winner ? (
                              <Trophy className="h-3 w-3" aria-hidden />
                            ) : (
                              <FlaskConical className="h-3 w-3" aria-hidden />
                            )}
                            {c.winner ? `Variant ${c.winner}` : "A/B"}
                          </Badge>
                        ) : null}
                        <Badge variant={badge.variant} className="gap-1">
                          {c.status === "sent" ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : null}
                          {c.status === "scheduled" ? <Clock className="h-3 w-3" aria-hidden /> : null}
                          {badge.label}
                        </Badge>
                        {c.status === "draft" ? (
                          <Button
                            variant="primary"
                            size="sm"
                            iconLeft={Send}
                            loading={isSending}
                            disabled={isSending}
                            onClick={() => void handleSend(c.id)}
                          >
                            Send
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={Trash2}
                          loading={deletingId === c.id}
                          disabled={deletingId === c.id || isSending}
                          onClick={() => void handleDelete(c.id)}
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

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : (setOpen(false), resetForm()))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Send a one-shot broadcast through a connected mailbox. Recipients are one email per line.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Campaign name" error={createErr && !name.trim() ? createErr : undefined}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. June product update"
                maxLength={160}
              />
            </Field>

            <Field label="Send from mailbox">
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

            <Field label="Subject">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
                maxLength={300}
              />
            </Field>

            <Field label="Body">
              <RichTextEditor
                ref={editorRef}
                onChange={setBodyHtml}
                ariaLabel="Campaign body"
                placeholder="Write your broadcast…"
              />
            </Field>

            {/* ── A/B test (optional) ─────────────────────────────────── */}
            <div className="rounded-md border border-[var(--st-border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
                  <FlaskConical className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
                  A/B test
                </div>
                <Button
                  type="button"
                  variant={abEnabled ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setAbEnabled((v) => !v)}
                >
                  {abEnabled ? "On" : "Off"}
                </Button>
              </div>
              {abEnabled ? (
                <div className="mt-3 grid gap-4">
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    Recipients split ~{abSplitPct}% to variant A / {100 - abSplitPct}% to variant B.
                    Leave a variant field blank to reuse the A copy.
                  </p>
                  <Field label="Subject (variant B)">
                    <Input
                      value={subjectB}
                      onChange={(e) => setSubjectB(e.target.value)}
                      placeholder="Alternate subject line"
                      maxLength={300}
                    />
                  </Field>
                  <Field label="Body (variant B)">
                    <RichTextEditor
                      ref={editorBRef}
                      onChange={setBodyHtmlB}
                      ariaLabel="Campaign body variant B"
                      placeholder="Alternate broadcast body…"
                    />
                  </Field>
                  <Field label={`Split to variant A (${abSplitPct}%)`}>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={String(abSplitPct)}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) setAbSplitPct(Math.min(99, Math.max(1, Math.round(n))));
                      }}
                    />
                  </Field>
                </div>
              ) : null}
            </div>

            {/* ── Send-time optimization ──────────────────────────────── */}
            <Field label="When to send">
              <Select
                value={sendWindow}
                onValueChange={(v) => setSendWindow(v as SabmailCampaignSendWindow)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="When to send" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">Send immediately</SelectItem>
                  <SelectItem value="next-morning">Optimize — next morning (~9am)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={`Recipients${recipientCount ? ` (${recipientCount})` : ""}`}
              error={createErr && (!accountId || !subject.trim() || recipientCount === 0) ? createErr : undefined}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5">
                <span className="text-xs text-[var(--st-text-secondary)]">One email per line.</span>
                <div className="flex items-center gap-2">
                  <div className="min-w-[12rem]">
                    <Select value={segmentId} onValueChange={(v) => void loadFromSegment(v)}>
                      <SelectTrigger disabled={loadingSegment || segments.length === 0}>
                        <SelectValue
                          placeholder={
                            segments.length === 0 ? "No segments" : "Load from segment"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {segments.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    iconLeft={Users}
                    loading={loadingContacts}
                    disabled={loadingContacts}
                    onClick={() => void loadFromContacts()}
                  >
                    Load from contacts
                  </Button>
                </div>
              </div>
              <Textarea
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                placeholder={"alice@example.com\nbob@example.com"}
                rows={6}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              loading={busy}
              disabled={busy}
              onClick={() => void handleCreate()}
            >
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PageHeaderBlock({ onNew, disabled }: { onNew: () => void; disabled: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-[var(--st-text)]">Campaigns</h1>
        <p className="max-w-xl text-sm text-[var(--st-text-secondary)]">
          One-shot email broadcasts. Compose a message, pick a connected mailbox, and send to a list of
          recipients.
        </p>
      </div>
      <Button variant="primary" size="sm" iconLeft={Plus} onClick={onNew} disabled={disabled}>
        New campaign
      </Button>
    </div>
  );
}
