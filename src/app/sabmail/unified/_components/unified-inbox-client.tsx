"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Mail, MessageSquare, Paperclip, Reply } from "lucide-react";

import { Badge, Button, EmptyState, useToast } from "@/components/sabcrm/20ui";

import { MailAvatar } from "../../inbox/_components/mail-avatar";
import {
  ComposeModal,
  buildReplyPrefill,
  type ComposePrefill,
} from "../../inbox/_components/compose-modal";
import { getSabmailMessage, type SabmailMessageFull } from "../../inbox/actions";
import { loadThread } from "@/app/sabsms/inbox/actions";
import type { InboxThreadView } from "@/app/sabsms/inbox/types";
import {
  openSabsmsConversation,
  type UnifiedConversation,
  type UnifiedInboxData,
} from "../actions";
import "../../_components/sabmail-app.css";

type ChannelFilter = "all" | "email" | "sms";

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function UnifiedInboxClient({ data }: { data: UnifiedInboxData }) {
  const { toast } = useToast();
  const reduce = useReducedMotion();

  const [filter, setFilter] = React.useState<ChannelFilter>("all");
  const [selected, setSelected] = React.useState<UnifiedConversation | null>(null);
  const [emailFull, setEmailFull] = React.useState<SabmailMessageFull | null>(null);
  const [smsThread, setSmsThread] = React.useState<InboxThreadView | null>(null);
  const [reading, setReading] = React.useState(false);
  const [compose, setCompose] = React.useState<ComposePrefill | null>(null);

  const conversations = React.useMemo(
    () => (filter === "all" ? data.conversations : data.conversations.filter((c) => c.channel === filter)),
    [data.conversations, filter],
  );

  const open = React.useCallback(
    async (c: UnifiedConversation) => {
      setSelected(c);
      setEmailFull(null);
      setSmsThread(null);
      setReading(true);
      try {
        if (c.channel === "email" && c.email) {
          const res = await getSabmailMessage(c.email.accountId, c.email.uid);
          if (res.ok) setEmailFull(res.message);
          else toast({ title: "Could not load email", description: res.error, variant: "destructive" });
        } else if (c.channel === "sms" && c.sms) {
          const thread = await loadThread(c.sms.workspaceId, c.sms.conversationId);
          if (thread) setSmsThread(thread);
          else toast({ title: "Could not load conversation", variant: "destructive" });
        }
      } finally {
        setReading(false);
      }
    },
    [toast],
  );

  const replyEmail = React.useCallback(() => {
    if (!emailFull || !data.primaryAccount) return;
    setCompose(buildReplyPrefill(emailFull, "reply", data.primaryAccount.email));
  }, [emailFull, data.primaryAccount]);

  const replySms = React.useCallback(async () => {
    if (!selected?.sms) return;
    await openSabsmsConversation(selected.sms.workspaceId);
    window.location.href = "/sabsms/inbox";
  }, [selected]);

  const counts = React.useMemo(() => {
    let email = 0;
    let sms = 0;
    for (const c of data.conversations) {
      if (c.channel === "email") email += 1;
      else sms += 1;
    }
    return { email, sms, all: data.conversations.length };
  }, [data.conversations]);

  return (
    <div className="sabmail-app flex h-[calc(100vh-3.5rem)] flex-col">
      {/* header / filters */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--st-border)] px-5 py-3">
        <div>
          <h1 className="text-base font-semibold text-[var(--st-text)]">Unified inbox</h1>
          <p className="text-xs text-[var(--st-text-secondary)]">
            Email and SMS in one place
            {data.primaryAccount ? ` · ${data.primaryAccount.email}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-[var(--st-bg-muted)] p-0.5">
          {([
            ["all", `All ${counts.all}`],
            ["email", `Email ${counts.email}`],
            ["sms", `SMS ${counts.sms}`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key as ChannelFilter)}
              className={
                "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
                (filter === key
                  ? "bg-[var(--st-bg)] text-[var(--st-text)] shadow-sm"
                  : "text-[var(--st-text-secondary)] hover:text-[var(--st-text)]")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data.notes.length > 0 ? (
        <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] px-5 py-1.5 text-[11px] text-[var(--st-text-tertiary)]">
          {data.notes.join(" · ")}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* list */}
        <div className="w-full max-w-sm shrink-0 overflow-y-auto border-r border-[var(--st-border)]">
          {conversations.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Mail aria-hidden />}
                title="Nothing here yet"
                description="Connected email and SMS conversations will appear in one merged list."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--st-border)]">
              {conversations.map((c) => {
                const active = selected?.key === c.key;
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={() => void open(c)}
                      className={
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors " +
                        (active ? "bg-[var(--st-accent-soft)]" : "hover:bg-[var(--st-bg-muted)]")
                      }
                    >
                      <div className="relative">
                        <MailAvatar name={c.fromLabel} email={c.channel === "email" ? c.preview : undefined} size={36} />
                        <span
                          className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full ring-2 ring-[var(--st-bg)]"
                          style={{ backgroundColor: c.channel === "email" ? "var(--st-accent)" : "#10b981" }}
                          title={c.channel === "email" ? "Email" : "SMS"}
                        >
                          {c.channel === "email" ? (
                            <Mail className="h-2.5 w-2.5 text-white" aria-hidden />
                          ) : (
                            <MessageSquare className="h-2.5 w-2.5 text-white" aria-hidden />
                          )}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={
                              "truncate text-sm " +
                              (c.unread ? "font-semibold text-[var(--st-text)]" : "text-[var(--st-text)]")
                            }
                          >
                            {c.fromLabel}
                          </span>
                          <span className="shrink-0 text-[11px] text-[var(--st-text-tertiary)]">
                            {relativeTime(c.lastAt)}
                          </span>
                        </div>
                        <div className="truncate text-xs text-[var(--st-text-secondary)]">{c.title}</div>
                        {c.preview && c.channel === "sms" ? (
                          <div className="truncate text-xs text-[var(--st-text-tertiary)]">{c.preview}</div>
                        ) : null}
                      </div>
                      {c.unread ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--st-accent)]" aria-label="Unread" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* reader */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {!selected ? (
            <div className="grid h-full place-items-center p-10">
              <EmptyState
                icon={<Mail aria-hidden />}
                title="Select a conversation"
                description="Pick an email or SMS thread to read it here."
              />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selected.key}
                initial={reduce ? undefined : { opacity: 0, y: 6 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="flex h-full flex-col"
              >
                {/* reader header */}
                <div className="flex items-center justify-between gap-3 border-b border-[var(--st-border)] px-6 py-4">
                  <div className="flex items-center gap-3">
                    <MailAvatar name={selected.fromLabel} size={40} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--st-text)]">{selected.fromLabel}</span>
                        <Badge tone={selected.channel === "email" ? "accent" : "success"} kind="soft" dot>
                          {selected.channel === "email" ? "Email" : "SMS"}
                        </Badge>
                      </div>
                      <div className="text-xs text-[var(--st-text-secondary)]">{selected.title}</div>
                    </div>
                  </div>
                  {selected.channel === "email" ? (
                    <Button variant="primary" size="sm" iconLeft={Reply} onClick={replyEmail} disabled={!emailFull}>
                      Reply
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" iconLeft={ArrowUpRight} onClick={() => void replySms()}>
                      Reply in SabSMS
                    </Button>
                  )}
                </div>

                {/* reader body */}
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  {reading ? (
                    <div className="space-y-2">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--st-bg-muted)]" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--st-bg-muted)]" />
                      <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--st-bg-muted)]" />
                    </div>
                  ) : selected.channel === "email" ? (
                    emailFull ? (
                      <EmailBody full={emailFull} />
                    ) : (
                      <p className="text-sm text-[var(--st-text-tertiary)]">Could not load this email.</p>
                    )
                  ) : smsThread ? (
                    <SmsThread thread={smsThread} />
                  ) : (
                    <p className="text-sm text-[var(--st-text-tertiary)]">Could not load this conversation.</p>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* inline email reply */}
      {data.primaryAccount ? (
        <ComposeModal
          open={compose != null}
          accountId={data.primaryAccount.id}
          accountEmail={data.primaryAccount.email}
          title="Reply"
          prefill={compose ?? undefined}
          onClose={() => setCompose(null)}
          onSent={() => setCompose(null)}
        />
      ) : null}
    </div>
  );
}

/** Render a server-sanitized email body inside a sandboxed iframe (no scripts). */
function EmailBody({ full }: { full: SabmailMessageFull }) {
  const srcDoc = React.useMemo(() => {
    const inner =
      full.html ??
      (full.text ? `<pre style="white-space:pre-wrap;font:inherit">${escapeHtml(full.text)}</pre>` : "");
    return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#111;margin:0;padding:4px}img{max-width:100%}a{color:#2b6ef2}</style></head><body>${inner}</body></html>`;
  }, [full.html, full.text]);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-[var(--st-text)]">{full.subject || "(no subject)"}</h2>
      <div className="mb-4 text-xs text-[var(--st-text-secondary)]">
        From {full.from.name || full.from.email} · {full.date ? new Date(full.date).toLocaleString() : ""}
      </div>
      {full.attachments.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {full.attachments.map((a, i) => (
            <span
              key={`${a.filename}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--st-border)] px-2 py-1 text-xs text-[var(--st-text-secondary)]"
            >
              <Paperclip className="h-3 w-3" aria-hidden />
              <span className="max-w-[180px] truncate">{a.filename}</span>
            </span>
          ))}
        </div>
      ) : null}
      <iframe
        title="Email content"
        sandbox=""
        srcDoc={srcDoc}
        className="h-[55vh] w-full rounded-lg border border-[var(--st-border)] bg-white"
      />
    </div>
  );
}

/** Render an SMS conversation as chat bubbles. */
function SmsThread({ thread }: { thread: InboxThreadView }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2">
      {thread.messages.map((m) => {
        const outbound = m.direction === "outbound";
        return (
          <div key={m.id} className={"flex " + (outbound ? "justify-end" : "justify-start")}>
            <div
              className={
                "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm " +
                (outbound
                  ? "bg-[var(--st-accent)] text-white"
                  : "bg-[var(--st-bg-muted)] text-[var(--st-text)]")
              }
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <div
                className={
                  "mt-0.5 text-[10px] " + (outbound ? "text-white/70" : "text-[var(--st-text-tertiary)]")
                }
              >
                {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
                {outbound && m.status ? ` · ${m.status}` : ""}
              </div>
            </div>
          </div>
        );
      })}
      {thread.messages.length === 0 ? (
        <p className="text-center text-sm text-[var(--st-text-tertiary)]">No messages in this conversation.</p>
      ) : null}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
