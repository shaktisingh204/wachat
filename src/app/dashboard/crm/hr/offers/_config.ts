import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'candidateId', label: 'Candidate ID', required: true },
  { name: 'jobTitle', label: 'Job Title', required: true },
  { name: 'department', label: 'Department' },
  { name: 'reportsTo', label: 'Reports To' },
  { name: 'joiningDate', label: 'Joining Date', type: 'date', required: true },
  { name: 'ctc', label: 'CTC', type: 'number', required: true },
  { name: 'fixedComponent', label: 'Fixed Component', type: 'number' },
  { name: 'variableComponent', label: 'Variable Component', type: 'number' },
  { name: 'joiningBonus', label: 'Joining Bonus', type: 'number' },
  { name: 'stockOptions', label: 'Stock Options' },
  { name: 'currency', label: 'Currency', defaultValue: 'INR' },
  {
    name: 'probationMonths',
    label: 'Probation (months)',
    type: 'number',
    defaultValue: '3',
  },
  {
    name: 'workMode',
    label: 'Work Mode',
    type: 'select',
    options: [
      { value: 'onsite', label: 'Onsite' },
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'remote', label: 'Remote' },
    ],
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'sent', label: 'Sent' },
      { value: 'accepted', label: 'Accepted' },
      { value: 'declined', label: 'Declined' },
      { value: 'withdrawn', label: 'Withdrawn' },
      { value: 'revoked', label: 'Revoked' },
    ],
    defaultValue: 'draft',
  },
  { name: 'sentAt', label: 'Sent At', type: 'date' },
  { name: 'respondedAt', label: 'Responded At', type: 'date' },
  { name: 'expiresAt', label: 'Expires At', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
  { name: 'terms', label: 'Terms', type: 'textarea', fullWidth: true },
];

export const sections = [
  {
    title: 'Role',
    fieldNames: [
      'candidateId',
      'jobTitle',
      'department',
      'reportsTo',
      'joiningDate',
      'workMode',
    ],
  },
  {
    title: 'Compensation',
    fieldNames: [
      'ctc',
      'fixedComponent',
      'variableComponent',
      'joiningBonus',
      'stockOptions',
      'currency',
      'probationMonths',
    ],
  },
  {
    title: 'Status',
    fieldNames: ['status', 'sentAt', 'respondedAt', 'expiresAt'],
  },
  {
    title: 'Additional',
    fieldNames: ['notes', 'terms'],
  },
];
