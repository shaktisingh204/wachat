"use client";

/**
 * AiCallScript (Wave 8)
 *
 * Generates spoken-word scripts for WhatsApp Business calling — answer greeting,
 * voicemail/after-hours, or an IVR keypad menu — via `aiGenerateCallScript`.
 * Self-contained with Copy; optional `onApply` to drop into a settings field.
 */

import * as React from "react";
import { Copy, Phone, Sparkles } from "lucide-react";

import { Button, Card, Field, Textarea } from "@/components/sabcrm/20ui";
import { cn } from "@/lib/utils";
import { aiGenerateCallScript } from "@/lib/wachat/ai/copilot-actions";
import type { BrandVoiceInput } from "@/lib/wachat/ai/types";

import { ProcessingDots } from "../motion";

type Kind = "greeting" | "voicemail" | "ivr";
const KINDS: Array<{ value: Kind; label: string }> = [
  { value: "greeting", label: "Greeting" },
  { value: "voicemail", label: "Voicemail" },
  { value: "ivr", label: "IVR menu" },
];

export interface AiCallScriptProps {
  businessName?: string;
  brand?: BrandVoiceInput;
  onApply?: (kind: Kind, script: string) => void;
  className?: string;
}

export function AiCallScript({ businessName, brand, onApply, className }: AiCallScriptProps) {
  const [kind, setKind] = React.useState<Kind>("greeting");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [script, setScript] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    setError(null);
    setLoading(true);
    const r = await aiGenerateCallScript({ kind, businessName, notes: notes || undefined, brand });
    setLoading(false);
    if (r.ok) setScript(r.script);
    else setError(r.error ?? "Generation failed.");
  }

  return (
    <Card className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--st-accent)] text-[var(--st-bg)]">
          <Phone size={15} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--st-text)]">AI call script</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Greeting · voicemail · IVR menu</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              kind === k.value
                ? "border-[var(--st-accent)] bg-[var(--st-accent)] text-[var(--st-bg)]"
                : "border-[var(--st-border)] text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <Field label="Anything to include? (optional)">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. open 9–6 Mon–Sat, press 1 for sales, 2 for support"
        />
      </Field>

      <div>
        <Button variant="primary" iconLeft={Sparkles} loading={loading} onClick={generate}>
          Generate script
        </Button>
      </div>

      {error ? <p className="text-sm text-[var(--st-danger,#dc2626)]">{error}</p> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <ProcessingDots className="text-[var(--st-accent)]" /> Writing the script…
        </div>
      ) : null}

      {script ? (
        <div className="space-y-2">
          <div className="whitespace-pre-wrap rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
            {script}
          </div>
          <div className="flex gap-2">
            {onApply ? (
              <Button size="sm" variant="primary" iconLeft={Phone} onClick={() => onApply(kind, script)}>
                Use this
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              iconLeft={Copy}
              onClick={() => navigator.clipboard?.writeText(script).catch(() => {})}
            >
              Copy
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export default AiCallScript;
