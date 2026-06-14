"use client";

/**
 * WaChat analytics building blocks (Wave 2)
 *
 * Reusable, cinematic pieces for the Overview / Analytics / Health / Reports
 * pages: an animated KPI tile (CountUp + delta) and an AI Insights card that
 * narrates real metrics via Claude (server action `aiAnalyticsInsights`).
 * Drop these into any analytics surface; they own their own motion + loading.
 */

import * as React from "react";
import { Sparkles, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { Button, Card } from "@/components/sabcrm/20ui";
import { cn } from "@/lib/utils";
import { aiAnalyticsInsights } from "@/lib/wachat/ai/copilot-actions";
import type { AnalyticsInsightsResult, BrandVoiceInput } from "@/lib/wachat/ai/types";

import { CountUp, FadeUp, ProcessingDots, StaggerItem } from "../motion";

/* ===================================================================
 * KpiTile — animated headline metric
 * =================================================================== */
export interface KpiTileProps {
  label: string;
  value: number;
  /** % change vs previous period; positive = up. */
  delta?: number;
  /** When true, a downward delta is good (e.g. failure rate). */
  invertDelta?: boolean;
  icon?: LucideIcon;
  format?: (n: number) => string;
  /** Stagger index for entrance. */
  index?: number;
  className?: string;
}

export function KpiTile({
  label,
  value,
  delta,
  invertDelta = false,
  icon: Icon,
  format,
  index = 0,
  className,
}: KpiTileProps) {
  const up = (delta ?? 0) >= 0;
  const good = invertDelta ? !up : up;
  const tone = delta == null ? "" : good ? "var(--st-status-ok, #16a34a)" : "var(--st-danger, #dc2626)";
  return (
    <Card
      className={cn(
        "wachat-stagger-item flex flex-col gap-2 p-4",
        className,
      )}
      style={{ ["--i" as string]: index } as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--st-text-secondary)]">{label}</span>
        {Icon ? <Icon size={15} className="text-[var(--st-text-secondary)]" /> : null}
      </div>
      <span className="text-2xl font-semibold tabular-nums text-[var(--st-text)]">
        <CountUp value={value} format={format} />
      </span>
      {delta != null ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: tone }}>
          {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(delta).toFixed(1)}%
          <span className="text-[var(--st-text-secondary)]">vs prev</span>
        </span>
      ) : null}
    </Card>
  );
}

/* ===================================================================
 * AiInsightsCard — Claude narrates the metrics on this page
 * =================================================================== */
export interface AiInsightsCardProps {
  projectId: string;
  metrics: Record<string, number | string>;
  context?: string;
  brand?: BrandVoiceInput;
  /** Auto-run on mount (default: wait for the button). */
  auto?: boolean;
  className?: string;
}

export function AiInsightsCard({
  projectId,
  metrics,
  context,
  brand,
  auto = false,
  className,
}: AiInsightsCardProps) {
  void projectId; // reserved for future per-project caching of insights
  const [result, setResult] = React.useState<AnalyticsInsightsResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const ranRef = React.useRef(false);

  const run = React.useCallback(async () => {
    setLoading(true);
    const r = await aiAnalyticsInsights({ metrics, context, brand });
    setResult(r);
    setLoading(false);
  }, [metrics, context, brand]);

  React.useEffect(() => {
    if (auto && !ranRef.current) {
      ranRef.current = true;
      void run();
    }
  }, [auto, run]);

  return (
    <Card className={cn("flex flex-col gap-3 p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--st-accent)] text-[var(--st-bg)]">
            <Sparkles size={15} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--st-text)]">AI insights</p>
            <p className="text-[11px] text-[var(--st-text-secondary)]">Grounded in your live metrics</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" iconLeft={Sparkles} loading={loading} onClick={run}>
          {result ? "Regenerate" : "Analyze"}
        </Button>
      </div>

      {loading && !result ? (
        <div className="flex items-center gap-2 py-2 text-sm text-[var(--st-text-secondary)]">
          <ProcessingDots className="text-[var(--st-accent)]" /> Reading your numbers…
        </div>
      ) : null}

      {result && !result.ok ? (
        <p className="text-sm text-[var(--st-text-secondary)]">
          {result.error ?? "Couldn't generate insights right now."}
        </p>
      ) : null}

      {result && result.ok ? (
        <div className="space-y-3">
          <FadeUp>
            <p className="text-sm font-medium text-[var(--st-text)]">{result.headline}</p>
          </FadeUp>
          <ul className="space-y-1.5">
            {result.insights.map((ins, i) => (
              <StaggerItem
                key={i}
                index={i}
                as="li"
                className="flex gap-2 text-sm text-[var(--st-text-secondary)]"
              >
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--st-accent)]" />
                <span>{ins}</span>
              </StaggerItem>
            ))}
          </ul>
          {result.recommendation ? (
            <FadeUp index={result.insights.length}>
              <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm text-[var(--st-text)]">
                <span className="font-medium">Recommended: </span>
                {result.recommendation}
              </div>
            </FadeUp>
          ) : null}
        </div>
      ) : null}

      {!result && !loading ? (
        <p className="text-sm text-[var(--st-text-secondary)]">
          Let Claude read this dashboard and surface what changed, what’s working, and the single best next move.
        </p>
      ) : null}
    </Card>
  );
}
