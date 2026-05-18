/**
 * Goal-setting form config — shared between /new and /[id]/edit.
 *
 * The server action `saveCrmGoal` reads: title, description, assigneeId,
 * targetDate, status, progress, id. Additional fields below (cycle,
 * weight, ownerId, milestones) are accepted by the form but not yet
 * persisted by the action — TODO 1D.3: extend action to consume them.
 */

import type { HrField } from '../../hr/_components/hr-entity-page';

export const fields: HrField[] = [
  {
    name: 'assigneeId',
    label: 'Employee',
    type: 'entity',
    entity: 'employee',
    required: true,
  },
  {
    name: 'title',
    label: 'Title',
    required: true,
    fullWidth: true,
    placeholder: 'e.g. Increase NPS by 10 points this quarter',
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
    placeholder: 'Describe the goal in detail…',
  },
  { name: 'cycle', label: 'Cycle', placeholder: 'Q1 2026 / FY 25-26' },
  {
    name: 'weight',
    label: 'Weight (%)',
    type: 'number',
    placeholder: '0–100',
    help: 'Relative weight against other goals in the same cycle.',
  },
  {
    name: 'targetDate',
    label: 'Target Date',
    type: 'date',
    required: true,
  },
  {
    name: 'ownerId',
    label: 'Owner / Reviewer',
    type: 'entity',
    entity: 'user',
  },
  {
    name: 'progress',
    label: 'Progress (%)',
    type: 'number',
    defaultValue: '0',
    placeholder: '0–100',
  },
  {
    name: 'priority',
    label: 'Priority',
    type: 'select',
    options: [
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    defaultValue: 'medium',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'not-started', label: 'Not started' },
      { value: 'in-progress', label: 'In progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    defaultValue: 'not-started',
  },
  {
    name: 'milestones',
    label: 'Milestones',
    type: 'array',
    fullWidth: true,
    addLabel: 'Add milestone',
    subFields: [
      { name: 'title', label: 'Milestone', type: 'text', required: true },
      { name: 'targetDate', label: 'Target date', type: 'date' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'done', label: 'Done' },
        ],
      },
    ],
  },
  {
    name: 'checkins',
    label: 'Check-ins',
    type: 'array',
    fullWidth: true,
    addLabel: 'Add check-in',
    subFields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'note', label: 'Note', type: 'text' },
      { name: 'progress', label: 'Progress %', type: 'number' },
    ],
  },
];

export const sections = [
  {
    title: 'Goal',
    fieldNames: ['assigneeId', 'title', 'description', 'cycle', 'weight', 'priority'],
  },
  {
    title: 'Timeline & Owner',
    fieldNames: ['targetDate', 'ownerId', 'progress', 'status'],
  },
  { title: 'Milestones', fieldNames: ['milestones'] },
  { title: 'Check-ins', fieldNames: ['checkins'] },
];

// §1E ZoruSelect migration — consumed by goal-form.tsx until <EnumFormField> is wired up
export const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'achieved', label: 'Achieved' },
  { value: 'missed', label: 'Missed' },
  { value: 'archived', label: 'Archived' },
];
