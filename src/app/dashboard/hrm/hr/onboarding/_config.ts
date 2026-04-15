import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employee_id', label: 'Employee ID', required: true },
  { name: 'task_name', label: 'Task Name', required: true, fullWidth: true },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
  },
  { name: 'assigned_to', label: 'Assigned To (Employee / HR ID)' },
  { name: 'due_date', label: 'Due Date', type: 'date' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'completed', label: 'Completed' },
      { value: 'skipped', label: 'Skipped' },
    ],
    defaultValue: 'pending',
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'paperwork', label: 'Paperwork' },
      { value: 'equipment', label: 'Equipment' },
      { value: 'training', label: 'Training' },
      { value: 'access', label: 'Access' },
      { value: 'intro', label: 'Introduction' },
    ],
    defaultValue: 'paperwork',
  },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
  // Template fields (used when creating reusable checklists)
  { name: 'name', label: 'Template Name', fullWidth: true },
  { name: 'department', label: 'Department' },
  { name: 'estimatedDays', label: 'Estimated Days (Template)', type: 'number' },
  {
    name: 'tasks',
    label: 'Template Tasks',
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
          { value: 'paperwork', label: 'Paperwork' },
          { value: 'equipment', label: 'Equipment' },
          { value: 'training', label: 'Training' },
          { value: 'access', label: 'Access' },
          { value: 'intro', label: 'Introduction' },
        ],
      },
      { name: 'description', label: 'Description', type: 'text' },
    ],
  },
];

export const sections = [
  {
    title: 'Task',
    fieldNames: ['employee_id', 'task_name', 'description', 'assigned_to', 'due_date', 'status', 'category'],
  },
  {
    title: 'Notes',
    fieldNames: ['notes'],
  },
  {
    title: 'Template (optional)',
    fieldNames: ['name', 'department', 'estimatedDays', 'tasks'],
  },
];
