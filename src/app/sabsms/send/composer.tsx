"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, Sparkles } from "lucide-react";

import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Input, Label, Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Switch, Textarea } from '@/components/sabcrm/20ui';

import { creditCostFor } from "@/lib/sabsms/credits/rates";
import { countryFromE164 } from "@/lib/sabsms/phone";
import { renderTemplate } from "@/lib/sabsms/render";
import { isGsm7, isGsm7Char, segmentInfo } from "@/lib/sabsms/segments";
import type {
  SabsmsMessage,
  SabsmsMessageCategory,
  SabsmsMessageStatus,
} from "@/lib/sabsms/types";

import {
  fetchSendStatus,
  listSendableTemplates,
  sendSmsAction,
  type SendableTemplate,
} from "./actions";
import { aiAssistAction, type AiAssistMode } from "./ai-assist";

const AI_ASSIST_MODES: { mode: AiAssistMode; label: string }[] = [
  { mode: "shorter", label: "Rewrite shorter" },
  { mode: "friendlier", label: "Friendlier tone" },
  { mode: "add_cta", label: "Add a call to action" },
  { mode: "translate_hindi", label: "Translate to Hindi" },
];

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

// GSM-7 / UCS-2 segment math — engine parity via `@/lib/sabsms/segments`
// (pinned to the Rust engine by the shared segment-vectors fixture).
// UI convention only: an empty body shows 0 segments.
function isGsm(body: string): boolean {
  return isGsm7(body);
}

