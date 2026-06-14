"use client";

import * as React from "react";
import { Users } from "lucide-react";

import type { SabmailDraftEditor } from "../collab-actions";
import type { SabmailCollabStatus } from "@/lib/sabmail/collab/use-collab-doc";

/** Initials from a display name or email local-part. */
function initials(name: string): string {
  const base = name.includes("@") ? name.split("@")[0] : name;
  const parts = base.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Collaborator roster + live-sync status for the composer. Renders nothing
 * when you're drafting alone and there's no live gateway — so the common
 * single-user case stays visually clean.
 */
export function CollabPresenceBar({
  others,
  status,
}: {
  others: SabmailDraftEditor[];
  status: SabmailCollabStatus;
}) {
  const live = status === "connected";
  const connecting = status === "connecting" || status === "syncing" || status === "reconnecting";

  if (others.length === 0 && !live && !connecting) return null;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-5 py-2">
      <div className="flex items-center gap-2">
        {others.length > 0 ? (
          <>
            <div className="flex -space-x-1.5">
              {others.slice(0, 4).map((e) => (
                <span
                  key={e.userId}
                  title={e.name}
                  className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white ring-2 ring-[var(--st-bg)]"
                  style={{ backgroundColor: e.color }}
                >
                  {initials(e.name)}
                </span>
              ))}
              {others.length > 4 ? (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--st-bg-muted)] text-[10px] font-semibold text-[var(--st-text-secondary)] ring-2 ring-[var(--st-bg)]">
                  +{others.length - 4}
                </span>
              ) : null}
            </div>
            <span className="text-xs text-[var(--st-text-secondary)]">
              <Users className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden />
              {others.length === 1
                ? `${others[0].name} is also editing this draft`
                : `${others.length} people are editing this draft`}
            </span>
          </>
        ) : (
          <span className="text-xs text-[var(--st-text-tertiary)]">Only you are editing</span>
        )}
      </div>

      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
        style={
          live
            ? { backgroundColor: "var(--st-accent-soft)", color: "var(--st-accent)" }
            : { color: "var(--st-text-tertiary)" }
        }
        title={
          live
            ? "Real-time co-editing is on"
            : connecting
              ? "Connecting to the collaboration server…"
              : "Live co-editing unavailable — changes are not merged in real time"
        }
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: live ? "var(--st-accent)" : connecting ? "#f59e0b" : "var(--st-text-tertiary)",
          }}
        />
        {live ? "Live" : connecting ? "Syncing…" : "Solo"}
      </span>
    </div>
  );
}
