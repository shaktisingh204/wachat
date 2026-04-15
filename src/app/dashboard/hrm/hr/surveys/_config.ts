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
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'engagement', label: 'Engagement' },
      { value: 'satisfaction', label: 'Satisfaction' },
      { value: 'pulse', label: 'Pulse' },
      { value: 'exit', label: 'Exit' },
      { value: '360', label: '360' },
      { value: 'onboarding', label: 'Onboarding' },
      { value: 'custom', label: 'Custom' },
    ],
    defaultValue: 'custom',
  },
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
  {
    name: 'audience',
    label: 'Audience',
    type: 'select',
    options: [
      { value: 'all', label: 'All' },
      { value: 'department', label: 'Department' },
      { value: 'team', label: 'Team' },
      { value: 'role', label: 'Role' },
    ],
    defaultValue: 'all',
  },
  { name: 'departmentId', label: 'Department ID' },
  { name: 'teamId', label: 'Team ID' },
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
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
      { value: 'archived', label: 'Archived' },
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
      { name: 'prompt', label: 'Prompt', type: 'text', required: true },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        options: [
          { value: 'rating', label: 'Rating' },
          { value: 'text', label: 'Text' },
          { value: 'yes-no', label: 'Yes/No' },
          { value: 'multiple-choice', label: 'Multiple Choice' },
          { value: 'scale-1-10', label: 'Scale 1-10' },
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
      { name: 'options', label: 'Options', type: 'text' },
    ],
  },
];

export const sections = [
  {
    title: 'Survey',
    fieldNames: ['title', 'description', 'category', 'status', 'anonymous'],
  },
  {
    title: 'Audience',
    fieldNames: ['audience', 'departmentId', 'teamId'],
  },
  {
    title: 'Schedule & Targets',
    fieldNames: ['startDate', 'endDate', 'targetCount', 'responsesCount'],
  },
  { title: 'Questions', fieldNames: ['questions'] },
];
