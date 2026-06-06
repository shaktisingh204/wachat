"use client";

import * as React from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/sabcrm/20ui";

import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";

/**
 * KPI strip for the Tickets list page (§1D.1).
 *
 * Five clickable stat cards driving the in-place status filter. Each
 * card toggles a `kpiKey` (a virtual filter not always backed by a raw
 * status, e.g. "overdue" is computed from `dueBy < now` AND not
 * resolved).
 *
 * Counts are derived locally from the loaded ticket page; the Rust
 * list endpoint doesn't surface aggregate KPIs yet, so this is a
 * page-scoped roll-up. Good enough for an at-a-glance dashboard.
 */

export type TicketsKpiKey =
  | "all"
  | "open"
  | "pending"
  | "overdue"
  | "resolvedWeek"
  | "csat";

export interface TicketsKpiCounts {
  open: number;
  pending: number;
  overdue: number;
  resolvedThisWeek: number;
  csatAvg: number | null;
  csatCount: number;
}

export function computeTicketKpis(tickets: CrmTicketDoc[]): TicketsKpiCounts {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  let open = 0;
  let pending = 0;
  let overdue = 0;
  let resolvedThisWeek = 0;
  let csatSum = 0;
  let csatN = 0;
  for (const t of tickets) {
    const status = String(t.status ?? "").toLowerCase();
    if (status === "open" || status === "reopened") open += 1;
    if (status === "pending" || status === "on_hold") pending += 1;
    const due = t.dueBy ? new Date(t.dueBy).getTime() : NaN;
    const resolvedish = status === "resolved" || status === "closed";
    if (!resolvedish && Number.isFinite(due) && due < now) overdue += 1;
    const updated = t.updatedAt
      ? new Date(t.updatedAt).getTime()
      : t.audit?.updatedAt
        ? new Date(t.audit.updatedAt).getTime()
        : NaN;
    if (
      status === "resolved" &&
      Number.isFinite(updated) &&
      updated >= weekAgo
    ) {
      resolvedThisWeek += 1;
    }
    if (typeof t.satisfactionRating === "number" && t.satisfactionRating > 0) {
      csatSum += t.satisfactionRating;
      csatN += 1;
    }
  }
  return {
    open,
    pending,
    overdue,
    resolvedThisWeek,
    csatAvg: csatN > 0 ? csatSum / csatN : null,
    csatCount: csatN,
  };
}

export interface TicketsKpiStripProps {
  counts: TicketsKpiCounts;
  active: TicketsKpiKey;
  onPick: (next: TicketsKpiKey) => void;
}

export function TicketsKpiStrip({
  counts,
  active,
  onPick,
}: TicketsKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Open"
        value={counts.open.toLocaleString()}
        icon={LifeBuoy}
        active={active === "open"}
        onClick={() => onPick(active === "open" ? "all" : "open")}
      />
      <KpiCard
        label="Pending"
        value={counts.pending.toLocaleString()}
        icon={Clock}
        active={active === "pending"}
        onClick={() => onPick(active === "pending" ? "all" : "pending")}
      />
      <KpiCard
        label="Overdue SLA"
        value={counts.overdue.toLocaleString()}
        icon={AlertTriangle}
        active={active === "overdue"}
        tone={counts.overdue > 0 ? "danger" : "neutral"}
        onClick={() => onPick(active === "overdue" ? "all" : "overdue")}
      />
      <KpiCard
        label="Resolved (7d)"
        value={counts.resolvedThisWeek.toLocaleString()}
        icon={CheckCircle2}
        active={active === "resolvedWeek"}
        onClick={() =>
          onPick(active === "resolvedWeek" ? "all" : "resolvedWeek")
        }
      />
      <KpiCard
        label="CSAT avg"
        value={counts.csatAvg != null ? `${counts.csatAvg.toFixed(2)} / 5` : "-"}
        icon={Star}
        active={active === "csat"}
        onClick={() => onPick(active === "csat" ? "all" : "csat")}
        period={
          counts.csatCount > 0 ? `${counts.csatCount} rated` : "no ratings"
        }
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  active,
  onClick,
  tone,
  period,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  tone?: "danger" | "neutral";
  period?: React.ReactNode;
}) {
  const danger = tone === "danger";
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "h-auto w-full flex-col items-start gap-2 rounded-[var(--st-radius-lg)] border p-4 text-left",
        active
          ? "border-[var(--st-text)] bg-[var(--st-bg-secondary)]"
          : "border-[var(--st-border)] bg-[var(--st-bg)]",
      ].join(" ")}
    >
      <span className="flex w-full items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--st-text-secondary)]">
          {label}
        </span>
        <span
          aria-hidden="true"
          className={[
            "inline-flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)]",
            danger
              ? "bg-[var(--st-danger)]/10 text-[var(--st-danger)]"
              : "bg-[var(--st-bg-secondary)] text-[var(--st-text-tertiary)]",
          ].join(" ")}
        >
          <Icon size={16} />
        </span>
      </span>
      <span
        className={[
          "text-2xl font-semibold tabular-nums",
          danger ? "text-[var(--st-danger)]" : "text-[var(--st-text)]",
        ].join(" ")}
      >
        {value}
      </span>
      {period != null ? (
        <span className="text-[12px] text-[var(--st-text-tertiary)]">
          {period}
        </span>
      ) : null}
    </Button>
  );
}

export default TicketsKpiStrip;