function segmentCount(body: string): { segments: number; encoding: "GSM-7" | "UCS-2" } {
  if (!body) return { segments: 0, encoding: "GSM-7" };
  const info = segmentInfo(body);
  return {
    segments: info.segments,
    encoding: info.encoding === "gsm7" ? "GSM-7" : "UCS-2",
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
                const isNonGsm = !isGsm7Char(char);
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

const NO_TEMPLATE = "__none__";

export function SabsmsSendComposer() {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<SabsmsMessageCategory>("transactional");
  const [templates, setTemplates] = useState<SendableTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>(NO_TEMPLATE);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [shortenLinks, setShortenLinks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [status, setStatus] = useState<SabsmsMessageStatus | null>(null);
  const [message, setMessage] = useState<SabsmsMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // V2.12 — AI copy-assist (free-form bodies only; templates are locked).
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProposal, setAiProposal] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runAiAssist(mode: AiAssistMode) {
    if (!body.trim() || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    setAiProposal(null);
    const res = await aiAssistAction({ body, mode });
    setAiBusy(false);
    if (res.ok) setAiProposal(res.body);
    else setAiError(res.error);
  }

  useEffect(() => {
    let cancelled = false;
    listSendableTemplates().then((rows) => {
      if (!cancelled) setTemplates(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  /** Named `{{vars}}` of the selected template (positional `#n` slots
   *  surface as numbered inputs too — keyed by their `#n` marker). */
  const templateVarNames = template?.variables ?? [];

  // What will actually go over the wire — the rendered template, or the
  // free-form body. Drives the counter, the preview, and the estimate.
  const effectiveBody = useMemo(() => {
    if (!template) return body;
    const positional = templateVarNames
      .filter((v) => v.startsWith("#"))
      .map((v) => vars[v] ?? "");
    return renderTemplate(template.body, vars, {
      positional: positional.some((p) => p !== "") ? positional : undefined,
    }).text;
  }, [template, body, vars, templateVarNames]);

  const seg = useMemo(() => segmentCount(effectiveBody), [effectiveBody]);
  const deliverability = useDeliverabilityScore(effectiveBody, category, seg.encoding, seg.segments);

  const destinationCountry = useMemo(() => countryFromE164(to), [to]);
  const creditEstimate = useMemo(
    () =>
      seg.segments === 0
        ? 0
        : creditCostFor({
            segments: seg.segments,
            destinationCountry,
            channel: "sms",
          }),
    [seg.segments, destinationCountry],
  );

  function handleTemplateChange(next: string) {
    setTemplateId(next);
    setVars({});
  }

  const MAX_CHARS = 1600;
  const isOverLimit = effectiveBody.length > MAX_CHARS;

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

    const res = await sendSmsAction({
      to,
      body: template ? undefined : body,
      templateId: template ? template.id : undefined,
      // Blank inputs are dropped so the server's missing-variable check
      // fires instead of silently sending empty values.
      vars: template
        ? Object.fromEntries(
            Object.entries(vars).filter(([k, v]) => !k.startsWith("#") && v !== ""),
          )
        : undefined,
      positional: template
        ? templateVarNames.filter((v) => v.startsWith("#")).map((v) => vars[v] ?? "")
        : undefined,
      category,
      shortenLinks,
    });
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
            <Label htmlFor="sabsms-send-template">Template (optional)</Label>
            <Select value={templateId} onValueChange={handleTemplateChange}>
              <SelectTrigger id="sabsms-send-template">
                <SelectValue placeholder="No template — free-form body" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEMPLATE}>No template — free-form body</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span>{t.name}</span>
                      <span className="text-[11px] text-[var(--st-text)]">
                        {t.status} · {t.category}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {template && templateVarNames.length > 0 && (
            <div className="space-y-2 rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-[var(--st-text)]">Variables:</span>
                {templateVarNames.map((name) => (
                  <Badge key={name} variant={vars[name] ? "default" : "secondary"}>
                    {name}
                  </Badge>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {templateVarNames.map((name) => (
                  <div key={name} className="space-y-1">
                    <Label htmlFor={`sabsms-var-${name}`} className="text-xs">
                      {name.startsWith("#") ? `DLT slot ${name}` : `{{${name}}}`}
                    </Label>
                    <Input
                      id={`sabsms-var-${name}`}
                      value={vars[name] ?? ""}
                      onChange={(e) =>
                        setVars((prev) => ({ ...prev, [name]: e.target.value }))
                      }
                      placeholder={name.startsWith("#") ? "value" : name}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sabsms-send-body">
                {template ? "Rendered message (from template)" : "Message body"}
              </Label>
              {!template && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={aiBusy || !body.trim()}
                      iconLeft={aiBusy ? undefined : Sparkles}
                    >
                      {aiBusy ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : null}
                      AI assist
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Rewrite with AI</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {AI_ASSIST_MODES.map((m) => (
                      <DropdownMenuItem
                        key={m.mode}
                        onSelect={() => void runAiAssist(m.mode)}
                      >
                        {m.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {aiProposal !== null && (
              <div
                className="space-y-2 rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3"
                role="region"
                aria-label="AI rewrite proposal"
              >
                <div className="text-xs font-medium text-[var(--st-text-secondary)]">
                  AI rewrite — replace your message?
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-[var(--st-text)]">
                  {aiProposal}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setBody(aiProposal);
                      setAiProposal(null);
                    }}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAiProposal(null)}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            )}
            {aiError && (
              <p className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 text-xs text-[var(--st-text)]">
                {aiError}
              </p>
            )}
            <Textarea
              id="sabsms-send-body"
              required={!template}
              rows={6}
              value={template ? effectiveBody : body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message…"
              readOnly={!!template}
              className={
                (isOverLimit ? "border-[var(--st-border)] focus-visible:ring-[var(--st-border)] " : "") +
                (template ? "opacity-80" : "")
              }
            />
            {template && (
              <p className="text-xs text-[var(--st-text-secondary)]">
                The body comes from the template — clear the template to edit
                freely. Unfilled variables stay as literal placeholders and
                block the send.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between text-xs">
              <div className="flex flex-wrap items-center gap-3 text-[var(--st-text)]">
                <span className={isOverLimit ? "font-semibold text-[var(--st-text)]" : ""}>
                  {effectiveBody.length} / {MAX_CHARS} chars
                </span>
                <span>·</span>
                <span className={seg.encoding === "UCS-2" ? "font-medium text-[var(--st-text)]" : ""}>
                  {seg.encoding}
                </span>
                <span>·</span>
                <span>
                  {seg.segments} segment{seg.segments === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>
                  {creditEstimate} credit{creditEstimate === 1 ? "" : "s"}
                  {destinationCountry ? ` (${destinationCountry})` : " (intl rate)"}
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
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Switch
                id="sabsms-shorten-links"
                checked={shortenLinks}
                onCheckedChange={setShortenLinks}
              />
              <Label
                htmlFor="sabsms-shorten-links"
                className="cursor-pointer text-xs font-normal"
              >
                Shorten links
              </Label>
              <span className="text-[11px] text-[var(--st-text-secondary)]">
                http(s) URLs become tracked short links at send time
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={submitting || !to || !effectiveBody || isOverLimit}>
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
          <SmsPreview body={effectiveBody} />
        </div>
      </div>
    </div>
  );
}
