'use client';

/**
 * SabCRM — TwentyFunnelChart
 *
 * A pipeline funnel rendered in the **.sabcrm-twenty** design language (NOT
 * ZoruUI). Unlike the sibling chart primitives (`bar-chart.tsx`,
 * `donut-chart.tsx`, `line-chart.tsx`) which are built on ZoruUI + Recharts,
 * the SabCRM dashboard page itself is `.sabcrm-twenty`-only — so this funnel is
 * authored with `--st-*` design tokens and the dashboard's existing `.st-panel`
 * chrome, keeping it visually native to the Twenty-faithful dashboard.
 *
 * A funnel is a stage-ordered view: each stage is a horizontal band whose width
 * is proportional to its value, and each band is annotated with the conversion
 * (drop-off) ratio versus the *first* stage. It is the natural read for a sales
 * pipeline where every opportunity must pass through ordered stages.
 *
 * Data shape
 * ----------
 * The component owns no data-fetching. The caller passes already-ordered
 * `stages` (top-of-funnel first). Each stage carries a label, a numeric value
 * (count or summed amount) and an optional pre-formatted display string.
 *
 * Resilience
 * ----------
 * Loading / empty states render inline using the dashboard's `.st-timeline-empty`
 * convention. The component never throws.
 */

import * as React from 'react';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** One ordered stage of the funnel (top-of-funnel first). */
export interface FunnelStage {
  /** Stable key for React (e.g. the raw stage value). */
  key: string;
  /** Human label shown on the band. */
  label: string;
  /** Numeric weight that drives the band width and conversion ratio. */
  value: number;
  /** Pre-formatted value for display (e.g. "$1.2M" or "42"). */
  display: string;
}

export interface TwentyFunnelChartProps {
  /** Card title. */
  title: string;
  /** Ordered stages, top-of-funnel first. Empty → empty state. */
  stages: FunnelStage[];
  /** Message shown when there are no stages with a positive value. */
  emptyLabel?: string;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Renders an ordered, proportional pipeline funnel in `.sabcrm-twenty` styling.
 * Band widths are scaled to the largest stage value; each band shows its share
 * of the top stage (conversion) so drop-off is legible at a glance.
 */
export function TwentyFunnelChart({
  title,
  stages,
  emptyLabel = 'No pipeline stages to chart yet.',
}: TwentyFunnelChartProps): React.JSX.Element {
  const positive = stages.filter((s) => s.value > 0);
  const max = positive.reduce((m, s) => Math.max(m, s.value), 0);
  const head = positive[0]?.value ?? 0;

  return (
    <div className="st-panel">
      <div className="st-panel__head">{title}</div>
      {positive.length === 0 ? (
        <div className="st-timeline-empty">{emptyLabel}</div>
      ) : (
        <div
          role="img"
          aria-label={`${title}: ${positive
            .map((s) => `${s.label} ${s.display}`)
            .join(', ')}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--st-space-2)',
            padding: 'var(--st-space-4)',
          }}
        >
          {positive.map((stage, idx) => {
            // Width relative to the widest band (always the first on a
            // monotonic funnel, but max-based keeps it robust if data isn't).
            const widthPct =
              max > 0 ? Math.max(8, Math.round((stage.value / max) * 100)) : 0;
            // Conversion vs. top-of-funnel.
            const convPct =
              head > 0 ? Math.round((stage.value / head) * 100) : 0;
            // Greyscale ramp so deeper stages read as "narrower + darker",
            // matching the B&W language of the sibling chart primitives.
            const shade = 92 - Math.min(idx, 6) * 11;
            return (
              <div
                key={stage.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 'var(--st-space-2)',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      color: 'var(--st-text)',
                      fontSize: 'var(--st-font-size)',
                    }}
                  >
                    {stage.label}
                  </span>
                  <span
                    style={{
                      flex: '0 0 auto',
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: 'var(--st-space-2)',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--st-text)',
                        fontSize: 'var(--st-font-size-sm)',
                        fontWeight: 'var(--st-fw-medium)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {stage.display}
                    </span>
                    {idx > 0 ? (
                      <span
                        style={{
                          color: 'var(--st-text-tertiary)',
                          fontSize: 'var(--st-font-size-sm)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {convPct}%
                      </span>
                    ) : null}
                  </span>
                </div>
                {/* Centred band whose width encodes the stage value. */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct}%`,
                      minWidth: 24,
                      height: 26,
                      borderRadius: 'var(--st-radius)',
                      background: `hsl(220 6% ${shade}%)`,
                      border: '1px solid var(--st-border)',
                      transition: 'width 220ms ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
