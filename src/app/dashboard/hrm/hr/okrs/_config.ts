import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employeeId', label: 'Employee ID' },
  { name: 'team', label: 'Team' },
  { name: 'quarter', label: 'Quarter', required: true, placeholder: 'Q1 2026' },
  { name: 'year', label: 'Year', type: 'number' },
  {
    name: 'objective',
    label: 'Objective',
    required: true,
    fullWidth: true,
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
  },
  { name: 'weight', label: 'Weight (0-100)', type: 'number' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'in-progress', label: 'In progress' },
      { value: 'achieved', label: 'Achieved' },
      { value: 'missed', label: 'Missed' },
      { value: 'at-risk', label: 'At risk' },
    ],
    defaultValue: 'draft',
  },
  { name: 'startDate', label: 'Start Date', type: 'date' },
  { name: 'endDate', label: 'End Date', type: 'date' },
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
      { name: 'progress', label: 'Progress %', type: 'number', placeholder: '0-100' },
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
    fieldNames: [
      'employeeId',
      'team',
      'quarter',
      'year',
      'objective',
      'description',
      'weight',
    ],
  },
  {
    title: 'Timeline',
    fieldNames: ['status', 'startDate', 'endDate'],
  },
  {
    title: 'Key Results',
    fieldNames: ['keyResults'],
  },
];
