"use client";

/**
 * AiTemplateGenerator (Wave 4)
 *
 * Describe a template in plain language → Claude writes a Meta-compliant one
 * (name, category, header/body/footer, buttons, example vars) via the
 * `aiGenerateTemplate` server action. Shows a faithful WhatsApp live preview of
 * the draft (Phase 0B) and an "Apply to form" handoff that fills the builder's
 * controlled fields. Self-contained; drop it above any template builder.
 */

import * as React from "react";
import { Sparkles, Wand2 } from "lucide-react";

// NOTE: the barrel `Select` is the radix compound (onValueChange, no `options`).
// `SelectField` is the options-based control with `value`/`onChange` — use that.
import { Button, Card, Field, SelectField as Select, Textarea } from "@/components/sabcrm/20ui";
import { cn } from "@/lib/utils";
import { aiGenerateTemplate } from "@/lib/wachat/ai/copilot-actions";
import type { BrandVoiceInput, GeneratedTemplate } from "@/lib/wachat/ai/types";

import { ProcessingDots } from "../motion";
import { WhatsAppPreview } from "../preview";
import type { WaButton, WaPreviewMessage } from "../preview";

const CATEGORY_OPTIONS = [
  { value: "AUTO", label: "Let AI choose" },
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utility" },
  { value: "AUTHENTICATION", label: "Authentication" },
];

/** Map a generated template to the preview model so we can render it live. */
function toPreview(t: GeneratedTemplate): WaPreviewMessage {
  const buttons: WaButton[] = (t.buttons ?? []).map((b) => ({
    type:
      b.type === "URL"
        ? "url"
        : b.type === "PHONE_NUMBER"
          ? "phone"
          : b.type === "COPY_CODE"
            ? "copy"
            : "quick_reply",
    text: b.text,
    url: b.url,
    phone: b.phone,
  }));
  return {
    type: "template",
    direction: "out",
    category: t.category,
    header: t.header ? { kind: "text", text: t.header } : undefined,
    body: t.body,
    footer: t.footer,
    buttons,
    status: "read",
  };
}

export interface AiTemplateGeneratorProps {
  onApply: (t: GeneratedTemplate) => void;
  brand?: BrandVoiceInput;
  defaultCategory?: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  className?: string;
}

export function AiTemplateGenerator({
  onApply,
  brand,
  defaultCategory,
  className,
}: AiTemplateGeneratorProps) {
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<string>(defaultCategory ?? "AUTO");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<GeneratedTemplate | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    if (!description.trim()) {
      setError("Describe what the template should say.");
      return;
    }
    setError(null);
    setLoading(true);
    const r = await aiGenerateTemplate({
      description,
      category: category === "AUTO" ? undefined : (category as AiTemplateGeneratorProps["defaultCategory"]),
      brand,
    });
    setLoading(false);
    if (r.ok) setResult(r);
    else setError(r.error ?? "Generation failed.");
  }

  return (
    <Card className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--st-accent)] text-[var(--st-bg)]">
          <Wand2 size={15} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--st-text)]">Generate with AI</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">
            Describe it — Claude writes a compliant template
          </p>
        </div>
      </div>

      <Field label="What should this template say?">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="e.g. Order confirmation with order number and a Track order button"
        />
      </Field>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <Field label="Category">
            <Select
              value={category}
              onChange={(v) => v && setCategory(v)}
              options={CATEGORY_OPTIONS}
              aria-label="Template category"
            />
          </Field>
        </div>
        <Button variant="primary" iconLeft={Sparkles} loading={loading} onClick={generate}>
          Generate
        </Button>
      </div>

      {error ? <p className="text-sm text-[var(--st-danger,#dc2626)]">{error}</p> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <ProcessingDots className="text-[var(--st-accent)]" /> Writing your template…
        </div>
      ) : null}

      {result ? (
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2 text-sm">
            <p className="text-[var(--st-text-secondary)]">
              <span className="font-medium text-[var(--st-text)]">{result.name}</span> ·{" "}
              {result.category} · {result.language}
            </p>
            <div className="whitespace-pre-wrap rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[var(--st-text)]">
              {result.body}
            </div>
            <Button variant="primary" iconLeft={Wand2} onClick={() => onApply(result)}>
              Apply to form
            </Button>
          </div>
          <div className="hidden sm:block">
            <WhatsAppPreview message={toPreview(result)} showComposer={false} className="scale-[0.85]" />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export default AiTemplateGenerator;
