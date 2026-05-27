/**
 * Public Gantt chart — pure HTML + CSS (no library).
 *
 * Layout:
 *   • Header row: week tick marks between project.start_date and
 *     project.deadline + 2 weeks of buffer.
 *   • Body: one row per task. Task bar is a coloured absolute-positioned
 *     div whose `left` + `width` are computed as percentages of the
 *     total timeline span.
 *   • Today line: vertical red line at the current date (if it falls
 *     inside the timeline).
 *   • Milestones: small diamonds plotted on a separate strip above the
 *     task rows so they don't collide with bars.
 *
 * Bars are coloured by priority. The completion % comes from the task
 * status (Done → 100, In progress → 50, etc — see `statusToPercent` in
 * the action).
 */

import type {
  PublicGanttMilestone,
  PublicGanttTask,
} from '@/app/actions/public-gantt.actions.types';

type ProjectMeta = {
  _id: string;
  name: string;
  status: string;
  startDate: string | null;
  deadline: string | null;
  description: string | null;
};

type Props = {
  project: ProjectMeta;
  tasks: PublicGanttTask[];
  milestones: PublicGanttMilestone[];
};

const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = MS_PER_DAY * 7;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 32;
const MILESTONE_STRIP_HEIGHT = 28;

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
};

function asDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeTimeline(
  project: ProjectMeta,
  tasks: PublicGanttTask[],
  milestones: PublicGanttMilestone[],
): { start: Date; end: Date; spanMs: number } {
  const candidatesStart: number[] = [];
  const candidatesEnd: number[] = [];
  const projStart = asDate(project.startDate);
  const projEnd = asDate(project.deadline);
  if (projStart) candidatesStart.push(projStart.getTime());
  if (projEnd) candidatesEnd.push(projEnd.getTime());
  for (const t of tasks) {
    const s = asDate(t.startDate);
    const e = asDate(t.dueDate);
    if (s) candidatesStart.push(s.getTime());
    if (e) candidatesEnd.push(e.getTime());
  }
  for (const m of milestones) {
    const e = asDate(m.endDate);
    if (e) candidatesEnd.push(e.getTime());
  }
  const now = Date.now();
  if (candidatesStart.length === 0) candidatesStart.push(now);
  if (candidatesEnd.length === 0) {
    candidatesEnd.push(now + 14 * MS_PER_DAY);
  }

  let start = startOfDay(new Date(Math.min(...candidatesStart)));
  let end = startOfDay(new Date(Math.max(...candidatesEnd)));
  // Add the 2-week buffer per spec.
  end = addDays(end, 14);
  if (end.getTime() <= start.getTime()) {
    end = addDays(start, 14);
  }
  return { start, end, spanMs: end.getTime() - start.getTime() };
}

function pctBetween(
  fromMs: number,
  spanMs: number,
  pointMs: number,
): number {
  return ((pointMs - fromMs) / spanMs) * 100;
}

