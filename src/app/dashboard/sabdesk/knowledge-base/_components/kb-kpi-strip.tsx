"use client";

import { StatCard } from "@/components/zoruui";
import { BookOpen, CheckCircle2, Eye, FileText, ThumbsUp } from "lucide-react";

/**
 * KPI strip for the Knowledge Base list (§1D.1).
 *
 * 5 cards: Total · Published · Drafts · Most-viewed (top count) ·
 * Helpful % (`helpfulYes / (helpfulYes + helpfulNo)`).
 */

import * as React from "react";
import type { KbArticleDoc } from "@/app/actions/crm-knowledge-base.actions.types";

export interface KbKpiCounts {
  total: number;
  published: number;
  drafts: number;
  mostViewed: number;
  helpfulPct: number | null;
  totalVotes: number;
}

export function computeKbKpis(articles: KbArticleDoc[]): KbKpiCounts {
  let published = 0;
  let drafts = 0;
  let mostViewed = 0;
  let yesSum = 0;
  let totalVotes = 0;
  for (const a of articles) {
    const status = String(a.status ?? "").toLowerCase();
    if (status === "published") published += 1;
    if (!status || status === "draft") drafts += 1;
    if (typeof a.viewCount === "number" && a.viewCount > mostViewed) {
      mostViewed = a.viewCount;
    }
    const yes = a.helpfulYes ?? 0;
    const no = a.helpfulNo ?? 0;
    yesSum += yes;
    totalVotes += yes + no;
  }
  return {
    total: articles.length,
    published,
    drafts,
    mostViewed,
    helpfulPct: totalVotes > 0 ? (yesSum / totalVotes) * 100 : null,
    totalVotes,
  };
}

export type KbKpiKey =
  | "all"
  | "published"
  | "drafts"
  | "mostViewed"
  | "helpful";

export interface KbKpiStripProps {
  counts: KbKpiCounts;
  active: KbKpiKey;
  onPick: (next: KbKpiKey) => void;
}

export function KbKpiStrip({ counts, active, onPick }: KbKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Total"
        value={counts.total.toLocaleString()}
        icon={<BookOpen className="h-4 w-4" />}
        active={active === "all"}
        onClick={() => onPick("all")}
      />
      <KpiCard
        label="Published"
        value={counts.published.toLocaleString()}
        icon={<CheckCircle2 className="h-4 w-4" />}
        active={active === "published"}
        onClick={() => onPick(active === "published" ? "all" : "published")}
      />
      <KpiCard
        label="Drafts"
        value={counts.drafts.toLocaleString()}
        icon={<FileText className="h-4 w-4" />}
        active={active === "drafts"}
        onClick={() => onPick(active === "drafts" ? "all" : "drafts")}
      />
      <KpiCard
        label="Most-viewed"
        value={counts.mostViewed.toLocaleString()}
        icon={<Eye className="h-4 w-4" />}
        active={active === "mostViewed"}
        onClick={() => onPick(active === "mostViewed" ? "all" : "mostViewed")}
      />
      <KpiCard
        label="Helpful %"
        value={
          counts.helpfulPct != null ? `${counts.helpfulPct.toFixed(0)}%` : "—"
        }
        icon={<ThumbsUp className="h-4 w-4" />}
        active={active === "helpful"}
        onClick={() => onPick(active === "helpful" ? "all" : "helpful")}
        period={
          counts.totalVotes > 0 ? `${counts.totalVotes} votes` : "no votes"
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
  period,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  period?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary",
        active
          ? "rounded-[var(--zoru-radius-lg)] ring-1 ring-zoru-primary"
          : "",
      ].join(" ")}
    >
      <StatCard label={label} value={value} icon={icon} period={period} />
    </button>
  );
}

export default KbKpiStrip;
