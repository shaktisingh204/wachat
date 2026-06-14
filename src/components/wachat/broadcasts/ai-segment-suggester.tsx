"use client";

/**
 * AiSegmentSuggester (Wave 3 depth)
 *
 * Describe a campaign goal → Claude proposes an audience segment (name +
 * human-readable criteria) via `aiSuggestSegment`. Self-contained; the user
 * reads the criteria and creates the matching segment. Copyable.
 */

import * as React from "react";
import { Copy, Sparkles, Users } from "lucide-react";

import { Button, Card, Field, Textarea } from "@/components/sabcrm/20ui";
import { cn } from "@/lib/utils";
import { aiSuggestSegment } from "@/lib/wachat/ai/copilot-actions";
import type { SuggestSegmentResult } from "@/lib/wachat/ai/types";

import { ProcessingDots, StaggerItem } from "../motion";

export interface AiSegmentSuggesterProps {
  availableFields?: string[];
  className?: string;
}

export function AiSegmentSuggester({ availableFields, className }: AiSegmentSuggesterProps) {
  const [goal, setGoal] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<SuggestSegmentResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function suggest() {
    if (!goal.trim()) {
      setError("Describe who you want to reach.");
      return;
    }
    setError(null);
    setLoading(true);
    const r = await aiSuggestSegment({ goal, availableFields });
    setLoading(false);
    if (r.ok) setResult(r);
    else setError(r.error ?? "Couldn't suggest a segment.");
  }

  return (
    <Card className={cn("flex flex-col gap-3 border-dashed p-4", className)}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--st-accent)] text-[var(--st-bg)]">
          <Users size={15} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--st-text)]">Suggest a segment with AI</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Describe a goal → audience criteria</p>
        </div>
      </div>

      <Field label="Who do you want to reach?">
        <Textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder="e.g. customers in Mumbai who haven't ordered in 60 days"
        />
      </Field>

      <div>
        <Button variant="primary" iconLeft={Sparkles} loading={loading} onClick={suggest}>
          Suggest segment
        </Button>
      </div>

      {error ? <p className="text-sm text-[var(--st-danger,#dc2626)]">{error}</p> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <ProcessingDots className="text-[var(--st-accent)]" /> Designing the audience…
        </div>
      ) : null}

      {result && result.ok ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--st-text)]">{result.name}</p>
            <Button
              size="sm"
              variant="secondary"
              iconLeft={Copy}
              onClick={() =>
                navigator.clipboard
                  ?.writeText(`${result.name}\n${result.description}\n- ${result.criteria.join("\n- ")}`)
                  .catch(() => {})
              }
            >
              Copy
            </Button>
          </div>
          {result.description ? (
            <p className="text-sm text-[var(--st-text-secondary)]">{result.description}</p>
          ) : null}
          <ul className="space-y-1.5">
            {result.criteria.map((c, i) => (
              <StaggerItem key={i} index={i} as="li" className="flex gap-2 text-sm text-[var(--st-text-secondary)]">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--st-accent)]" />
                <span>{c}</span>
              </StaggerItem>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

export default AiSegmentSuggester;
