'use client';

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
          className="text-white dark:text-zoru-ink"
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
          className="text-zoru-ink transition-all duration-700"
        />
        <text
          x={cx}
          y={cy}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={size * 0.22}
          fontWeight={600}
          className="rotate-90 fill-zoru-ink dark:fill-white"
          transform={`rotate(90, ${cx}, ${cy})`}
        >
          {rate}%
        </text>
      </svg>
      <span className="text-xs text-zoru-ink dark:text-zoru-ink-muted">Completion</span>
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
      <p className="text-xs font-semibold text-zoru-ink dark:text-zoru-ink-muted uppercase tracking-wide mb-3">
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
                  className="fill-white dark:fill-zoru-ink"
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
                  className="fill-zoru-ink"
                />
              )}
              {/* Count label */}
              {day.total > 0 && (
                <text
                  x={x + barW / 2}
                  y={CHART_HEIGHT - totalH - 4}
                  textAnchor="middle"
                  fontSize={10}
                  className="fill-zoru-ink dark:fill-zoru-ink-muted"
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
                className="fill-zoru-ink-muted dark:fill-zoru-ink"
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
          className="stroke-white dark:stroke-zoru-ink"
        />
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-xs text-zoru-ink dark:text-zoru-ink-muted">
          <span className="inline-block w-3 h-3 rounded-sm bg-zoru-surface-2 dark:bg-zoru-ink" />
          Total
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zoru-ink dark:text-zoru-ink-muted">
          <span className="inline-block w-3 h-3 rounded-sm bg-zoru-ink" />
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
    <div className="flex items-start gap-8 bg-white dark:bg-zoru-ink border border-zoru-line dark:border-zoru-line rounded-xl p-5">
      <BarChart data={dailyCounts} />
      <div className="flex-shrink-0 pt-5">
        <CircularProgress rate={completionRate} size={88} />
      </div>
    </div>
  );
}
