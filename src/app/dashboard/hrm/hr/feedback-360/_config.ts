import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employeeId', label: 'Employee ID', required: true },
  { name: 'reviewerName', label: 'Reviewer Name', required: true },
  { name: 'reviewerEmail', label: 'Reviewer Email', type: 'email' },
  {
    name: 'reviewerType',
    label: 'Reviewer Type',
    type: 'select',
    options: [
      { value: 'peer', label: 'Peer' },
      { value: 'manager', label: 'Manager' },
      { value: 'report', label: 'Report' },
      { value: 'self', label: 'Self' },
      { value: 'customer', label: 'Customer' },
    ],
    defaultValue: 'peer',
  },
  { name: 'reviewCycle', label: 'Review Cycle' },
  { name: 'rating', label: 'Rating (1-5)', type: 'number' },
  {
    name: 'anonymous',
    label: 'Anonymous',
    type: 'select',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  { name: 'submittedAt', label: 'Submitted At', type: 'date' },
  {
    name: 'strengths',
    label: 'Strengths',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'improvements',
    label: 'Improvements',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'specificExamples',
    label: 'Specific Examples',
    type: 'textarea',
    fullWidth: true,
  },
];

export const sections = [
  {
    title: 'Reviewer',
    fieldNames: [
      'employeeId',
      'reviewerName',
      'reviewerEmail',
      'reviewerType',
      'reviewCycle',
      'anonymous',
      'submittedAt',
    ],
  },
  {
    title: 'Feedback',
    fieldNames: ['rating', 'strengths', 'improvements', 'specificExamples'],
  },
];
