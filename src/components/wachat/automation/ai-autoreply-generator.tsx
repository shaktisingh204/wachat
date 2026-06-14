"use client";

/**
 * AiAutoReplyGenerator (Wave 5)
 *
 * Describe the business → Claude drafts a set of keyword auto-reply rules
 * (`aiGenerateAutoReplies`). On "Add these", hands the rules back to the parent
 * form which appends them to its `replies` state. Self-contained (own state),
 * so it can live inside a render branch without breaking hook rules.
 */

import * as React from "react";
import { Sparkles, Wand2 } from "lucide-react";

import { Button, Card, Field, Textarea } from "@/components/sabcrm/20ui";
import { cn } from "@/lib/utils";
import { aiGenerateAutoReplies } from "@/lib/wachat/ai/copilot-actions";
import type { BrandVoiceInput, GeneratedAutoReply } from "@/lib/wachat/ai/types";

import { ProcessingDots, StaggerItem } from "../motion";

export interface AiAutoReplyGeneratorProps {
  onApply: (rules: GeneratedAutoReply[]) => void;
  brand?: BrandVoiceInput;
  className?: string;
}

export function AiAutoReplyGenerator({ onApply, brand, className }: AiAutoReplyGeneratorProps) {
  const [description, setDescription] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [rules, setRules] = React.useState<GeneratedAutoReply[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    if (!description.trim()) {
      setError("Tell the AI what your business does.");
      return;
    }
    setError(null);
    setLoading(true);
    const r = await aiGenerateAutoReplies({ description, brand });
    setLoading(false);
    if (r.ok) setRules(r.rules);
    else setError(r.error ?? "Generation failed.");
  }

  return (
    <Card className={cn("flex flex-col gap-3 border-dashed p-4", className)}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--st-accent)] text-[var(--st-bg)]">
          <Wand2 size={15} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--st-text)]">Generate rules with AI</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">
            Describe your business — Claude drafts keyword replies
          </p>
        </div>
      </div>

      <Field label="What does your business do?">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="e.g. A salon — bookings, hours, pricing, location, cancellations"
        />
      </Field>

      <div>
        <Button variant="primary" iconLeft={Sparkles} loading={loading} onClick={generate}>
          Generate rules
        </Button>
      </div>

      {error ? <p className="text-sm text-[var(--st-danger,#dc2626)]">{error}</p> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <ProcessingDots className="text-[var(--st-accent)]" /> Drafting replies…
        </div>
      ) : null}

      {rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map((r, i) => (
            <StaggerItem
              key={i}
              index={i}
              className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm"
            >
              <p className="font-medium text-[var(--st-text)]">
                {r.keywords}{" "}
                <span className="text-[11px] font-normal text-[var(--st-text-secondary)]">
                  ({r.matchType})
                </span>
              </p>
              <p className="text-[var(--st-text-secondary)]">{r.reply}</p>
            </StaggerItem>
          ))}
          <Button
            variant="primary"
            iconLeft={Wand2}
            onClick={() => {
              onApply(rules);
              setRules([]);
              setDescription("");
            }}
          >
            Add {rules.length} rule{rules.length === 1 ? "" : "s"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export default AiAutoReplyGenerator;
