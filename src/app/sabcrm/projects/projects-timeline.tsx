'use client';

/**
 * SabCRM Projects — Timeline (gantt) view.
 *
 * A horizontal schedule: a month axis spanning the earliest start → latest due
 * across all dated projects, with one bar per project positioned and sized by
 * its start/due dates, tinted by status and filled by progress. Projects with
 * no dates are listed below as "unscheduled". Today is marked with a guide line.
 */

import * as React from 'react';

import { Badge, EmptyState } from '@/components/sabcrm/20ui';
import { projectStatusOption } from '@/lib/sabcrm/projects-object';
import { parseDate, formatDate, type ProjectVM } from './projects-shared';

const DAY = 86_400_000;

interface ProjectsTimelineProps {
  projects: ProjectVM[];
  onOpen: (project: ProjectVM) => void;
}

/** Resolve a project's [start, end] window; null when it has no usable dates. */
function windowOf(p: ProjectVM): { start: Date; end: Date } | null {
  const s = parseDate(p.startDate);
  const e = parseDate(p.dueDate);
  if (!s && !e) return null;
  const start = s ?? e!;
  const end = e ?? s!;
  // Guarantee at least a one-day bar even when start === end.
  return { start, end: end.getTime() >= start.getTime() ? end : start };
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function ProjectsTimeline({ projects, onOpen }: ProjectsTimelineProps): React.JSX.Element {
  const dated = projects
    .map((p) => ({ p, win: windowOf(p) }))
    .filter((x): x is { p: ProjectVM; win: { start: Date; end: Date } } => x.win != null);
  const unscheduled = projects.filter((p) => windowOf(p) == null);

  if (dated.length === 0) {
    return (
      <EmptyState
        title="Nothing scheduled"
        description="Add start or due dates to your projects to see them on the timeline."
      />
    );
  }

  // Range padded to whole months on both ends so bars never touch the edges.
  let min = dated[0].win.start;
  let max = dated[0].win.end;
  for (const { win } of dated) {
    if (win.start < min) min = win.start;
    if (win.end > max) max = win.end;
  }
  const rangeStart = startOfMonth(min);
  const rangeEnd = addMonths(startOfMonth(max), 1); // exclusive end = first of month after max
  const totalDays = Math.max(1, (rangeEnd.getTime() - rangeStart.getTime()) / DAY);

  // Month header cells.
  const months: Array<{ label: string; leftPct: number; widthPct: number }> = [];
  for (let m = new Date(rangeStart); m < rangeEnd; m = addMonths(m, 1)) {
    const next = addMonths(m, 1);
    months.push({
      label: new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(m),
      leftPct: ((m.getTime() - rangeStart.getTime()) / DAY / totalDays) * 100,
      widthPct: ((next.getTime() - m.getTime()) / DAY / totalDays) * 100,
    });
  }

  const pct = (d: Date): number => ((d.getTime() - rangeStart.getTime()) / DAY / totalDays) * 100;
  const now = new Date();
  const showToday = now >= rangeStart && now < rangeEnd;

  return (
    <div className="pj-timeline">
      <div className="pj-timeline__scroll">
        <div className="pj-timeline__grid">
          {/* Month axis */}
          <div className="pj-timeline__axis" aria-hidden="true">
            <div className="pj-timeline__axis-label" />
            <div className="pj-timeline__axis-track">
              {months.map((mo, i) => (
                <span
                  key={i}
                  className="pj-timeline__month"
                  style={{ left: `${mo.leftPct}%`, width: `${mo.widthPct}%` }}
                >
                  {mo.label}
                </span>
              ))}
              {showToday ? (
                <span className="pj-timeline__today" style={{ left: `${pct(now)}%` }} title="Today" />
              ) : null}
            </div>
          </div>

          {/* Rows */}
          {dated.map(({ p, win }) => {
            const o = projectStatusOption(p.status);
            const left = pct(win.start);
            const width = Math.max(1.5, pct(win.end) - left);
            const fill = p.progress ?? 0;
            return (
              <div key={p.id} className="pj-timeline__row">
                <button
                  type="button"
                  className="pj-timeline__row-label"
                  onClick={() => onOpen(p)}
                  title={p.name}
                >
                  <span className={`pj-dot pj-dot--${o.tone}`} aria-hidden="true" />
                  <span className="pj-timeline__row-name">{p.name}</span>
                </button>
                <div className="pj-timeline__row-track">
                  {showToday ? (
                    <span className="pj-timeline__today-line" style={{ left: `${pct(now)}%` }} aria-hidden="true" />
                  ) : null}
                  <button
                    type="button"
                    className={`pj-timeline__bar pj-timeline__bar--${o.tone}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onClick={() => onOpen(p)}
                    title={`${p.name} · ${formatDate(p.startDate)} – ${formatDate(p.dueDate)}`}
                  >
                    <span className="pj-timeline__bar-fill" style={{ width: `${fill}%` }} aria-hidden="true" />
                    <span className="pj-timeline__bar-label">{p.name}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {unscheduled.length > 0 ? (
        <div className="pj-timeline__unscheduled">
          <h4 className="pj-timeline__unscheduled-title">Unscheduled</h4>
          <div className="pj-timeline__unscheduled-list">
            {unscheduled.map((p) => {
              const o = projectStatusOption(p.status);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="pj-timeline__unscheduled-chip"
                  onClick={() => onOpen(p)}
                >
                  <Badge tone={o.tone} dot>
                    {p.name}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
