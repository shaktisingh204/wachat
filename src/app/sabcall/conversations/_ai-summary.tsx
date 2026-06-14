"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { Badge, Button } from "@/components/sabcrm/20ui";

import { summarizeTranscript, type CallSummary } from "./ai-actions";

const SENTIMENT_TONE: Record<CallSummary["sentiment"], string> = {
  positive: "default",
  neutral: "outline",
  negative: "outline",
  unknown: "outline",
};

/** Inline "Summarize with AI" affordance for an item that has a transcript. */
export function AiSummary({ transcript }: { transcript: string }) {
  const [busy, setBusy] = React.useState(false);
  const [summary, setSummary] = React.useState<CallSummary | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const run = React.useCallback(async () => {
    setBusy(true);
    setErr(null);
    const res = await summarizeTranscript(transcript);
    setBusy(false);
    if (res.ok) setSummary(res.data);
    else setErr(res.error);
  }, [transcript]);

  if (summary) {
    return (
      <div className="mt-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-xs">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium text-[var(--st-text)]">AI summary</span>
          <Badge variant={SENTIMENT_TONE[summary.sentiment] as never}>
            {summary.sentiment}
          </Badge>
        </div>
        <p className="text-[var(--st-text-secondary)]">{summary.summary}</p>
        {summary.actionItems.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-[var(--st-text-secondary)]">
            {summary.actionItems.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1">
      <Button
        variant="ghost"
        size="sm"
        iconLeft={Sparkles}
        loading={busy}
        disabled={busy}
        onClick={() => void run()}
      >
        Summarize with AI
      </Button>
      {err ? (
        <span className="ml-2 text-xs text-[var(--st-text-secondary)]">{err}</span>
      ) : null}
    </div>
  );
}
