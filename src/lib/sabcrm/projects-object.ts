/**
 * SabCRM — "Projects" object definition + presentation maps.
 *
 * Projects is a first-class SabCRM data-model object (slug `projects`), seeded
 * idempotently as a CUSTOM object via {@link ensureProjectsObjectTw}. It lives
 * in the same `sabcrm_records` store as every other object and routes through
 * the Rust engine's generic CRUD — so no Rust change is needed to add it.
 *
 * This module is plain data (no `'use server'`, no React) so BOTH the seeding
 * server action AND the client project-management surface can import it: the
 * action consumes {@link PROJECTS_OBJECT}; the page consumes the status/priority
 * option maps to render badges, board columns and timeline bars.
 */

import type { ObjectMetadata, FieldOption } from '@/lib/sabcrm/types';

/** The object slug — used everywhere records are read/written. */
export const PROJECTS_SLUG = 'projects' as const;

/** Field keys, centralised so the page and the object def never drift. */
export const PROJECT_FIELDS = {
  name: 'name',
  status: 'status',
  priority: 'priority',
  owner: 'owner',
  startDate: 'startDate',
  dueDate: 'dueDate',
  progress: 'progress',
  budget: 'budget',
  description: 'description',
} as const;

/**
 * A 20ui Badge tone (mirrored locally as a string union so this data module
 * never imports a React component into the server-action graph).
 */
export type ProjectTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

/** One SELECT option enriched with the tone its badge / column header uses. */
export interface ProjectOption extends FieldOption {
  tone: ProjectTone;
}

/**
 * Project lifecycle statuses, in board (left→right) order. The `value`s are the
 * canonical stored values; `color` feeds the data-model SELECT swatch and
 * `tone` drives the 20ui Badge / board column accents on the page.
 */
export const PROJECT_STATUSES: readonly ProjectOption[] = [
  { value: 'PLANNING', label: 'Planning', color: 'blue', tone: 'info' },
  { value: 'ACTIVE', label: 'Active', color: 'green', tone: 'success' },
  { value: 'ON_HOLD', label: 'On hold', color: 'orange', tone: 'warning' },
  { value: 'COMPLETED', label: 'Completed', color: 'purple', tone: 'accent' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'gray', tone: 'neutral' },
] as const;

/** Project priorities, lowest→highest. */
export const PROJECT_PRIORITIES: readonly ProjectOption[] = [
  { value: 'LOW', label: 'Low', color: 'gray', tone: 'neutral' },
  { value: 'MEDIUM', label: 'Medium', color: 'yellow', tone: 'info' },
  { value: 'HIGH', label: 'High', color: 'orange', tone: 'warning' },
  { value: 'URGENT', label: 'Urgent', color: 'red', tone: 'danger' },
] as const;

/** Default applied to new projects when the field is left blank. */
export const DEFAULT_PROJECT_STATUS = 'PLANNING';
export const DEFAULT_PROJECT_PRIORITY = 'MEDIUM';

/** Resolve a status `value` to its option (falls back to a neutral unknown). */
export function projectStatusOption(value: unknown): ProjectOption {
  return (
    PROJECT_STATUSES.find((s) => s.value === value) ?? {
      value: String(value ?? ''),
      label: String(value ?? '—'),
      color: 'gray',
      tone: 'neutral',
    }
  );
}

/** Resolve a priority `value` to its option (falls back to a neutral unknown). */
export function projectPriorityOption(value: unknown): ProjectOption {
  return (
    PROJECT_PRIORITIES.find((p) => p.value === value) ?? {
      value: String(value ?? ''),
      label: String(value ?? '—'),
      color: 'gray',
      tone: 'neutral',
    }
  );
}

/**
 * The full Projects object definition handed to `createObjectTw`. Marked
 * `standard: false` so it persists as a genuine custom object the Rust object
 * merge always includes (and the data-model settings can inspect). `board`
 * groups the kanban by `status`.
 */
export const PROJECTS_OBJECT: ObjectMetadata = {
  slug: PROJECTS_SLUG,
  labelSingular: 'Project',
  labelPlural: 'Projects',
  icon: 'folder-kanban',
  description: 'Plan, track and deliver projects across the workspace.',
  standard: false,
  views: ['table', 'board'],
  board: { groupByField: PROJECT_FIELDS.status },
  fields: [
    {
      key: PROJECT_FIELDS.name,
      label: 'Project name',
      type: 'TEXT',
      icon: 'folder-kanban',
      required: true,
      inTable: true,
      isLabel: true,
      description: 'The project title.',
    },
    {
      key: PROJECT_FIELDS.status,
      label: 'Status',
      type: 'SELECT',
      icon: 'activity',
      required: true,
      inTable: true,
      description: 'Where the project is in its lifecycle.',
      options: PROJECT_STATUSES.map(({ value, label, color }) => ({ value, label, color })),
      defaultValue: DEFAULT_PROJECT_STATUS,
    },
    {
      key: PROJECT_FIELDS.priority,
      label: 'Priority',
      type: 'SELECT',
      icon: 'flag',
      inTable: true,
      description: 'How urgent the project is.',
      options: PROJECT_PRIORITIES.map(({ value, label, color }) => ({ value, label, color })),
      defaultValue: DEFAULT_PROJECT_PRIORITY,
    },
    {
      key: PROJECT_FIELDS.owner,
      label: 'Owner',
      type: 'TEXT',
      icon: 'user',
      inTable: true,
      description: 'Person accountable for the project.',
    },
    {
      key: PROJECT_FIELDS.startDate,
      label: 'Start date',
      type: 'DATE',
      icon: 'calendar',
      inTable: true,
      description: 'When work begins.',
    },
    {
      key: PROJECT_FIELDS.dueDate,
      label: 'Due date',
      type: 'DATE',
      icon: 'calendar-clock',
      inTable: true,
      description: 'Target completion date.',
    },
    {
      key: PROJECT_FIELDS.progress,
      label: 'Progress',
      type: 'NUMBER',
      icon: 'percent',
      inTable: true,
      description: 'Completion percentage (0–100).',
      defaultValue: 0,
    },
    {
      key: PROJECT_FIELDS.budget,
      label: 'Budget',
      type: 'NUMBER',
      icon: 'dollar-sign',
      inTable: true,
      description: 'Allocated budget.',
    },
    {
      key: PROJECT_FIELDS.description,
      label: 'Description',
      type: 'TEXT',
      icon: 'align-left',
      inTable: false,
      description: 'Overview, goals and notes.',
    },
  ],
};
