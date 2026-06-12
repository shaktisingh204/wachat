'use client';

/**
 * SabCRM Projects — Board (kanban) view.
 *
 * One column per status (Planning → Cancelled), cards grouped by `status`.
 * The board itself is the shared 20ui record composite {@link RecordBoard}
 * (dnd-kit drag-and-drop with keyboard support — Space picks up / drops,
 * arrows move, Enter opens); this file only maps the {@link ProjectVM}s onto
 * the composite's record shape and renders the card content (`.pj-card*`).
 *
 * A drop on another column calls `onStatusChange`, which the parent persists
 * optimistically. Same-column reorders are ignored (card order isn't a
 * persisted field — parity with the previous bespoke board). Projects whose
 * status matches no known column are not rendered (also parity).
 */

import * as React from 'react';
import { User, CalendarClock } from 'lucide-react';

import { Badge, Progress } from '@/components/sabcrm/20ui';
import {
  RecordBoard,
  type RecordBoardColumn,
} from '@/components/sabcrm/20ui/composites/record';
import type { CrmRecord } from '@/lib/sabcrm/types';
import {
  PROJECTS_SLUG,
  PROJECT_STATUSES,
  projectPriorityOption,
  type ProjectTone,
} from '@/lib/sabcrm/projects-object';
import { formatDate, isOverdue, type ProjectVM } from './projects-shared';

interface ProjectsBoardProps {
  projects: ProjectVM[];
  onOpen: (project: ProjectVM) => void;
  onStatusChange: (id: string, status: string) => void;
  onAdd: (status: string) => void;
}

/** Status/priority tone → concrete dot color for the board column headers. */
const TONE_COLOR: Record<ProjectTone, string> = {
  neutral: 'var(--st-text-tertiary)',
  accent: 'var(--st-accent)',
  success: '#1f7a37',
  warning: '#9a6400',
  danger: 'var(--st-danger)',
  info: '#1d6fd6',
};

const COLUMNS: RecordBoardColumn[] = PROJECT_STATUSES.map((s) => ({
  id: s.value,
  label: s.label,
  color: TONE_COLOR[s.tone],
}));

export function ProjectsBoard({
  projects,
  onOpen,
  onStatusChange,
  onAdd,
}: ProjectsBoardProps): React.JSX.Element {
  const vmById = React.useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  // Minimal CrmRecord shells for the composite — only `_id` + the grouping
  // field matter; the card content renders from the looked-up ProjectVM.
  const records = React.useMemo<CrmRecord[]>(
    () =>
      projects.map((p) => ({
        _id: p.id,
        object: PROJECTS_SLUG,
        userId: '',
        data: { status: p.status },
        createdAt: p.updatedAt,
        updatedAt: p.updatedAt,
      })),
    [projects],
  );

  // Cross-column drops persist the new status; same-column reorders are a
  // visual no-op (order isn't a stored field), so they're filtered out here.
  const handleMove = React.useCallback(
    (recordId: string, toColumnId: string) => {
      const vm = vmById.get(recordId);
      if (vm && vm.status !== toColumnId) onStatusChange(recordId, toColumnId);
    },
    [vmById, onStatusChange],
  );

  const handleCardClick = React.useCallback(
    (record: CrmRecord) => {
      const vm = vmById.get(record._id);
      if (vm) onOpen(vm);
    },
    [vmById, onOpen],
  );

  const renderCard = React.useCallback(
    (record: CrmRecord): React.ReactNode => {
      const p = vmById.get(record._id);
      if (!p) return null;
      const pr = projectPriorityOption(p.priority);
      const pct = p.progress ?? 0;
      return (
        <div className="pj-card">
          <div className="pj-card__top">
            <span className="pj-card__name">{p.name}</span>
            <Badge tone={pr.tone} kind="soft">
              {pr.label}
            </Badge>
          </div>

          {p.progress != null ? (
            <div className="pj-card__progress">
              <Progress
                value={pct}
                size="sm"
                tone={pct >= 100 ? 'success' : 'accent'}
                label={`${pct}% complete`}
              />
            </div>
          ) : null}

          <div className="pj-card__meta">
            {p.owner ? (
              <span className="pj-card__chip">
                <User size={12} aria-hidden="true" />
                {p.owner}
              </span>
            ) : null}
            {p.dueDate ? (
              <span
                className={`pj-card__chip${isOverdue(p) ? ' pj-card__chip--over' : ''}`}
              >
                <CalendarClock size={12} aria-hidden="true" />
                {formatDate(p.dueDate)}
              </span>
            ) : null}
          </div>
        </div>
      );
    },
    [vmById],
  );

  return (
    <RecordBoard
      className="pj-board"
      columns={COLUMNS}
      records={records}
      groupKey="status"
      renderCard={renderCard}
      onMove={handleMove}
      onCardClick={handleCardClick}
      onAddCard={onAdd}
    />
  );
}
