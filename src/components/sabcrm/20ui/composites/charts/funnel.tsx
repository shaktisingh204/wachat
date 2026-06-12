'use client';

/**
 * 20ui · charts — FunnelChart.
 *
 * An ordered, value-weighted horizontal funnel: each stage renders as a
 * centred band whose width is proportional to its value, annotated with the
 * stage label, its (pre-formatted) value, and its conversion % versus the
 * top-of-funnel stage. Bands deepen via a token-driven color-mix ramp, so
 * dark mode is free.
 *
 * Pure CSS bands (token-styled) — a funnel is read by relative width, not by
 * axes, so a plotting library adds nothing here.
 */

import * as React from 'react';

import { formatChartNumber, type FunnelStage } from './types';

import './charts.css';

export interface FunnelChartProps {
  /** Ordered stages, top-of-funnel first. Non-positive stages are dropped. */
  stages: ReadonlyArray<FunnelStage>;
  /** Formats stage values when a stage carries no `display` string. */
  formatValue?: (value: number) => string;
  /** Message rendered when no stage has a positive value. */
  emptyLabel?: string;
  /** Accessible name for the figure (defaults to "Funnel"). */
  label?: string;
  className?: string;
}

/** Band tint: deeper stages mix more text color into the background. */
function bandColor(index: number): string {
  const pct = Math.min(14 + index * 12, 80);
  return `color-mix(in srgb, var(--st-text) ${pct}%, var(--st-bg))`;
}

/** A horizontal funnel with stage labels + conversion % vs the top stage. */
export function FunnelChart({
  stages,
  formatValue = formatChartNumber,
  emptyLabel = 'No data to chart yet.',
  label = 'Funnel',
  className,
}: FunnelChartProps): React.JSX.Element {
  const positive = stages.filter((s) => s.value > 0);

  if (positive.length === 0) {
    return <div className="u-chx-empty">{emptyLabel}</div>;
  }

  const max = positive.reduce((m, s) => Math.max(m, s.value), 0);
  const head = positive[0]?.value ?? 0;

  return (
    <div
      className={['u-chx-funnel', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={`${label}: ${positive
        .map((s) => `${s.label} ${s.display ?? formatValue(s.value)}`)
        .join(', ')}`}
    >
      {positive.map((stage, idx) => {
        const widthPct = max > 0 ? Math.max(8, Math.round((stage.value / max) * 100)) : 0;
        const convPct = head > 0 ? Math.round((stage.value / head) * 100) : 0;
        return (
          <div className="u-chx-funnel__stage" key={stage.key ?? stage.label}>
            <div className="u-chx-funnel__head">
              <span className="u-chx-funnel__label" title={stage.label}>
                {stage.label}
              </span>
              <span className="u-chx-funnel__values">
                <span className="u-chx-funnel__value">
                  {stage.display ?? formatValue(stage.value)}
                </span>
                {idx > 0 ? (
                  <span className="u-chx-funnel__conv">{convPct}%</span>
                ) : null}
              </span>
            </div>
            <div className="u-chx-funnel__band-row">
              <div
                className="u-chx-funnel__band"
                style={{ width: `${widthPct}%`, background: bandColor(idx) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
