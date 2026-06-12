"use client";

/**
 * SabSMS V2.8 — live DLT scrub card for the template editor.
 *
 * Binds the SabSMS template to a registered DLT content template +
 * header (from the workspace registry managed at
 * `/sabsms/compliance/dlt`) and runs the current body through the
 * engine's `POST /v1/dlt/scrub-preview` (debounced 500ms) so the
 * author sees "would this pass operator scrubbing?" while typing.
 *
 * The binding itself persists on the SabSMS template doc through the
 * existing `metadata.dlt` fields (`templateId` / `headerId` /
 * `principalEntityId` / `contentCategory` → `doc.dlt`), which the
 * engine's auto-attach reads at send time.
 */

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Loader2,
  MinusCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@/components/sabcrm/20ui";

import { dltScrubPreviewAction } from "../../compliance/dlt/actions";
import {
  DLT_CATEGORY_LABELS,
  type DltCategory,
} from "../../compliance/dlt/schema";
import type {
  SabsmsDltScrubPreview,
  SabsmsDltTraceEntry,
} from "@/lib/sabsms/engine-client";

// ─── Slim registry shape the editor page loads server-side ───────────────

export interface DltBindingRegistry {
  templates: Array<{
    templateId: string;
    body: string;
    category: DltCategory;
    peId: string;
  }>;
  headers: Array<{
    headerId: string;
    header: string;
    category: DltCategory;
  }>;
}

export interface DltBindingPatch {
  templateId?: string;
  headerId?: string;
  principalEntityId?: string;
  contentCategory?: string;
}

const NONE = "__none__";

const CHECK_LABELS: Record<string, string> = {
  dlt_header_registered: "Header registered",
  dlt_header_bound: "Header bound to template",
  dlt_template_match: "Template body match",
  dlt_chain: "PE → TM chain",
  dlt_category_content: "Category vs content",
};

function checkLabel(check: string): string {
  return CHECK_LABELS[check] ?? check.replace(/^dlt_/, "").replace(/_/g, " ");
}

/** Verdict → icon + text. Icon AND word, never color alone. */
function VerdictRow({ entry }: { entry: SabsmsDltTraceEntry }) {
  const { icon: Icon, word, cls } =
    entry.verdict === "allow"
      ? { icon: CheckCircle2, word: "pass", cls: "text-[var(--st-status-ok)]" }
      : entry.verdict === "block"
        ? { icon: XCircle, word: "block", cls: "text-[var(--st-danger)]" }
        : entry.verdict === "warn"
          ? { icon: AlertTriangle, word: "warn", cls: "text-[var(--st-text)]" }
          : { icon: MinusCircle, word: "skipped", cls: "text-[var(--st-text-secondary)]" };
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} aria-hidden="true" />
      <div className="min-w-0">
        <span className="font-medium text-[var(--st-text)]">
          {checkLabel(entry.check)}
        </span>{" "}
        <span className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
          {word}
        </span>
        {entry.detail && (
          <p className="text-xs text-[var(--st-text-secondary)]">{entry.detail}</p>
        )}
      </div>
    </div>
  );
}

/** Map a registered category to the classifier's coarse buckets. */
function coarseCategory(cat: string): "promotional" | "transactional" | "service" {
  if (cat === "promotional") return "promotional";
  if (cat === "transactional") return "transactional";
  return "service";
}

export interface DltScrubPanelProps {
  registry: DltBindingRegistry;
  /** Current (active-locale) body the author is editing. */
  body: string;
  /** Current binding off `metadata.dlt`. */
  templateId: string;
  headerId: string;
  /** Patch `metadata.dlt` on the editor view-model. */
  onBind: (patch: DltBindingPatch) => void;
}

