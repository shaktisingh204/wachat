"use client";

/**
 * V2.10 — "Recompute" admin button for the analytics page. Calls
 * `recomputeStatsAction` (reconcileDay per day, capped at 31) and
 * reports the drift it found/fixed inline.
 */

import { useState, useTransition } from "react";

import { Button } from "@/components/sabcrm/20ui";

import { recomputeStatsAction } from "./actions";

export interface RecomputeButtonProps {
  /** Inclusive UTC day keys (`YYYY-MM-DD`) for the current view. */
  fromDate: string;
  toDate: string;
}

export function RecomputeButton({ fromDate, toDate }: RecomputeButtonProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await recomputeStatsAction({ fromDate, toDate });
      if (!res.ok) {
        setMessage(`Recompute failed: ${res.error}`);
        return;
      }
      const d = res.data;
      setMessage(
        d.daysWithDrift === 0
          ? `Checked ${d.daysChecked} day(s) — rollups match the raw data.`
          : `Fixed ${d.daysWithDrift}/${d.daysChecked} day(s): ${d.docsReplaced} doc(s) replaced, ${d.docsRemoved} removed.`,
      );
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={run} disabled={pending}>
        {pending ? "Recomputing…" : "Recompute"}
      </Button>
      {message ? (
        <span
          role="status"
          className="max-w-md truncate text-xs text-[var(--st-text-secondary)]"
          title={message}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
