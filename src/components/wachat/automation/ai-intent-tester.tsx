"use client";

/**
 * AiIntentTester (Wave 5 depth)
 *
 * Paste a sample customer message → Claude classifies the intent + suggests a
 * route (`aiDetectIntent`). Lets you sanity-check chatbot/auto-routing rules
 * before going live. Self-contained.
 */

import * as React from "react";
import { Sparkles, Route } from "lucide-react";

import { Button, Card, Field, Textarea } from "@/components/sabcrm/20ui";
import { cn } from "@/lib/utils";
import { aiDetectIntent } from "@/lib/wachat/ai/copilot-actions";
import type { IntentResult } from "@/lib/wachat/ai/types";

import { ProcessingDots } from "../motion";

export interface AiIntentTesterProps {
  /** Optional fixed intent labels to classify into. */
  intents?: string[];
  /** Optional routing targets to suggest. */
  routes?: string[];
  className?: string;
}

export function AiIntentTester({ intents, routes, className }: AiIntentTesterProps) {
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<IntentResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    if (!text.trim()) {
      setError("Type a sample message to classify.");
      return;
    }
    setError(null);
    setLoading(true);
    const r = await aiDetectIntent({ transcript: [{ direction: "in", text }], intents, routes });
    setLoading(false);
    if (r.ok) setResult(r);
    else setError(r.error ?? "Could not classify.");
  }

  return (
    <Card className={cn("flex flex-col gap-3 border-dashed p-4", className)}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--st-accent)] text-[var(--st-bg)]">
          <Route size={15} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--st-text)]">Test intent detection</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">See how the AI would route a message</p>
        </div>
      </div>

      <Field label="Sample customer message">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="e.g. Hi, my order hasn't arrived and I want a refund"
        />
      </Field>

      <div>
        <Button variant="primary" iconLeft={Sparkles} loading={loading} onClick={run}>
          Detect intent
        </Button>
      </div>

      {error ? <p className="text-sm text-[var(--st-danger,#dc2626)]">{error}</p> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <ProcessingDots className="text-[var(--st-accent)]" /> Classifying…
        </div>
      ) : null}

      {result && result.ok ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5 text-sm">
          <span className="rounded-full bg-[var(--st-accent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--st-bg)]">
            {result.intent}
          </span>
          <span className="text-[var(--st-text-secondary)]">{Math.round(result.confidence * 100)}% sure</span>
          {result.routeTo ? (
            <span className="text-[var(--st-text-secondary)]">
              → route to <span className="font-medium text-[var(--st-text)]">{result.routeTo}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default AiIntentTester;
