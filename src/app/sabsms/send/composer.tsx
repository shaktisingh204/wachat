"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ZoruBadge,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSeparator,
  ZoruTextarea,
} from "@/components/zoruui";

import type {
  SabsmsMessage,
  SabsmsMessageCategory,
  SabsmsMessageStatus,
} from "@/lib/sabsms/types";

import { fetchSendStatus, submitSend } from "./actions";

const TERMINAL: SabsmsMessageStatus[] = [
  "delivered",
  "failed",
  "undelivered",
  "rejected",
  "suppressed",
];

function statusVariant(s: SabsmsMessageStatus) {
  if (s === "delivered" || s === "sent") return "default" as const;
  if (s === "failed" || s === "rejected" || s === "undelivered")
    return "destructive" as const;
  return "secondary" as const;
}

// Mirror of the GSM-7 / UCS-2 segment math in the Rust engine.
// Lets users see the cost-impact while composing.
function isGsm(body: string): boolean {
  // Approximation — close enough to drive the UI; the engine is the
  // source of truth at send time.
  return /^[\x20-\x7E\n\r£¥€§Æ¡¿äöüÄÖÜñÑàèéìòùÇß]*$/.test(body);
}

function segmentCount(body: string): { segments: number; encoding: "GSM-7" | "UCS-2" } {
  if (!body) return { segments: 0, encoding: "GSM-7" };
  if (isGsm(body)) {
    const len = body.length;
    return {
      segments: len <= 160 ? 1 : Math.ceil(len / 153),
      encoding: "GSM-7",
    };
  }
  const len = [...body].length;
  return {
    segments: len <= 70 ? 1 : Math.ceil(len / 67),
    encoding: "UCS-2",
  };
}

const CATEGORIES: { value: SabsmsMessageCategory; label: string; hint: string }[] = [
  { value: "transactional", label: "Transactional", hint: "Receipts, account updates, alerts" },
  { value: "otp", label: "OTP", hint: "One-time codes — highest priority" },
  { value: "marketing", label: "Marketing", hint: "Promotional content — needs explicit opt-in" },
  { value: "alert", label: "Alert", hint: "Critical notifications" },
  { value: "service", label: "Service", hint: "General service messages" },
];

export function SabsmsSendComposer() {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<SabsmsMessageCategory>("transactional");
  const [submitting, setSubmitting] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [status, setStatus] = useState<SabsmsMessageStatus | null>(null);
  const [message, setMessage] = useState<SabsmsMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const seg = useMemo(() => segmentCount(body), [body]);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setMessageId(null);
    setStatus(null);
    setSubmitting(true);

    const res = await submitSend({ to, body, category });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessageId(res.id);
    setStatus(res.status);
    if (TERMINAL.includes(res.status)) return;

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const next = await fetchSendStatus(res.id);
      if (!next.ok) {
        setError(next.error);
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      setMessage(next.message);
      setStatus(next.message.status);
      if (TERMINAL.includes(next.message.status) && pollRef.current) {
        clearInterval(pollRef.current);
      }
    }, 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <ZoruLabel htmlFor="sabsms-send-to">Recipient (E.164)</ZoruLabel>
          <ZoruInput
            id="sabsms-send-to"
            required
            placeholder="+15551234567"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            autoComplete="tel"
          />
          <p className="text-xs text-slate-500">
            Engine normalises to E.164 before send.
          </p>
        </div>

        <div className="space-y-2">
          <ZoruLabel htmlFor="sabsms-send-category">Category</ZoruLabel>
          <ZoruSelect
            value={category}
            onValueChange={(v) => setCategory(v as SabsmsMessageCategory)}
          >
            <ZoruSelectTrigger id="sabsms-send-category">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {CATEGORIES.map((c) => (
                <ZoruSelectItem key={c.value} value={c.value}>
                  <span className="flex flex-col">
                    <span>{c.label}</span>
                    <span className="text-[11px] text-slate-500">{c.hint}</span>
                  </span>
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
      </div>

      <div className="space-y-2">
        <ZoruLabel htmlFor="sabsms-send-body">Message body</ZoruLabel>
        <ZoruTextarea
          id="sabsms-send-body"
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type your message…"
        />
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>{body.length} chars</span>
          <span>·</span>
          <span>{seg.encoding}</span>
          <span>·</span>
          <span>
            {seg.segments} segment{seg.segments === 1 ? "" : "s"}
          </span>
          <span className="text-slate-400">
            (GSM-7 splits at 160/153, UCS-2 at 70/67)
          </span>
        </div>
      </div>

      <ZoruSeparator />

      <div className="flex flex-wrap items-center gap-3">
        <ZoruButton type="submit" disabled={submitting || !to || !body}>
          {submitting ? "Sending…" : "Send message"}
        </ZoruButton>
        {status && (
          <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
        )}
        {messageId && (
          <code className="rounded bg-slate-100 px-2 py-1 text-xs">
            {messageId}
          </code>
        )}
      </div>

      {error && (
        <p className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {message && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Message doc
          </div>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-700">
            {JSON.stringify(message, null, 2)}
          </pre>
        </div>
      )}
    </form>
  );
}
