import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  {
    name: 'title',
    label: 'Title',
    required: true,
    fullWidth: true,
    placeholder: 'Improve customer satisfaction score',
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
    placeholder: 'Describe the objective in detail…',
  },
  {
    name: 'type',
    label: 'Type',
    type: 'select',
    required: true,
    options: [
      { value: 'individual', label: 'Individual' },
      { value: 'team', label: 'Team' },
      { value: 'company', label: 'Company' },
    ],
    defaultValue: 'individual',
  },
  {
    name: 'employee_id',
    label: 'Employee (for Individual)',
    placeholder: 'Employee ID or name',
  },
  {
    name: 'due_date',
    label: 'Due Date',
    type: 'date',
    required: true,
  },
  {
    name: 'progress',
    label: 'Progress (0–100)',
    type: 'number',
    defaultValue: '0',
    placeholder: '0',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'on-track', label: 'On track' },
      { value: 'at-risk', label: 'At risk' },
      { value: 'off-track', label: 'Off track' },
      { value: 'completed', label: 'Completed' },
    ],
    defaultValue: 'on-track',
  },
  // Legacy / extra fields kept for backwards compatibility
  { name: 'team', label: 'Team' },
  { name: 'quarter', label: 'Quarter', placeholder: 'Q1 2026' },
  {
    name: 'keyResults',
    label: 'Key Results',
    type: 'array',
    fullWidth: true,
    addLabel: 'Add Key Result',
    subFields: [
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        required: true,
        placeholder: 'Ship feature X',
      },
      { name: 'target', label: 'Target', type: 'text' },
      { name: 'progress', label: 'Progress %', type: 'number', placeholder: '0–100' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'not-started', label: 'Not started' },
          { value: 'in-progress', label: 'In progress' },
          { value: 'done', label: 'Done' },
        ],
      },
    ],
  },
];

export const sections = [
  {
    title: 'Objective',
    fieldNames: ['title', 'description', 'type', 'employee_id', 'team', 'quarter'],
  },
  {
    title: 'Timeline & Progress',
    fieldNames: ['due_date', 'progress', 'status'],
  },
  {
    title: 'Key Results',
    fieldNames: ['keyResults'],
  },
];
