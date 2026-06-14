"use client";

/**
 * AiPostGenerator (Wave 7)
 *
 * Topic → Claude writes punchy WhatsApp/social promo copy variants
 * (`aiGeneratePost`). Each variant has a Copy button; optional `onApply`
 * hands a chosen variant back to the host page. Self-contained.
 */

import * as React from "react";
import { Copy, Sparkles, Wand2 } from "lucide-react";

import { Button, Card, Field, Textarea } from "@/components/sabcrm/20ui";
import { cn } from "@/lib/utils";
import { aiGeneratePost } from "@/lib/wachat/ai/copilot-actions";
import type { BrandVoiceInput } from "@/lib/wachat/ai/types";

import { ProcessingDots, StaggerItem } from "../motion";

const CHANNELS = ["WhatsApp status", "Promo broadcast", "Social caption"];

export interface AiPostGeneratorProps {
  brand?: BrandVoiceInput;
  onApply?: (text: string) => void;
  className?: string;
}

export function AiPostGenerator({ brand, onApply, className }: AiPostGeneratorProps) {
  const [topic, setTopic] = React.useState("");
  const [channel, setChannel] = React.useState(CHANNELS[0]);
  const [loading, setLoading] = React.useState(false);
  const [variants, setVariants] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    if (!topic.trim()) {
      setError("What's the post about?");
      return;
    }
    setError(null);
    setLoading(true);
    const r = await aiGeneratePost({ topic, channel, brand });
    setLoading(false);
    if (r.ok) setVariants(r.variants);
    else setError(r.error ?? "Generation failed.");
  }

  return (
    <Card className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--st-accent)] text-[var(--st-bg)]">
          <Wand2 size={15} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--st-text)]">AI post generator</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Topic → ready-to-send copy</p>
        </div>
      </div>

      <Field label="What's the post about?">
        <Textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={2}
          placeholder="e.g. Diwali sale — 30% off all skincare, ends Sunday"
        />
      </Field>

      <div className="flex flex-wrap gap-1.5">
        {CHANNELS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChannel(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              channel === c
                ? "border-[var(--st-accent)] bg-[var(--st-accent)] text-[var(--st-bg)]"
                : "border-[var(--st-border)] text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div>
        <Button variant="primary" iconLeft={Sparkles} loading={loading} onClick={generate}>
          Generate copy
        </Button>
      </div>

      {error ? <p className="text-sm text-[var(--st-danger,#dc2626)]">{error}</p> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <ProcessingDots className="text-[var(--st-accent)]" /> Writing…
        </div>
      ) : null}

      {variants.length > 0 ? (
        <div className="space-y-2">
          {variants.map((v, i) => (
            <StaggerItem
              key={i}
              index={i}
              className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3"
            >
              <p className="whitespace-pre-wrap text-sm text-[var(--st-text)]">{v}</p>
              <div className="mt-2 flex gap-2">
                {onApply ? (
                  <Button size="sm" variant="primary" iconLeft={Wand2} onClick={() => onApply(v)}>
                    Use
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft={Copy}
                  onClick={() => navigator.clipboard?.writeText(v).catch(() => {})}
                >
                  Copy
                </Button>
              </div>
            </StaggerItem>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export default AiPostGenerator;
