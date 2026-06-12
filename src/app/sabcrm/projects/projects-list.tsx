'use client';

/**
 * SabCRM Projects — List view.
 *
 * The default table surface: a sortable 20ui DataTable of every project with
 * status / priority badges, owner, dates, an inline progress bar and budget.
 * Clicking a row opens the detail drawer in the parent.
 */

import * as React from 'react';
import { CalendarClock } from 'lucide-react';

import { DataTable, Badge, Progress, EmptyState } from '@/components/sabcrm/20ui';
import type { DataTableColumn } from '@/components/sabcrm/20ui';
import { projectStatusOption, projectPriorityOption } from '@/lib/sabcrm/projects-object';
import {
  formatDate,
  formatBudget,
  isOverdue,
  type ProjectVM,
} from './projects-shared';

interface ProjectsListProps {
  projects: ProjectVM[];
  onOpen: (project: ProjectVM) => void;
}

export function ProjectsList({ projects, onOpen }: ProjectsListProps): React.JSX.Element {
  const columns: Array<DataTableColumn<ProjectVM>> = React.useMemo(
    () => [
      {
        key: 'name',
        header: 'Project',
        sortable: true,
        render: (p) => <span className="pj-cell-name">{p.name}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (p) => projectStatusOption(p.status).label,
        render: (p) => {
          const o = projectStatusOption(p.status);
          return (
            <Badge tone={o.tone} dot>
              {o.label}
            </Badge>
          );
        },
      },
      {
        key: 'priority',
        header: 'Priority',
        sortable: true,
        sortValue: (p) => projectPriorityOption(p.priority).label,
        render: (p) => {
          const o = projectPriorityOption(p.priority);
          return (
            <Badge tone={o.tone} kind="soft">
              {o.label}
            </Badge>
          );
        },
      },
      {
        key: 'owner',
        header: 'Owner',
        sortable: true,
        render: (p) => p.owner || <span className="pj-muted">—</span>,
      },
      {
        key: 'dueDate',
        header: 'Due',
        sortable: true,
        sortValue: (p) => p.dueDate ?? '',
        render: (p) =>
          p.dueDate ? (
            <span className={isOverdue(p) ? 'pj-due pj-due--over' : 'pj-due'}>
              {isOverdue(p) ? <CalendarClock size={13} aria-hidden="true" /> : null}
              {formatDate(p.dueDate)}
            </span>
          ) : (
            <span className="pj-muted">—</span>
          ),
      },
      {
        key: 'progress',
        header: 'Progress',
        sortable: true,
        sortValue: (p) => p.progress ?? -1,
        width: 160,
        render: (p) => {
          const pct = p.progress ?? 0;
          return (
            <div className="pj-progress-cell">
              <Progress value={pct} size="sm" tone={pct >= 100 ? 'success' : 'accent'} label={`${pct}% complete`} />
              <span className="pj-progress-cell__pct">{pct}%</span>
            </div>
          );
        },
      },
      {
        key: 'budget',
        header: 'Budget',
        sortable: true,
        align: 'right',
        sortValue: (p) => p.budget ?? -1,
        render: (p) => (p.budget == null ? <span className="pj-muted">—</span> : formatBudget(p.budget)),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      rows={projects}
      getRowId={(p) => p.id}
      onRowClick={onOpen}
      hover
      stickyHeader
      empty={
        <EmptyState
          title="No projects yet"
          description="Create your first project to start planning and tracking work."
        />
      }
    />
  );
}
