import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employeeId', label: 'Employee ID', required: true },
  { name: 'startDate', label: 'Start Date', type: 'date', required: true },
  { name: 'endDate', label: 'End Date', type: 'date', required: true },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { value: 'ongoing', label: 'Ongoing' },
      { value: 'passed', label: 'Passed' },
      { value: 'extended', label: 'Extended' },
      { value: 'terminated', label: 'Terminated' },
    ],
    defaultValue: 'ongoing',
  },
  { name: 'reviewer_id', label: 'Reviewer ID' },
  { name: 'reviewerName', label: 'Reviewer Name' },
  { name: 'reviewerEmail', label: 'Reviewer Email', type: 'email' },
  { name: 'mentor', label: 'Mentor' },
  { name: 'midReviewDate', label: 'Mid Review Date', type: 'date' },
  { name: 'extension_date', label: 'Extension Date', type: 'date' },
  {
    name: 'performanceScore',
    label: 'Performance Score (1-5)',
    type: 'number',
  },
  { name: 'extendedEndDate', label: 'Extended End Date', type: 'date' },
  {
    name: 'review_notes',
    label: 'Review Notes',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'evaluationCriteria',
    label: 'Evaluation Criteria',
    type: 'textarea',
    fullWidth: true,
  },
  { name: 'feedback', label: 'Feedback', type: 'textarea', fullWidth: true },
  {
    name: 'terminationReason',
    label: 'Termination Reason',
    type: 'textarea',
    fullWidth: true,
  },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
];

export const sections = [
  {
    title: 'Probation',
    fieldNames: ['employeeId', 'startDate', 'endDate', 'status'],
  },
  {
    title: 'Reviewer',
    fieldNames: ['reviewer_id', 'reviewerName', 'reviewerEmail', 'mentor', 'midReviewDate'],
  },
  {
    title: 'Outcome',
    fieldNames: [
      'performanceScore',
      'extension_date',
      'extendedEndDate',
      'review_notes',
      'evaluationCriteria',
      'feedback',
      'terminationReason',
      'notes',
    ],
  },
];
