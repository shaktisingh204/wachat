"use client";

import { StatCard } from "@/components/zoruui";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Star,
} from "lucide-react";

/**
 * KPI strip for the Tickets list page (§1D.1).
 *
 * Five clickable stat cards driving the in-place status filter. Each
 * card toggles a `kpiKey` (a virtual filter not always backed by a raw
 * status — e.g. "overdue" is computed from `dueBy < now` AND not
 * resolved).
 *
 * Counts are derived locally from the loaded ticket page; the Rust
 * list endpoint doesn't surface aggregate KPIs yet, so this is a
 * page-scoped roll-up. Good enough for an at-a-glance dashboard.
 */

import * as React from "react";

import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";

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
        icon={<LifeBuoy className="h-4 w-4" />}
        active={active === "open"}
        onClick={() => onPick(active === "open" ? "all" : "open")}
      />
      <KpiCard
        label="Pending"
        value={counts.pending.toLocaleString()}
        icon={<Clock className="h-4 w-4" />}
        active={active === "pending"}
        onClick={() => onPick(active === "pending" ? "all" : "pending")}
      />
      <KpiCard
        label="Overdue SLA"
        value={counts.overdue.toLocaleString()}
        icon={<AlertTriangle className="h-4 w-4" />}
        active={active === "overdue"}
        tone={counts.overdue > 0 ? "danger" : "neutral"}
        onClick={() => onPick(active === "overdue" ? "all" : "overdue")}
      />
      <KpiCard
        label="Resolved (7d)"
        value={counts.resolvedThisWeek.toLocaleString()}
        icon={<CheckCircle2 className="h-4 w-4" />}
        active={active === "resolvedWeek"}
        onClick={() =>
          onPick(active === "resolvedWeek" ? "all" : "resolvedWeek")
        }
      />
      <KpiCard
        label="CSAT avg"
        value={
          counts.csatAvg != null ? `${counts.csatAvg.toFixed(2)} / 5` : "—"
        }
        icon={<Star className="h-4 w-4" />}
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
  icon,
  active,
  onClick,
  tone,
  period,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tone?: "danger" | "neutral";
  period?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]",
        active
          ? "rounded-[var(--st-radius-lg)] ring-1 ring-[var(--st-text)]"
          : "",
        tone === "danger" ? "rounded-[var(--st-radius-lg)]" : "",
      ].join(" ")}
    >
      <StatCard label={label} value={value} icon={icon} period={period} />
    </button>
  );
}

export default TicketsKpiStrip;
