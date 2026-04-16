'use client';

import type { DailyCount } from '@/app/actions/sabflow-results';

/* ── helpers ────────────────────────────────────────────── */

function fmtAxisDate(iso: string) {
  try {
    const [, m, d] = iso.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  } catch {
    return iso.slice(5);
  }
}

/* ── CircularProgress ───────────────────────────────────── */

function CircularProgress({ rate, size = 80 }: { rate: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (rate / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          className="text-zinc-200 dark:text-zinc-700"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-amber-500 transition-all duration-700"
        />
        <text
          x={cx}
          y={cy}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={size * 0.22}
          fontWeight={600}
          className="rotate-90 fill-zinc-700 dark:fill-zinc-200"
          transform={`rotate(90, ${cx}, ${cy})`}
        >
          {rate}%
        </text>
      </svg>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Completion</span>
    </div>
  );
}

/* ── BarChart ───────────────────────────────────────────── */

const CHART_HEIGHT = 120;
const BAR_GAP = 6;

function BarChart({ data }: { data: DailyCount[] }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const barCount = data.length;
  // We don't know the exact container width at render time, so use viewBox
  const viewW = barCount * 36 + (barCount - 1) * BAR_GAP;

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
        Sessions — last {barCount} days
      </p>
      <svg
        viewBox={`0 0 ${viewW} ${CHART_HEIGHT + 24}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full overflow-visible"
        aria-label="Sessions per day bar chart"
        role="img"
      >
        {data.map((day, i) => {
          const barW = 36;
          const x = i * (barW + BAR_GAP);
          const totalH = (day.total / maxVal) * CHART_HEIGHT;
          const completedH = day.total > 0 ? (day.completed / day.total) * totalH : 0;

          return (
            <g key={day.date}>
              {/* Total bar (grey background) */}
              {totalH > 0 && (
                <rect
                  x={x}
                  y={CHART_HEIGHT - totalH}
                  width={barW}
                  height={totalH}
                  rx={4}
                  className="fill-zinc-200 dark:fill-zinc-700"
                />
              )}
              {/* Completed bar (amber overlay) */}
              {completedH > 0 && (
                <rect
                  x={x}
                  y={CHART_HEIGHT - completedH}
                  width={barW}
                  height={completedH}
                  rx={4}
                  className="fill-amber-500"
                />
              )}
              {/* Count label */}
              {day.total > 0 && (
                <text
                  x={x + barW / 2}
                  y={CHART_HEIGHT - totalH - 4}
                  textAnchor="middle"
                  fontSize={10}
                  className="fill-zinc-500 dark:fill-zinc-400"
                >
                  {day.total}
                </text>
              )}
              {/* Date axis label */}
              <text
                x={x + barW / 2}
                y={CHART_HEIGHT + 16}
                textAnchor="middle"
                fontSize={10}
                className="fill-zinc-400 dark:fill-zinc-500"
              >
                {fmtAxisDate(day.date)}
              </text>
            </g>
          );
        })}
        {/* Zero line */}
        <line
          x1={0}
          y1={CHART_HEIGHT}
          x2={viewW}
          y2={CHART_HEIGHT}
          strokeWidth={1}
          className="stroke-zinc-200 dark:stroke-zinc-700"
        />
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="inline-block w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-700" />
          Total
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
          Completed
        </div>
      </div>
    </div>
  );
}

/* ── AnalyticsChart ─────────────────────────────────────── */

type Props = {
  dailyCounts: DailyCount[];
  completionRate: number;
};

export function AnalyticsChart({ dailyCounts, completionRate }: Props) {
  return (
    <div className="flex items-start gap-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
      <BarChart data={dailyCounts} />
      <div className="flex-shrink-0 pt-5">
        <CircularProgress rate={completionRate} size={88} />
      </div>
    </div>
  );
}
