'use client';

/**
 * SabCRM Projects — detail drawer.
 *
 * A right-side 20ui Drawer showing one project's full details with Edit / Delete
 * actions. Read-only here; editing routes back through the shared form dialog in
 * the parent. Kept self-contained so the List, Board and Timeline views can all
 * open the same panel.
 */

import * as React from 'react';
import {
  Pencil,
  Trash2,
  User,
  Calendar,
  CalendarClock,
  DollarSign,
  type LucideIcon,
} from 'lucide-react';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  Badge,
  Progress,
  Button,
} from '@/components/sabcrm/20ui';
import { projectStatusOption, projectPriorityOption } from '@/lib/sabcrm/projects-object';
import { formatDate, formatBudget, isOverdue, type ProjectVM } from './projects-shared';

interface ProjectDetailDrawerProps {
  project: ProjectVM | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (project: ProjectVM) => void;
  onDelete: (project: ProjectVM) => void;
  deleting?: boolean;
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="pj-detail__row">
      <span className="pj-detail__label">
        <Icon size={14} aria-hidden />
        {label}
      </span>
      <span className="pj-detail__value">{children}</span>
    </div>
  );
}

export function ProjectDetailDrawer({
  project,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  deleting = false,
}: ProjectDetailDrawerProps): React.JSX.Element {
  const status = project ? projectStatusOption(project.status) : null;
  const priority = project ? projectPriorityOption(project.priority) : null;
  const pct = project?.progress ?? 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} side="right">
      <DrawerContent side="right" className="pj-detail">
        {project ? (
          <>
            <DrawerHeader>
              <DrawerTitle>{project.name}</DrawerTitle>
              <div className="pj-detail__badges">
                {status ? (
                  <Badge tone={status.tone} dot>
                    {status.label}
                  </Badge>
                ) : null}
                {priority ? (
                  <Badge tone={priority.tone} kind="soft">
                    {priority.label} priority
                  </Badge>
                ) : null}
              </div>
            </DrawerHeader>

            <div className="pj-detail__body">
              <div className="pj-detail__progress">
                <div className="pj-detail__progress-head">
                  <span>Progress</span>
                  <span className="pj-detail__progress-pct">{pct}%</span>
                </div>
                <Progress value={pct} tone={pct >= 100 ? 'success' : 'accent'} label={`${pct}% complete`} />
              </div>

              <Row icon={User} label="Owner">
                {project.owner || <span className="pj-muted">Unassigned</span>}
              </Row>
              <Row icon={Calendar} label="Start date">
                {project.startDate ? formatDate(project.startDate) : <span className="pj-muted">—</span>}
              </Row>
              <Row icon={CalendarClock} label="Due date">
                {project.dueDate ? (
                  <span className={isOverdue(project) ? 'pj-due pj-due--over' : undefined}>
                    {formatDate(project.dueDate)}
                  </span>
                ) : (
                  <span className="pj-muted">—</span>
                )}
              </Row>
              <Row icon={DollarSign} label="Budget">
                {project.budget == null ? <span className="pj-muted">—</span> : formatBudget(project.budget)}
              </Row>

              {project.description ? (
                <div className="pj-detail__desc">
                  <span className="pj-detail__label">Description</span>
                  <p>{project.description}</p>
                </div>
              ) : null}
            </div>

            <DrawerFooter>
              <Button
                variant="danger"
                iconLeft={Trash2}
                onClick={() => onDelete(project)}
                loading={deleting}
              >
                Delete
              </Button>
              <Button variant="primary" iconLeft={Pencil} onClick={() => onEdit(project)}>
                Edit
              </Button>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
