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
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-300",
    bgClass: "bg-amber-500/10",
  },
  pairing: {
    label: "Pairing",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-300",
    bgClass: "bg-amber-500/10",
  },
  syncing: {
    label: "Syncing",
    dotClass: "bg-sky-500",
    textClass: "text-sky-700 dark:text-sky-300",
    bgClass: "bg-sky-500/10",
  },
  connected: {
    label: "Connected",
    dotClass: "bg-green-500",
    textClass: "text-green-700 dark:text-green-300",
    bgClass: "bg-green-500/10",
  },
  ready: {
    label: "Ready",
    dotClass: "bg-green-500",
    textClass: "text-green-700 dark:text-green-300",
    bgClass: "bg-green-500/10",
  },
  logged_out: {
    label: "Disconnected",
    dotClass: "bg-zinc-400",
    textClass: "text-zinc-600 dark:text-zinc-300",
    bgClass: "bg-zinc-500/10",
  },
  banned: {
    label: "Banned",
    dotClass: "bg-red-500",
    textClass: "text-red-700 dark:text-red-300",
    bgClass: "bg-red-500/10",
  },
  error: {
    label: "Error",
    dotClass: "bg-red-500",
    textClass: "text-red-700 dark:text-red-300",
    bgClass: "bg-red-500/10",
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
