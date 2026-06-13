"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock, Paperclip, Send, Sparkles, X } from "lucide-react";

import { Button, Input, useToast } from "@/components/sabcrm/20ui";
import { SabFilePickerButton, type SabFilePick } from "@/components/sabfiles";
import { CreatingOverlay, Spinner, SuccessCheck } from "@/components/sabmail/motion";

import { RecipientChips } from "../../_components/recipient-chips";
import { RichTextEditor, type RichTextEditorHandle } from "../../_components/rich-text-editor";
import { aiWriteCompose, sendSabmailMessage } from "../actions";
import { scheduleSabmailSend } from "../../scheduled/actions";

export interface ComposePrefill {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string[];
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function ComposeModal({
  open,
  accountId,
  accountEmail,
  title = "New message",
  prefill,
  onClose,
  onSent,
}: {
  open: boolean;
  accountId: string;
  accountEmail: string;
  title?: string;
  prefill?: ComposePrefill;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { toast } = useToast();
  const reduce = useReducedMotion();

  const [to, setTo] = React.useState<string[]>(prefill?.to ?? []);
  const [cc, setCc] = React.useState<string[]>(prefill?.cc ?? []);
  const [bcc, setBcc] = React.useState<string[]>(prefill?.bcc ?? []);
  const [showCc, setShowCc] = React.useState(!!(prefill?.cc?.length || prefill?.bcc?.length));
  const [subject, setSubject] = React.useState(prefill?.subject ?? "");
  const bodyRef = React.useRef(prefill?.bodyHtml ?? "");
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [attachments, setAttachments] = React.useState<{ filename: string; url: string }[]>([]);
  const editorRef = React.useRef<RichTextEditorHandle>(null);

  const writeWithAi = React.useCallback(async () => {
    const instruction = window.prompt("What should this email say?");
    if (!instruction?.trim()) return;
    setAiBusy(true);
    const res = await aiWriteCompose(instruction.trim());
    setAiBusy(false);
    if (!res.ok) {
      toast({ title: "AI unavailable", description: res.error, variant: "destructive" });
      return;
    }
    const html = textToHtml(res.text);
    bodyRef.current = html;
    editorRef.current?.setHtml(html);
  }, [toast]);

  const performSend = React.useCallback(async () => {
    if (to.length === 0) {
      toast({ title: "Add a recipient", variant: "destructive" });
      return;
    }
    setSending(true);
    const res = await sendSabmailMessage({
      accountId,
      to,
      cc,
      bcc,
      subject,
      html: bodyRef.current,
      inReplyTo: prefill?.inReplyTo,
      references: prefill?.references,
      attachments,
    });
    if (!res.ok) {
      setSending(false);
      toast({ title: "Could not send", description: res.error, variant: "destructive" });
      return;
    }
    setSending(false);
    setDone(true);
    window.setTimeout(() => {
      onSent?.();
      onClose();
    }, 900);
  }, [to, cc, bcc, subject, accountId, prefill, toast, onSent, onClose]);

  // Undo-send: hold the send for 5s with an Undo affordance, then deliver.
  const [undoing, setUndoing] = React.useState(false);
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = React.useCallback(() => {
    if (to.length === 0) {
      toast({ title: "Add a recipient", variant: "destructive" });
      return;
    }
    setUndoing(true);
    undoTimerRef.current = setTimeout(() => {
      setUndoing(false);
      undoTimerRef.current = null;
      void performSend();
    }, 5000);
  }, [to, toast, performSend]);

  const cancelUndo = React.useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoing(false);
  }, []);

