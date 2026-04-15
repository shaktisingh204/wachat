import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'title', label: 'Title', required: true, fullWidth: true },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'pulse', label: 'Pulse' },
      { value: 'exit', label: 'Exit' },
      { value: 'engagement', label: 'Engagement' },
      { value: 'onboarding', label: 'Onboarding' },
    ],
    defaultValue: 'engagement',
  },
  {
    name: 'target',
    label: 'Target Audience',
    type: 'select',
    options: [
      { value: 'all', label: 'All' },
      { value: 'department', label: 'Department' },
    ],
    defaultValue: 'all',
  },
  { name: 'departmentId', label: 'Department ID' },
  {
    name: 'anonymous',
    label: 'Anonymous',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
  { name: 'deadline', label: 'Deadline', type: 'date' },
  { name: 'startDate', label: 'Start Date', type: 'date' },
  { name: 'endDate', label: 'End Date', type: 'date' },
  { name: 'targetCount', label: 'Target Count', type: 'number' },
  { name: 'responsesCount', label: 'Responses Count', type: 'number' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'active', label: 'Active' },
      { value: 'closed', label: 'Closed' },
    ],
    defaultValue: 'draft',
  },
  {
    name: 'questions',
    label: 'Questions',
    type: 'array',
    fullWidth: true,
    addLabel: 'Add Question',
    subFields: [
      { name: 'prompt', label: 'Question Text', type: 'text', required: true },
      {
        name: 'type',
        label: 'Answer Type',
        type: 'select',
        required: true,
        options: [
          { value: 'text', label: 'Text' },
          { value: 'rating', label: 'Rating' },
          { value: 'boolean', label: 'Yes / No' },
          { value: 'multiple-choice', label: 'Multiple Choice' },
        ],
      },
      {
        name: 'required',
        label: 'Required',
        type: 'select',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
      },
    ],
  },
];

export const sections = [
  {
    title: 'Survey',
    fieldNames: ['title', 'description', 'type', 'status', 'anonymous'],
  },
  {
    title: 'Audience',
    fieldNames: ['target', 'departmentId'],
  },
  {
    title: 'Schedule',
    fieldNames: ['deadline', 'startDate', 'endDate', 'targetCount', 'responsesCount'],
  },
  { title: 'Questions', fieldNames: ['questions'] },
];
