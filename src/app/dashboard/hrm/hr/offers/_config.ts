import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'candidateId', label: 'Candidate ID', required: true },
  { name: 'designation', label: 'Designation', required: true },
  { name: 'department', label: 'Department' },
  // salary is the primary CTC field per spec
  { name: 'salary', label: 'Salary (CTC)', type: 'number', required: true },
  { name: 'ctc', label: 'Total CTC', type: 'number' },
  { name: 'currency', label: 'Currency', defaultValue: 'INR' },
  { name: 'joining_date', label: 'Joining Date', type: 'date', required: true },
  { name: 'valid_till', label: 'Valid Till', type: 'date' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'accepted', label: 'Accepted' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'expired', label: 'Expired' },
    ],
    defaultValue: 'pending',
  },
  { name: 'reportsTo', label: 'Reports To' },
  { name: 'fixedComponent', label: 'Fixed Component', type: 'number' },
  { name: 'variableComponent', label: 'Variable Component', type: 'number' },
  { name: 'joiningBonus', label: 'Joining Bonus', type: 'number' },
  { name: 'stockOptions', label: 'Stock Options' },
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
  { name: 'sentAt', label: 'Sent At', type: 'date' },
  { name: 'respondedAt', label: 'Responded At', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
  { name: 'terms', label: 'Terms', type: 'textarea', fullWidth: true },
];

export const sections = [
  {
    title: 'Role',
    fieldNames: [
      'candidateId',
      'designation',
      'department',
      'reportsTo',
      'joining_date',
      'workMode',
    ],
  },
  {
    title: 'Compensation',
    fieldNames: [
      'salary',
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
    title: 'Status & Validity',
    fieldNames: ['status', 'valid_till', 'sentAt', 'respondedAt'],
  },
  {
    title: 'Additional',
    fieldNames: ['notes', 'terms'],
  },
];