  const sendNow = React.useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoing(false);
    void performSend();
  }, [performSend]);

  React.useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    [],
  );

  const [showSchedule, setShowSchedule] = React.useState(false);
  const [sendAt, setSendAt] = React.useState("");
  const [scheduling, setScheduling] = React.useState(false);

  const scheduleSend = React.useCallback(async () => {
    if (to.length === 0) {
      toast({ title: "Add a recipient", variant: "destructive" });
      return;
    }
    const when = new Date(sendAt);
    if (!sendAt || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast({ title: "Pick a future date & time", variant: "destructive" });
      return;
    }
    setScheduling(true);
    const res = await scheduleSabmailSend({
      accountId,
      to,
      cc,
      bcc,
      subject,
      html: bodyRef.current,
      sendAtISO: when.toISOString(),
    });
    setScheduling(false);
    if (!res.ok) {
      toast({ title: "Could not schedule", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Scheduled", description: `Will send ${when.toLocaleString()}` });
    onSent?.();
    onClose();
  }, [to, cc, bcc, subject, accountId, sendAt, toast, onSent, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--st-bg)_70%,transparent)] p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)] shadow-2xl"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CreatingOverlay
              show={sending}
              variant="connect"
              title="Sending…"
              subtitle={accountEmail}
              icon={<Send className="h-1/2 w-1/2" />}
            />
            <AnimatePresence>
              {done ? (
                <motion.div
                  className="absolute inset-0 z-10 grid place-items-center bg-[var(--st-bg)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <SuccessCheck size={56} />
                    <p className="text-sm font-medium text-[var(--st-text)]">Sent</p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {undoing ? (
                <motion.div
                  className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  <span className="inline-flex items-center gap-2 text-sm text-[var(--st-text)]">
                    <Spinner size={14} /> Sending…
                  </span>
                  <span className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelUndo}>
                      Undo
                    </Button>
                    <Button variant="primary" size="sm" onClick={sendNow}>
                      Send now
                    </Button>
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* header */}
            <div className="flex items-center justify-between border-b border-[var(--st-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--st-text)]">{title}</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* fields */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
              <div className="relative">
                <RecipientChips label="To" value={to} onChange={setTo} placeholder="recipient@example.com" autoFocus />
                {!showCc ? (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="absolute right-1 top-2.5 text-xs text-[var(--st-text-secondary)] underline-offset-2 hover:underline"
                  >
                    Cc/Bcc
                  </button>
                ) : null}
              </div>
              {showCc ? (
                <>
                  <RecipientChips label="Cc" value={cc} onChange={setCc} />
                  <RecipientChips label="Bcc" value={bcc} onChange={setBcc} />
                </>
              ) : null}
              <div className="flex items-center gap-2 border-b border-[var(--st-border)] px-1 py-2">
                <span className="w-10 shrink-0 text-xs font-medium text-[var(--st-text-secondary)]">Subj</span>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <RichTextEditor
                ref={editorRef}
                className="py-3"
                initialHtml={prefill?.bodyHtml}
                onChange={(html) => {
                  bodyRef.current = html;
                }}
              />

              {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2 pb-3">
                  {attachments.map((a, i) => (
                    <span
                      key={`${a.url}-${i}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--st-border)] px-2 py-1 text-xs text-[var(--st-text-secondary)]"
                    >
                      <Paperclip className="h-3 w-3" aria-hidden />
                      <span className="max-w-[160px] truncate">{a.filename}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${a.filename}`}
                        onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="opacity-70 hover:opacity-100"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {showSchedule ? (
              <div className="flex items-center gap-2 border-t border-[var(--st-border)] px-4 py-2">
                <Clock className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" aria-hidden />
                <input
                  type="datetime-local"
                  value={sendAt}
                  onChange={(e) => setSendAt(e.target.value)}
                  className="rounded-md border border-[var(--st-border)] bg-transparent px-2 py-1 text-sm text-[var(--st-text)] outline-none"
                />
                <Button
                  variant="primary"
                  size="sm"
                  loading={scheduling}
                  disabled={scheduling}
                  onClick={() => void scheduleSend()}
                >
                  Schedule
                </Button>
              </div>
            ) : null}

            {/* footer */}
            <div className="flex items-center justify-between gap-2 border-t border-[var(--st-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" iconLeft={Send} onClick={() => void send()} disabled={sending || undoing}>
                  Send
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={aiBusy ? undefined : Sparkles}
                  onClick={() => void writeWithAi()}
                  disabled={aiBusy || sending}
                >
                  {aiBusy ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Spinner size={14} /> Writing…
                    </span>
                  ) : (
                    "Write with AI"
                  )}
                </Button>
                <SabFilePickerButton
                  variant="ghost"
                  onPick={(pick: SabFilePick) =>
                    setAttachments((prev) => [...prev, { filename: pick.name, url: pick.url }])
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Paperclip className="h-4 w-4" aria-hidden /> Attach
                  </span>
                </SabFilePickerButton>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Clock}
                  onClick={() => setShowSchedule((v) => !v)}
                  disabled={sending}
                >
                  Send later
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} disabled={sending}>
                Discard
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Build reply / forward prefill from a full message. */
export function buildReplyPrefill(
  full: {
    subject: string;
    from: { name: string; email: string };
    to: string[];
    cc: string[];
    date: string | null;
    html: string | null;
    text: string | null;
    messageId: string | null;
    references: string[];
  },
  mode: "reply" | "replyAll" | "forward",
  selfEmail: string,
): ComposePrefill {
  const quotedHeader = `On ${full.date ? new Date(full.date).toLocaleString() : ""}, ${
    full.from.name || full.from.email
  } wrote:`;
  const quotedBody = full.html ?? (full.text ? `<pre>${escapeHtml(full.text)}</pre>` : "");
  const quoted = `<br><br><blockquote>${escapeHtml(quotedHeader)}<br>${quotedBody}</blockquote>`;

  const stripPrefix = (s: string, re: RegExp) => s.replace(re, "").trim();
  const references = [...full.references, ...(full.messageId ? [full.messageId] : [])];

  if (mode === "forward") {
    return {
      subject: `Fwd: ${stripPrefix(full.subject, /^fwd:\s*/i)}`,
      bodyHtml: quoted,
    };
  }

  const replyTo = [full.from.email].filter((e) => e && e !== selfEmail);
  const replyCc =
    mode === "replyAll"
      ? dedupeAddrs([...full.to, ...full.cc], [selfEmail, full.from.email])
      : [];

  return {
    to: replyTo,
    cc: replyCc,
    subject: `Re: ${stripPrefix(full.subject, /^re:\s*/i)}`,
    bodyHtml: quoted,
    inReplyTo: full.messageId ?? undefined,
    references,
  };
}

function dedupeAddrs(list: string[], exclude: string[]): string[] {
  const ex = new Set(exclude.map((e) => e.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const email = (raw.match(/<([^>]+)>/)?.[1] ?? raw).trim().toLowerCase();
    if (!email || ex.has(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(raw);
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Convert plain text (with newlines) to safe HTML paragraphs. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
