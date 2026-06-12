/**
 * SabSMS inbox — conversation-insights strip (V2.12).
 *
 * Slim presentational strip above the 3-pane inbox: top-5 topics from
 * the latest `sabsms_conversation_insights` document with a trend
 * arrow vs the previous nightly run. Renders nothing when no insights
 * exist yet (the nightly miner hasn't run, or there was no activity).
 *
 * Server component — data comes in via props from `loadInboxInsights`.
 */

import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";

import { Badge } from "@/components/sabcrm/20ui";

import type { InboxInsightTopic, InboxInsightsView } from "./types";

function TrendIcon({ trend }: { trend: InboxInsightTopic["trend"] }) {
  if (trend === "up") {
    return <ArrowUpRight className="h-3 w-3" aria-label="trending up" />;
  }
  if (trend === "down") {
    return <ArrowDownRight className="h-3 w-3" aria-label="trending down" />;
  }
  if (trend === "new") {
    return (
      <span className="text-[9px] font-semibold uppercase" aria-label="new topic">
        new
      </span>
    );
  }
  return <Minus className="h-3 w-3" aria-label="flat" />;
}

function sentimentTone(
  sentiment: InboxInsightTopic["sentiment"],
): "success" | "neutral" | "danger" {
  if (sentiment === "positive") return "success";
  if (sentiment === "negative") return "danger";
  return "neutral";
}

export function InboxInsightsStrip({
  insights,
}: {
  insights: InboxInsightsView | null;
}) {
  if (!insights || insights.topics.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--st-text-secondary)]">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Last 7 days · {insights.totalConversations} conversations
      </span>
      {insights.topics.map((topic) => (
        <Badge key={topic.label} tone={sentimentTone(topic.sentiment)} kind="soft">
          <span className="flex items-center gap-1">
            {topic.label}
            <span className="tabular-nums opacity-70">{topic.count}</span>
            <TrendIcon trend={topic.trend} />
          </span>
        </Badge>
      ))}
      {insights.computedAt && (
        <span className="ml-auto text-[10px] text-[var(--st-text-tertiary)]">
          computed{" "}
          {new Date(insights.computedAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}
