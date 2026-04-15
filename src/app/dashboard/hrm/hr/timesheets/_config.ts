import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employeeId', label: 'Employee ID', required: true },
  { name: 'weekStart', label: 'Week Start', type: 'date', required: true },
  { name: 'weekEnd', label: 'Week End', type: 'date' },
  { name: 'totalHours', label: 'Total Hours', type: 'number', required: true },
  { name: 'billableHours', label: 'Billable Hours', type: 'number' },
  {
    name: 'nonBillableHours',
    label: 'Non-billable Hours',
    type: 'number',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'submitted', label: 'Submitted' },
      { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' },
    ],
    defaultValue: 'draft',
  },
  { name: 'submittedAt', label: 'Submitted At', type: 'date' },
  { name: 'approvedBy', label: 'Approved By' },
  { name: 'approvedAt', label: 'Approved At', type: 'date' },
  {
    name: 'rejectionReason',
    label: 'Rejection Reason',
    type: 'textarea',
    fullWidth: true,
  },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
  {
    name: 'entries',
    label: 'Entries',
    type: 'array',
    fullWidth: true,
    addLabel: 'Add Entry',
    subFields: [
      {
        name: 'day',
        label: 'Day',
        type: 'select',
        options: [
          { value: 'Mon', label: 'Mon' },
          { value: 'Tue', label: 'Tue' },
          { value: 'Wed', label: 'Wed' },
          { value: 'Thu', label: 'Thu' },
          { value: 'Fri', label: 'Fri' },
          { value: 'Sat', label: 'Sat' },
          { value: 'Sun', label: 'Sun' },
        ],
      },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'hours', label: 'Hours', type: 'number', required: true },
      { name: 'project', label: 'Project', type: 'text' },
      { name: 'task', label: 'Task', type: 'text' },
      {
        name: 'billable',
        label: 'Billable',
        type: 'select',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
      },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
];

export const sections = [
  {
    title: 'Timesheet',
    fieldNames: [
      'employeeId',
      'weekStart',
      'weekEnd',
      'totalHours',
      'billableHours',
      'nonBillableHours',
    ],
  },
  {
    title: 'Approval',
    fieldNames: [
      'status',
      'submittedAt',
      'approvedBy',
      'approvedAt',
      'rejectionReason',
    ],
  },
  {
    title: 'Entries',
    fieldNames: ['entries', 'notes'],
  },
];
