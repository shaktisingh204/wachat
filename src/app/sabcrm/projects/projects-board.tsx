'use client';

/**
 * SabCRM Projects — Board (kanban) view.
 *
 * One column per status (Planning → Cancelled), cards grouped by `status`.
 * Cards are draggable between columns via native HTML5 drag-and-drop; a drop
 * calls `onStatusChange`, which the parent persists optimistically. Mirrors the
 * native-DnD pattern used by the existing SabCRM board surfaces (no dnd library).
 */

import * as React from 'react';
import { User, CalendarClock, Plus } from 'lucide-react';

import { Badge, Progress, IconButton } from '@/components/sabcrm/20ui';
import { PROJECT_STATUSES, projectPriorityOption } from '@/lib/sabcrm/projects-object';
import { formatDate, isOverdue, type ProjectVM } from './projects-shared';

interface ProjectsBoardProps {
  projects: ProjectVM[];
  onOpen: (project: ProjectVM) => void;
  onStatusChange: (id: string, status: string) => void;
  onAdd: (status: string) => void;
}

export function ProjectsBoard({
  projects,
  onOpen,
  onStatusChange,
  onAdd,
}: ProjectsBoardProps): React.JSX.Element {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [overStatus, setOverStatus] = React.useState<string | null>(null);

  const byStatus = React.useMemo(() => {
    const map = new Map<string, ProjectVM[]>();
    for (const s of PROJECT_STATUSES) map.set(s.value, []);
    for (const p of projects) {
      const bucket = map.get(p.status);
      if (bucket) bucket.push(p);
      else map.set(p.status, [p]); // unknown status → its own implicit bucket
    }
    return map;
  }, [projects]);

  const handleDrop = (status: string) => {
    if (draggingId) {
      const dragged = projects.find((p) => p.id === draggingId);
      if (dragged && dragged.status !== status) onStatusChange(draggingId, status);
    }
    setDraggingId(null);
    setOverStatus(null);
  };

  return (
    <div className="pm-board" role="list" aria-label="Projects board">
      {PROJECT_STATUSES.map((col) => {
        const items = byStatus.get(col.value) ?? [];
        const isOver = overStatus === col.value;
        return (
          <section
            key={col.value}
            role="listitem"
            className={`pm-board__col${isOver ? ' is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (overStatus !== col.value) setOverStatus(col.value);
            }}
            onDragLeave={(e) => {
              // Only clear when truly leaving the column (not entering a child).
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOverStatus((s) => (s === col.value ? null : s));
              }
            }}
            onDrop={() => handleDrop(col.value)}
          >
            <header className="pm-board__col-head">
              <span className={`pm-board__dot pm-board__dot--${col.tone}`} aria-hidden="true" />
              <h3 className="pm-board__col-title">{col.label}</h3>
              <span className="pm-board__count">{items.length}</span>
              <IconButton
                icon={Plus}
                label={`Add project to ${col.label}`}
                size="sm"
                variant="ghost"
                onClick={() => onAdd(col.value)}
              />
            </header>

            <div className="pm-board__cards">
              {items.map((p) => {
                const pr = projectPriorityOption(p.priority);
                const pct = p.progress ?? 0;
                return (
                  <article
                    key={p.id}
                    className={`pm-card${draggingId === p.id ? ' is-dragging' : ''}`}
                    draggable
                    onDragStart={() => setDraggingId(p.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStatus(null);
                    }}
                    onClick={() => onOpen(p)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(p);
                      }
                    }}
                  >
                    <div className="pm-card__top">
                      <span className="pm-card__name">{p.name}</span>
                      <Badge tone={pr.tone} kind="soft">
                        {pr.label}
                      </Badge>
                    </div>

                    {p.progress != null ? (
                      <div className="pm-card__progress">
                        <Progress value={pct} size="sm" tone={pct >= 100 ? 'success' : 'accent'} label={`${pct}% complete`} />
                      </div>
                    ) : null}

                    <div className="pm-card__meta">
                      {p.owner ? (
                        <span className="pm-card__chip">
                          <User size={12} aria-hidden="true" />
                          {p.owner}
                        </span>
                      ) : null}
                      {p.dueDate ? (
                        <span className={`pm-card__chip${isOverdue(p) ? ' pm-card__chip--over' : ''}`}>
                          <CalendarClock size={12} aria-hidden="true" />
                          {formatDate(p.dueDate)}
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {items.length === 0 ? <p className="pm-board__empty">Drop projects here</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
