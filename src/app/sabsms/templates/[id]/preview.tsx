"use client";

import { useMemo } from "react";

import { Badge, Card, CardBody, CardDescription, CardHeader, CardTitle, Progress, Separator } from '@/components/sabcrm/20ui/compat';

import type { TemplateEditorMetadata, VariableDefault } from "./types";

/**
 * Live preview pane for the template editor.
 *
 * Features delivered:
 *  - Live char counter + segment / encoding split (#2).
 *  - Cost-per-segment estimate (#3).
 *  - Test interpolation against a sample contact map (#8, via
 *    `sampleVars` passed in from `editor.tsx`).
 *  - Spam likelihood heuristic + Progress (#13).
 *  - Footer policy injection toggle preview (#20).
 *  - Conditional block (`{% if x %}…{% endif %}`) interpolation (#6).
 *  - Date-filter helper rendering (#7), mock evaluator only.
 */

// ─── Segment math (mirrors `send/composer.tsx`) ──────────────────────────

const GSM7_REGEX = /^[\x20-\x7E\n\r£¥€§Æ¡¿äöüÄÖÜñÑàèéìòùÇß]*$/;

export function isGsm(body: string): boolean {
  return GSM7_REGEX.test(body);
}

export function segmentCount(body: string): {
  segments: number;
  encoding: "GSM-7" | "UCS-2";
} {
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

/**
 * Wholesale cost-per-segment in cents (USD), per category.
 * These mirror the engine defaults — the engine is still the source of
 * truth at send time. Used only to drive the live cost-estimate UI.
 */
const COST_PER_SEGMENT_CENTS: Record<string, number> = {
  transactional: 0.75,
  otp: 0.85,
  marketing: 0.95,
  alert: 0.75,
  service: 0.75,
};

export function costEstimateCents(
  segments: number,
  category: string,
): number {
  const rate = COST_PER_SEGMENT_CENTS[category] ?? 0.85;
  return Math.round(segments * rate * 100) / 100;
}

// ─── Spam heuristic (feature #13) ─────────────────────────────────────────

const SPAM_WORDS = [
  "free",
  "winner",
  "congrats",
  "congratulations",
  "click here",
  "act now",
  "limited time",
  "guarantee",
  "$$$",
  "buy now",
  "risk-free",
  "cash",
  "prize",
];

export function spamScore(body: string): number {
  if (!body) return 0;
  const lower = body.toLowerCase();
  let hits = 0;
  for (const w of SPAM_WORDS) {
    if (lower.includes(w)) hits++;
  }
  const letters = body.replace(/[^A-Za-z]/g, "");
  const upperRatio = letters.length
    ? letters.replace(/[^A-Z]/g, "").length / letters.length
    : 0;
  const emoji = (body.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const emojiDensity = emoji / Math.max(1, [...body].length);
  const score =
    Math.min(60, hits * 12) +
    Math.min(25, upperRatio * 100) +
    Math.min(15, emojiDensity * 400);
  return Math.min(100, Math.round(score));
}

// ─── Interpolation (features #6, #7, #8, #20) ─────────────────────────────

function getPath(obj: any, path: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  const keys = path.split(".");
  let val = obj;
  for (const k of keys) {
    if (val === null || val === undefined) return undefined;
    val = val[k];
  }
  return val;
}

export function interpolate(
  template: string,
  payload: Record<string, any>,
  defaults: Record<string, string>,
): string {
  // Conditional blocks first (greedy-safe — non-nesting).
  let out = template.replace(
    /\{%\s*if\s+([\w.]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g,
    (_, key: string, inner: string) => {
      let v = getPath(payload, key);
      if (v === undefined && defaults[key] !== undefined) v = defaults[key];
      return v && v !== "false" && v !== "0" ? inner : "";
    },
  );

  out = out.replace(
    /\{\{\s*now\s*\|\s*date\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g,
    (_, fmt: string) => formatNow(fmt),
  );

  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name: string) => {
    let v = getPath(payload, name);
    if (v === undefined) {
      if (defaults[name] !== undefined) {
        v = defaults[name];
      } else {
        return ""; // Graceful fallback
      }
    }
    return String(v);
  });

  return out;
}

function formatNow(fmt: string): string {
  const now = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return fmt
    .replace(/YYYY/g, String(now.getFullYear()))
    .replace(/MM/g, pad(now.getMonth() + 1))
    .replace(/DD/g, pad(now.getDate()))
    .replace(/HH/g, pad(now.getHours()))
    .replace(/mm/g, pad(now.getMinutes()))
    .replace(/ss/g, pad(now.getSeconds()));
}

// ─── Component ────────────────────────────────────────────────────────────

const FOOTER_TEXT = "\n\nReply STOP to unsubscribe.";

export interface TemplatePreviewProps {
  body: string;
  category: string;
  variableDefaults: VariableDefault[];
  sampleVars: Record<string, any>;
  metadata: TemplateEditorMetadata;
}

export function TemplatePreview({
  body,
  category,
  variableDefaults,
  sampleVars,
  metadata,
}: TemplatePreviewProps) {
  const interpolated = useMemo(() => {
    const defaults: Record<string, string> = {};
    for (const v of variableDefaults) defaults[v.name] = v.defaultValue;
    
    let out = interpolate(body, sampleVars, defaults);
    if (metadata.tendlc.footerInjection) out += FOOTER_TEXT;
    return out;
  }, [body, variableDefaults, sampleVars, metadata.tendlc.footerInjection]);

  const seg = useMemo(() => segmentCount(interpolated), [interpolated]);
  const cost = useMemo(
    () => costEstimateCents(seg.segments, category),
    [seg.segments, category],
  );
  const spam = useMemo(() => spamScore(interpolated), [interpolated]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live preview</CardTitle>
        <CardDescription>
          Interpolated against your sample contact. The engine is the
          source of truth at send time — these numbers are estimates.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm whitespace-pre-wrap font-mono leading-relaxed text-[var(--st-text)] min-h-[7rem]">
          {interpolated || (
            <span className="text-[var(--st-text-secondary)]">Preview will appear here…</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--st-text)]">
          <span>{[...interpolated].length} chars</span>
          <span>·</span>
          <Badge variant="secondary">{seg.encoding}</Badge>
          <span>
            {seg.segments} segment{seg.segments === 1 ? "" : "s"}
          </span>
          <span className="text-[var(--st-text-secondary)]">·</span>
          <span>
            Est.{" "}
            <span className="font-medium text-[var(--st-text)]">
              {cost.toFixed(2)}¢
            </span>{" "}
            per recipient
          </span>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--st-text)]">
              Spam likelihood
            </span>
            <span
              className={
                spam >= 70
                  ? "text-[var(--st-text)]"
                  : spam >= 40
                    ? "text-[var(--st-text)]"
                    : "text-[var(--st-text)]"
              }
            >
              {spam} / 100
            </span>
          </div>
          <Progress
            value={spam}
            indicatorClassName={
              spam >= 70
                ? "bg-[var(--st-text)]"
                : spam >= 40
                  ? "bg-[var(--st-text)]"
                  : "bg-[var(--st-text)]"
            }
          />
          <p className="text-[11px] text-[var(--st-text)]">
            Heuristic only — counts spammy keywords, ALL-CAPS ratio, and
            emoji density.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
