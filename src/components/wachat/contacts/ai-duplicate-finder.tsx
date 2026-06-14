"use client";

/**
 * AiDuplicateFinder (Wave 6)
 *
 * Scans the loaded contacts with Claude (`aiFindDuplicateContacts`) and surfaces
 * likely duplicate PAIRS with a reason + confidence, so the merge page stops
 * being a manual hunt. Clicking a suggestion pre-selects that pair for merge.
 * Self-contained; pass the contact mini-records and a select handler.
 */

import * as React from "react";
import { Sparkles, GitMerge } from "lucide-react";

import { Button, Card } from "@/components/sabcrm/20ui";
import { cn } from "@/lib/utils";
import { aiFindDuplicateContacts } from "@/lib/wachat/ai/copilot-actions";
import type { DuplicatePair } from "@/lib/wachat/ai/types";

import { ProcessingDots, StaggerItem } from "../motion";

export interface MiniContact {
  id: string;
  name?: string;
  phone?: string;
}

export interface AiDuplicateFinderProps {
  contacts: MiniContact[];
  onSelectPair: (aId: string, bId: string) => void;
  className?: string;
}

export function AiDuplicateFinder({ contacts, onSelectPair, className }: AiDuplicateFinderProps) {
  const [loading, setLoading] = React.useState(false);
  const [pairs, setPairs] = React.useState<DuplicatePair[] | null>(null);
  const [truncated, setTruncated] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const nameOf = React.useCallback(
    (id: string) => {
      const c = contacts.find((x) => x.id === id);
      return c?.name || c?.phone || "Unknown";
    },
    [contacts],
  );

  async function scan() {
    setError(null);
    setLoading(true);
    const r = await aiFindDuplicateContacts({ contacts });
    setLoading(false);
    if (!r.ok) {
      setError(r.error ?? "Scan failed.");
      return;
    }
    setPairs(r.pairs);
    setTruncated(Boolean(r.truncated));
  }

  return (
    <Card className={cn("flex flex-col gap-3 border-dashed p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--st-accent)] text-[var(--st-bg)]">
            <Sparkles size={15} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--st-text)]">Find duplicates with AI</p>
            <p className="text-[11px] text-[var(--st-text-secondary)]">
              Claude scans for likely same-person records
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          iconLeft={Sparkles}
          loading={loading}
          disabled={contacts.length < 2}
          onClick={scan}
        >
          {pairs ? "Re-scan" : "Scan"}
        </Button>
      </div>

      {error ? <p className="text-sm text-[var(--st-danger,#dc2626)]">{error}</p> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <ProcessingDots className="text-[var(--st-accent)]" /> Comparing {Math.min(contacts.length, 80)} contacts…
        </div>
      ) : null}

      {pairs && pairs.length === 0 ? (
        <p className="text-sm text-[var(--st-text-secondary)]">No likely duplicates found. Your list looks clean. ✨</p>
      ) : null}

      {pairs && pairs.length > 0 ? (
        <div className="space-y-2">
          {pairs.map((p, i) => (
            <StaggerItem
              key={`${p.aId}-${p.bId}-${i}`}
              index={i}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--st-text)]">
                  {nameOf(p.aId)} <span className="text-[var(--st-text-secondary)]">↔</span> {nameOf(p.bId)}
                </p>
                <p className="truncate text-[11px] text-[var(--st-text-secondary)]">
                  {p.reason} · {Math.round(p.confidence * 100)}% sure
                </p>
              </div>
              <Button size="sm" variant="primary" iconLeft={GitMerge} onClick={() => onSelectPair(p.aId, p.bId)}>
                Review
              </Button>
            </StaggerItem>
          ))}
          {truncated ? (
            <p className="text-[11px] text-[var(--st-text-secondary)]">
              Scanned the first 80 contacts. Search to narrow the list for the rest.
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default AiDuplicateFinder;
