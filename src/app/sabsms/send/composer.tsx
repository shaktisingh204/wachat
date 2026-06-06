"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { Badge, Button, Input, Label, Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Textarea } from '@/components/sabcrm/20ui/compat';

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
function isGsm(body: string): boolean {
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

function useDeliverabilityScore(body: string, category: SabsmsMessageCategory, encoding: "GSM-7" | "UCS-2", segments: number) {
  return useMemo(() => {
    let score = 100;
    const warnings: { type: "info" | "warning" | "danger", text: string }[] = [];

    if (!body) {
      return { score: 0, grade: "Empty", color: "bg-[var(--st-bg-muted)]", warnings: [] };
    }

    if (encoding === "UCS-2") {
      score -= 10;
      warnings.push({ type: "warning", text: "Unicode encoding reduces segment capacity from 160 to 70 characters." });
    }

    if (segments > 1) {
      score -= (segments - 1) * 5;
      if (segments > 3) {
        warnings.push({ type: "warning", text: `Long message (${segments} segments) has higher risk of delivery issues and costs more.` });
      } else {
        warnings.push({ type: "info", text: `Message spans ${segments} segments. Cost will be multiplied.` });
      }
    }

    const lowerBody = body.toLowerCase();
    const spamWords = ["free", "win", "prize", "guarantee", "cash", "bonus", "click here"];
    const foundSpam = spamWords.filter(w => lowerBody.includes(w));
    if (foundSpam.length > 0) {
      score -= foundSpam.length * 10;
      warnings.push({ type: "danger", text: `Contains spam-trigger words: ${foundSpam.join(", ")}.` });
    }

    if (category === "marketing" && !lowerBody.includes("stop") && !lowerBody.includes("opt-out")) {
      score -= 15;
      warnings.push({ type: "danger", text: "Marketing messages must include opt-out instructions (e.g., 'Reply STOP')." });
    }

    if (body.includes("http://") || body.includes("https://")) {
      if (body.includes("http://")) {
        score -= 20;
        warnings.push({ type: "danger", text: "Unsecured HTTP links are heavily filtered. Use HTTPS." });
      }
      if (body.includes("bit.ly") || body.includes("tinyurl")) {
        score -= 20;
        warnings.push({ type: "danger", text: "Public URL shorteners are often blocked by carriers." });
      }
    }

    score = Math.max(0, Math.min(100, score));

    let grade = "Excellent";
    let color = "bg-[var(--st-text)]";
    if (score < 50) {
      grade = "Poor";
      color = "bg-[var(--st-text)]";
    } else if (score < 80) {
      grade = "Fair";
      color = "bg-[var(--st-text)]";
    } else if (score < 95) {
      grade = "Good";
      color = "bg-[var(--st-text)]";
    }

    return { score, grade, color, warnings };
  }, [body, category, encoding, segments]);
}

function SmsPreview({ body }: { body: string }) {
  const chars = Array.from(body);
  const GSM_REGEX_CHAR = /^[\x20-\x7E\n\r£¥€§Æ¡¿äöüÄÖÜñÑàèéìòùÇß]$/;
  const hasUnicode = !isGsm(body);

  return (
    <div className="flex flex-col rounded-3xl border-[6px] border-[var(--st-border)] bg-[var(--st-bg-muted)] shadow-xl overflow-hidden max-w-[280px] mx-auto w-full aspect-[9/19]">
      <div className="bg-[var(--st-text)] px-4 pt-4 pb-2 relative">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-b-xl z-10"></div>
        <div className="text-center text-xs font-medium text-white/90 mt-2">Live Preview</div>
      </div>
      <div className="flex-1 p-3 flex flex-col justify-end bg-[var(--st-bg-muted)] gap-2 overflow-y-auto">
        <div className="flex flex-col gap-1 items-end w-full">
          {body ? (
            <div className="relative rounded-2xl rounded-tr-sm bg-[var(--st-text)] px-3 py-2 text-[13px] leading-relaxed text-white shadow-sm max-w-[85%] break-words whitespace-pre-wrap">
              {chars.map((char, i) => {
                const isNonGsm = char !== '\n' && char !== '\r' && !GSM_REGEX_CHAR.test(char);
                return (
                  <span
                    key={i}
                    title={isNonGsm ? "Unicode character forcing UCS-2 encoding" : undefined}
                    className={isNonGsm ? "bg-[var(--st-bg-muted)] text-[var(--st-text)] font-semibold px-[1px] rounded-[2px]" : ""}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="relative rounded-2xl rounded-tr-sm bg-[var(--st-bg-muted)] px-3 py-2 text-[13px] leading-relaxed text-[var(--st-text-secondary)] max-w-[85%]">
              Type a message...
            </div>
          )}
          {body && (
            <div className="text-[10px] text-[var(--st-text-secondary)] mr-1 flex gap-2">
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {hasUnicode && <span className="text-[var(--st-text)] font-medium">UCS-2</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const deliverability = useDeliverabilityScore(body, category, seg.encoding, seg.segments);

  const MAX_CHARS = 1600;
  const isOverLimit = body.length > MAX_CHARS;

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isOverLimit) return;
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
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sabsms-send-to">Recipient (E.164)</Label>
              <Input
                id="sabsms-send-to"
                required
                placeholder="+15551234567"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                autoComplete="tel"
              />
              <p className="text-xs text-[var(--st-text)]">
                Engine normalises to E.164 before send.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sabsms-send-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as SabsmsMessageCategory)}
              >
                <SelectTrigger id="sabsms-send-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex flex-col">
                        <span>{c.label}</span>
                        <span className="text-[11px] text-[var(--st-text)]">{c.hint}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sabsms-send-body">Message body</Label>
            <Textarea
              id="sabsms-send-body"
              required
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message…"
              className={isOverLimit ? "border-[var(--st-border)] focus-visible:ring-[var(--st-border)]" : ""}
            />
            <div className="flex flex-wrap items-center justify-between text-xs">
              <div className="flex flex-wrap items-center gap-3 text-[var(--st-text)]">
                <span className={isOverLimit ? "font-semibold text-[var(--st-text)]" : ""}>
                  {body.length} / {MAX_CHARS} chars
                </span>
                <span>·</span>
                <span className={seg.encoding === "UCS-2" ? "font-medium text-[var(--st-text)]" : ""}>
                  {seg.encoding}
                </span>
                <span>·</span>
                <span>
                  {seg.segments} segment{seg.segments === 1 ? "" : "s"}
                </span>
              </div>
              <span className="text-[var(--st-text-secondary)]">
                (GSM-7 splits at 160/153, UCS-2 at 70/67)
              </span>
            </div>
            {isOverLimit && (
              <p className="text-xs font-medium text-[var(--st-text)] mt-1">
                Message exceeds the {MAX_CHARS} character limit.
              </p>
            )}
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={submitting || !to || !body || isOverLimit}>
              {submitting ? "Sending…" : "Send message"}
            </Button>
            {status && (
              <Badge variant={statusVariant(status)}>{status}</Badge>
            )}
            {messageId && (
              <code className="rounded bg-[var(--st-bg-muted)] px-2 py-1 text-xs">
                {messageId}
              </code>
            )}
          </div>

          {error && (
            <p className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
              {error}
            </p>
          )}

          {message && (
            <div className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text)]">
                Message doc
              </div>
              <pre className="overflow-x-auto text-[11px] leading-relaxed text-[var(--st-text)]">
                {JSON.stringify(message, null, 2)}
              </pre>
            </div>
          )}
        </form>
      </div>

      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-xl border border-[var(--st-border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--st-text)]">Deliverability Score</h3>
            <Badge variant={deliverability.score >= 80 ? "default" : deliverability.score >= 50 ? "secondary" : "destructive"}>
              {deliverability.grade}
            </Badge>
          </div>
          
          <div className="mb-4 flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tight text-[var(--st-text)]">{deliverability.score}</span>
            <span className="mb-1 text-sm font-medium text-[var(--st-text)]">/ 100</span>
          </div>
          
          <Progress 
            value={deliverability.score} 
            indicatorClassName={deliverability.color}
            className="h-2 mb-4"
          />

          {deliverability.warnings.length > 0 && (
            <div className="space-y-3 mt-5">
              {deliverability.warnings.map((w, i) => (
                <div key={i} className="flex gap-2.5 text-xs">
                  {w.type === "danger" && <AlertTriangle className="h-4 w-4 text-[var(--st-text)] shrink-0" />}
                  {w.type === "warning" && <AlertCircle className="h-4 w-4 text-[var(--st-text)] shrink-0" />}
                  {w.type === "info" && <Info className="h-4 w-4 text-[var(--st-text)] shrink-0" />}
                  <span className="text-[var(--st-text)] leading-snug">{w.text}</span>
                </div>
              ))}
            </div>
          )}
          {deliverability.warnings.length === 0 && body.length > 0 && (
            <div className="flex gap-2.5 text-xs text-[var(--st-text)] bg-[var(--st-bg-muted)] p-3 rounded-lg mt-4 border border-[var(--st-border)]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--st-text)]" />
              <span className="font-medium">Message looks optimal for delivery.</span>
            </div>
          )}
          {body.length === 0 && (
            <p className="text-xs text-[var(--st-text)] mt-4 text-center">
              Type a message to see its deliverability score.
            </p>
          )}
        </div>

        <div className="flex justify-center pt-2">
          <SmsPreview body={body} />
        </div>
      </div>
    </div>
  );
}
