"use client";

import * as React from "react";
import { MoreHorizontal, Sparkles } from "lucide-react";

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui';

import { SabsmsDetailDrawer } from "@/components/sabsms/page-toolkit";

import { aiExplain, exportTilePdf } from "../actions";

/**
 * Per-tile overflow menu used by every analytics tile.
 *
 *   • "Why is this metric down?" → opens a drawer with the AI insight.
 *   • "Export PDF" → calls the server-side stub.
 */

export interface TileActionsProps {
  metric: string;
  tileId: string;
  /** Encoded query string so the AI prompt sees the current window. */
  queryString: string;
  context?: Record<string, unknown>;
}

export function TileActions({
  metric,
  tileId,
  queryString,
  context,
}: TileActionsProps) {
  const [open, setOpen] = React.useState(false);
  const [explanation, setExplanation] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function runAiExplain() {
    setOpen(true);
    setBusy(true);
    setError(null);
    setExplanation(null);
    const sp = new URLSearchParams(queryString);
    const from = sp.get("from") ?? "";
    const to = sp.get("to") ?? "";
    const res = await aiExplain({ metric, from, to, context });
    setBusy(false);
    if (res.ok) setExplanation(res.data.explanation);
    else setError(res.error);
  }

  async function runPdfExport() {
    const res = await exportTilePdf(tileId, queryString);
    if (!res.ok) {
      // eslint-disable-next-line no-alert
      window.alert(res.error);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={`More actions for ${metric}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{metric}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={runAiExplain}>
            <Sparkles className="mr-2 h-3.5 w-3.5" /> Why is this metric down?
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={runPdfExport}>
            Export tile as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SabsmsDetailDrawer
        open={open}
        onOpenChange={setOpen}
        title={`AI insight · ${metric}`}
        description="Generated explanation for the current window."
      >
        {busy && (
          <p className="text-sm text-[var(--st-text-secondary)]">Asking the model…</p>
        )}
        {error && <p className="text-sm text-[var(--st-text)]">{error}</p>}
        {explanation && (
          <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--st-text)]">
            {explanation}
          </p>
        )}
      </SabsmsDetailDrawer>
    </>
  );
}
