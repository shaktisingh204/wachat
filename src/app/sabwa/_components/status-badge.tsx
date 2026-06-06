/**
 * StatusBadge — pairing / connection status pill.
 *
 * Used wherever a SabWa session's lifecycle state needs to be
 * surfaced (Connect, Linked Devices, Inbox header, Session Switcher).
 *
 * Pure markup — no `"use client"` directive needed.
 *
 * @example
 *   <StatusBadge status="connected" />
 *   <StatusBadge status="pending" size="sm" />
 */

import * as React from "react";

import { cn } from "@/lib/utils";
import type { SabwaSessionStatus } from "@/lib/sabwa/types";

export type StatusBadgeSize = "sm" | "md";

export interface StatusBadgeProps {
  /**
   * Session status from `SabwaSessionStatus`, plus the synthetic
   * `'pairing'`, `'syncing'` and `'ready'` values used by the pairing
   * flow before a real session row exists.
   */
  status:
    | SabwaSessionStatus
    | "pairing"
    | "syncing"
    | "ready";
  size?: StatusBadgeSize;
  className?: string;
}

interface StatusDescriptor {
  label: string;
  dotClass: string;
  textClass: string;
  bgClass: string;
}

const STATUS_MAP: Record<StatusBadgeProps["status"], StatusDescriptor> = {
  pending: {
    label: "Pairing",
    dotClass: "bg-[var(--st-text)]",
    textClass: "text-[var(--st-text)] dark:text-[var(--st-text-secondary)]",
    bgClass: "bg-[var(--st-text)]/10",
  },
  pairing: {
    label: "Pairing",
    dotClass: "bg-[var(--st-text)]",
    textClass: "text-[var(--st-text)] dark:text-[var(--st-text-secondary)]",
    bgClass: "bg-[var(--st-text)]/10",
  },
  syncing: {
    label: "Syncing",
    dotClass: "bg-[var(--st-text)]",
    textClass: "text-[var(--st-text)] dark:text-[var(--st-text-secondary)]",
    bgClass: "bg-[var(--st-text)]/10",
  },
  connected: {
    label: "Connected",
    dotClass: "bg-[var(--st-text)]",
    textClass: "text-[var(--st-text)] dark:text-[var(--st-text-secondary)]",
    bgClass: "bg-[var(--st-text)]/10",
  },
  ready: {
    label: "Ready",
    dotClass: "bg-[var(--st-text)]",
    textClass: "text-[var(--st-text)] dark:text-[var(--st-text-secondary)]",
    bgClass: "bg-[var(--st-text)]/10",
  },
  logged_out: {
    label: "Disconnected",
    dotClass: "bg-[var(--st-bg-muted)]",
    textClass: "text-[var(--st-text)] dark:text-[var(--st-text-secondary)]",
    bgClass: "bg-[var(--st-text)]/10",
  },
  banned: {
    label: "Banned",
    dotClass: "bg-[var(--st-text)]",
    textClass: "text-[var(--st-text)] dark:text-[var(--st-text-secondary)]",
    bgClass: "bg-[var(--st-text)]/10",
  },
  error: {
    label: "Error",
    dotClass: "bg-[var(--st-text)]",
    textClass: "text-[var(--st-text)] dark:text-[var(--st-text-secondary)]",
    bgClass: "bg-[var(--st-text)]/10",
  },
};

export function StatusBadge({
  status,
  size = "md",
  className,
}: StatusBadgeProps) {
  const descriptor = STATUS_MAP[status];

  const sizing =
    size === "sm"
      ? "text-[10px] gap-1 px-1.5 py-0.5"
      : "text-xs gap-1.5 px-2 py-0.5";
  const dotSizing = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const isAnimated = status === "pending" || status === "pairing" || status === "syncing";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        sizing,
        descriptor.bgClass,
        descriptor.textClass,
        className,
      )}
      role="status"
      aria-label={descriptor.label}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block rounded-full",
          dotSizing,
          descriptor.dotClass,
          isAnimated && "animate-pulse",
        )}
      />
      {descriptor.label}
    </span>
  );
}

export default StatusBadge;