export function DltScrubPanel({
  registry,
  body,
  templateId,
  headerId,
  onBind,
}: DltScrubPanelProps) {
  const [preview, setPreview] = React.useState<SabsmsDltScrubPreview | null>(null);
  const [engineError, setEngineError] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const seqRef = React.useRef(0);

  const boundTemplate = registry.templates.find((t) => t.templateId === templateId);
  const boundHeader = registry.headers.find((h) => h.headerId === headerId);
  const headerStr = boundHeader?.header ?? "";

  // Debounced (500ms) live scrub against the engine.
  React.useEffect(() => {
    if (!body.trim()) {
      setPreview(null);
      setEngineError(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    const seq = ++seqRef.current;
    const t = setTimeout(() => {
      void dltScrubPreviewAction({
        body,
        dltTemplateId: templateId || undefined,
        header: headerStr || undefined,
      }).then((res) => {
        if (seq !== seqRef.current) return; // stale
        setChecking(false);
        if (res.ok) {
          setPreview(res.preview);
          setEngineError(null);
        } else {
          setPreview(null);
          setEngineError(res.error);
        }
      });
    }, 500);
    return () => clearTimeout(t);
  }, [body, templateId, headerStr]);

  const categoryMismatch =
    preview &&
    preview.templateFound &&
    preview.templateCategory &&
    preview.predictedCategory.category !== "unknown" &&
    coarseCategory(preview.templateCategory) !== preview.predictedCategory.category;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>DLT scrub</CardTitle>
            <CardDescription>
              Live check against your registry — the engine runs the same
              checks on every India send.
            </CardDescription>
          </div>
          {preview?.predictedSuffix && (
            <Badge tone="info" aria-label={`Predicted operator suffix ${preview.predictedSuffix}`}>
              <span className="font-mono">-{preview.predictedSuffix}</span>
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Binding selectors */}
        <Field label="Registered DLT template">
          <Select
            value={templateId || NONE}
            onValueChange={(v) => {
              if (v === NONE) {
                onBind({ templateId: "" });
                return;
              }
              const t = registry.templates.find((x) => x.templateId === v);
              onBind({
                templateId: v,
                ...(t?.peId ? { principalEntityId: t.peId } : {}),
                ...(t ? { contentCategory: t.category } : {}),
              });
            }}
          >
            <SelectTrigger aria-label="Registered DLT template">
              <SelectValue placeholder="Not bound" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not bound</SelectItem>
              {registry.templates.map((t) => (
                <SelectItem key={t.templateId} value={t.templateId}>
                  <span className="font-mono text-xs">{t.templateId}</span>
                  {" — "}
                  {t.body.length > 48 ? `${t.body.slice(0, 48)}…` : t.body}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Header (sender)">
          <Select
            value={headerId || NONE}
            onValueChange={(v) => onBind({ headerId: v === NONE ? "" : v })}
          >
            <SelectTrigger aria-label="DLT header">
              <SelectValue placeholder="Not bound" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not bound</SelectItem>
              {registry.headers.map((h) => (
                <SelectItem key={h.headerId} value={h.headerId}>
                  <span className="font-mono">{h.header}</span>
                  {" — "}
                  {DLT_CATEGORY_LABELS[h.category] ?? h.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Separator />

        {/* Result */}
        {!body.trim() ? (
          <p className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
            <CircleSlash className="h-4 w-4" aria-hidden="true" />
            Type a body to run the scrub.
          </p>
        ) : checking && !preview && !engineError ? (
          <p className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Scrubbing…
          </p>
        ) : engineError ? (
          <p className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
            <CircleSlash className="h-4 w-4" aria-hidden="true" />
            {engineError}
          </p>
        ) : preview ? (
          <div className="space-y-3" aria-busy={checking}>
            <div className="flex items-center gap-2">
              {preview.wouldBlock ? (
                <>
                  <XCircle className="h-4 w-4 text-[var(--st-danger)]" aria-hidden="true" />
                  <span className="text-sm font-medium text-[var(--st-text)]">
                    Would be blocked
                    {preview.blockCheck ? ` — ${checkLabel(preview.blockCheck)}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 text-[var(--st-status-ok)]" aria-hidden="true" />
                  <span className="text-sm font-medium text-[var(--st-text)]">
                    Would pass scrubbing
                  </span>
                </>
              )}
              {checking && (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-[var(--st-text-secondary)]"
                  aria-label="Re-checking"
                />
              )}
            </div>

            <div className="space-y-2">
              {preview.trace.map((entry, i) => (
                <VerdictRow key={`${entry.check}-${i}`} entry={entry} />
              ))}
              {preview.trace.length === 0 && (
                <p className="text-xs text-[var(--st-text-secondary)]">
                  {preview.registryConfigured
                    ? "No checks ran for this body."
                    : "No DLT registry configured for this workspace — scrubbing is skipped."}
                </p>
              )}
            </div>

            {categoryMismatch && (
              <Alert
                tone="warning"
                icon={AlertTriangle}
                title="Category mismatch"
              >
                The bound template is registered as{" "}
                <strong>
                  {DLT_CATEGORY_LABELS[preview.templateCategory as DltCategory] ??
                    preview.templateCategory}
                </strong>{" "}
                but the content classifier reads this body as{" "}
                <strong>{preview.predictedCategory.category}</strong> (
                {Math.round(preview.predictedCategory.confidence * 100)}%
                confidence). Operators may reject or re-route it.
              </Alert>
            )}

            {templateId && !preview.templateFound && (
              <Alert tone="warning" icon={AlertTriangle} title="Template not in registry">
                TE <span className="font-mono">{templateId}</span> is not in this
                workspace&apos;s DLT registry — register it under Compliance → DLT.
              </Alert>
            )}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
