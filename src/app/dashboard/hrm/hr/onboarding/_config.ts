import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'name', label: 'Name', required: true, fullWidth: true },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
  },
  { name: 'department', label: 'Department' },
  { name: 'estimatedDays', label: 'Estimated Days', type: 'number' },
  {
    name: 'tasks',
    label: 'Tasks',
    type: 'array',
    fullWidth: true,
    addLabel: 'Add Task',
    subFields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'dueDays', label: 'Due Days', type: 'number', placeholder: '1' },
      { name: 'assignee', label: 'Assignee', type: 'text' },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'hr', label: 'HR' },
          { value: 'it', label: 'IT' },
          { value: 'finance', label: 'Finance' },
          { value: 'manager', label: 'Manager' },
          { value: 'buddy', label: 'Buddy' },
        ],
      },
      { name: 'description', label: 'Description', type: 'text' },
    ],
  },
];

export const sections = [
  {
    title: 'Template',
    fieldNames: ['name', 'description', 'department', 'estimatedDays'],
  },
  {
    title: 'Tasks',
    fieldNames: ['tasks'],
  },
];
