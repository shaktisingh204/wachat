import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'title', label: 'Title', required: true, fullWidth: true },
  { name: 'level', label: 'Level', required: true },
  { name: 'department', label: 'Department' },
  { name: 'minSalary', label: 'Min Salary', type: 'number', required: true },
  { name: 'midSalary', label: 'Mid Salary', type: 'number' },
  { name: 'maxSalary', label: 'Max Salary', type: 'number', required: true },
  { name: 'currency', label: 'Currency', defaultValue: 'INR' },
  { name: 'experienceMin', label: 'Experience Min (years)', type: 'number' },
  { name: 'experienceMax', label: 'Experience Max (years)', type: 'number' },
  { name: 'bandVersion', label: 'Band Version', defaultValue: 'v1' },
  {
    name: 'reviewCycle',
    label: 'Review Cycle',
    type: 'select',
    options: [
      { value: 'annual', label: 'Annual' },
      { value: 'bi-annual', label: 'Bi-annual' },
      { value: 'quarterly', label: 'Quarterly' },
    ],
  },
  { name: 'location', label: 'Location' },
  {
    name: 'geographyMultiplier',
    label: 'Geography Multiplier',
    type: 'number',
  },
  { name: 'bonusPercentage', label: 'Bonus %', type: 'number' },
  {
    name: 'stockEligible',
    label: 'Stock Eligible',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
  { name: 'effectiveDate', label: 'Effective Date', type: 'date' },
  { name: 'expiresAt', label: 'Expires At', type: 'date' },
  {
    name: 'isActive',
    label: 'Active',
    type: 'select',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    defaultValue: 'yes',
  },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
];

export const sections = [
  {
    title: 'Band',
    fieldNames: ['title', 'level', 'department', 'bandVersion', 'isActive'],
  },
  {
    title: 'Salary',
    fieldNames: [
      'minSalary',
      'midSalary',
      'maxSalary',
      'currency',
      'bonusPercentage',
      'stockEligible',
    ],
  },
  {
    title: 'Experience & Location',
    fieldNames: [
      'experienceMin',
      'experienceMax',
      'location',
      'geographyMultiplier',
    ],
  },
  {
    title: 'Validity',
    fieldNames: ['effectiveDate', 'expiresAt', 'reviewCycle'],
  },
  { title: 'Notes', fieldNames: ['notes'] },
];