export function PublicGanttChart({
  project,
  tasks,
  milestones,
}: Props): React.ReactElement {
  if (tasks.length === 0 && milestones.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zoru-line p-8 text-center text-sm text-zoru-ink">
        No tasks or milestones to chart.
      </div>
    );
  }

  const { start, end, spanMs } = computeTimeline(project, tasks, milestones);
  const totalWeeks = Math.max(1, Math.ceil(spanMs / MS_PER_WEEK));

  // Week tick marks.
  const ticks: { label: string; leftPct: number }[] = [];
  for (let i = 0; i <= totalWeeks; i++) {
    const tickDate = addDays(start, i * 7);
    if (tickDate.getTime() > end.getTime()) break;
    ticks.push({
      label: fmtShort(tickDate),
      leftPct: pctBetween(start.getTime(), spanMs, tickDate.getTime()),
    });
  }

  const todayMs = Date.now();
  const todayInside = todayMs >= start.getTime() && todayMs <= end.getTime();
  const todayLeftPct = todayInside
    ? pctBetween(start.getTime(), spanMs, todayMs)
    : null;

  const totalRows = tasks.length || 1;
  const bodyHeight = totalRows * ROW_HEIGHT;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        {/* Header — week ticks */}
        <div
          className="relative border-b border-zoru-line bg-zoru-surface-2"
          style={{ height: HEADER_HEIGHT }}
        >
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute top-0 flex h-full items-center pl-1 text-[11px] text-zoru-ink"
              style={{
                left: `${t.leftPct}%`,
                borderLeft: '1px solid rgb(228 228 231)',
                minWidth: 1,
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* Milestones strip */}
        {milestones.length > 0 ? (
          <div
            className="relative border-b border-zoru-line bg-white"
            style={{ height: MILESTONE_STRIP_HEIGHT }}
          >
            {milestones.map((m) => {
              const d = asDate(m.endDate);
              if (!d) return null;
              const leftPct = pctBetween(start.getTime(), spanMs, d.getTime());
              if (leftPct < 0 || leftPct > 100) return null;
              const filled = m.status === 'complete';
              return (
                <div
                  key={m._id}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${leftPct}%` }}
                  title={`${m.title} · ${fmtShort(d)}`}
                >
                  <div
                    aria-label={m.title}
                    className="h-3 w-3 rotate-45 border-2"
                    style={{
                      borderColor: filled ? '#10b981' : '#f59e0b',
                      background: filled ? '#10b981' : 'white',
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Body — task rows */}
        <div
          className="relative border-b border-zoru-line bg-white"
          style={{ height: bodyHeight }}
        >
          {/* Vertical week guides */}
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute top-0 h-full"
              style={{
                left: `${t.leftPct}%`,
                borderLeft: '1px dashed rgb(244 244 245)',
                width: 0,
              }}
            />
          ))}

          {/* Today line */}
          {todayLeftPct != null ? (
            <div
              className="absolute top-0 h-full"
              style={{
                left: `${todayLeftPct}%`,
                borderLeft: '2px solid #ef4444',
                width: 0,
              }}
              aria-label="Today"
            />
          ) : null}

          {tasks.map((task, idx) => {
            const taskStart = asDate(task.startDate) ?? start;
            const taskEnd =
              asDate(task.dueDate) ?? addDays(taskStart, 3);
            const clampedStart = Math.max(
              start.getTime(),
              Math.min(end.getTime(), taskStart.getTime()),
            );
            const clampedEnd = Math.max(
              start.getTime(),
              Math.min(end.getTime(), taskEnd.getTime()),
            );
            const leftPct = pctBetween(start.getTime(), spanMs, clampedStart);
            const widthPct = Math.max(
              1.5,
              pctBetween(start.getTime(), spanMs, clampedEnd) - leftPct,
            );
            const color =
              PRIORITY_COLOR[task.priority?.toLowerCase() ?? ''] || '#3b82f6';
            const initials = (task.assigneeName || '')
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((s) => s[0]?.toUpperCase() ?? '')
              .join('');
            return (
              <div
                key={task._id}
                className="absolute left-0 right-0 flex items-center"
                style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <div
                  className="absolute flex h-7 items-center overflow-hidden rounded-md shadow-sm"
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    background: color,
                  }}
                  title={`${task.heading} · ${fmtShort(taskStart)} → ${fmtShort(taskEnd)}`}
                >
                  {/* Completion fill */}
                  <div
                    className="absolute inset-y-0 left-0 bg-white/30"
                    style={{ width: `${task.completionPercent}%` }}
                    aria-hidden
                  />
                  <span className="relative z-10 truncate px-2 text-[12px] font-medium text-white">
                    {task.heading}
                  </span>
                  {initials ? (
                    <span className="relative z-10 ml-auto mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-semibold text-white">
                      {initials}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-zoru-ink">
          <LegendSwatch color={PRIORITY_COLOR.urgent} label="Urgent" />
          <LegendSwatch color={PRIORITY_COLOR.high} label="High" />
          <LegendSwatch color={PRIORITY_COLOR.medium} label="Medium" />
          <LegendSwatch color={PRIORITY_COLOR.low} label="Low" />
          <span className="ml-2 inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rotate-45 border-2 border-zoru-line bg-zoru-ink" />
            Milestone (done)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rotate-45 border-2 border-zoru-line bg-white" />
            Milestone
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-[2px] bg-zoru-ink" />
            Today
          </span>
        </div>
      </div>
    </div>
  );
}

function LegendSwatch({
  color,
  label,
}: {
  color: string;
  label: string;
}): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
