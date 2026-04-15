import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'title', label: 'Designation / Role', required: true, fullWidth: true },
  {
    name: 'level',
    label: 'Level',
    type: 'select',
    required: true,
    options: [
      { value: 'junior', label: 'Junior' },
      { value: 'mid', label: 'Mid' },
      { value: 'senior', label: 'Senior' },
      { value: 'lead', label: 'Lead' },
      { value: 'manager', label: 'Manager' },
      { value: 'director', label: 'Director' },
    ],
    defaultValue: 'mid',
  },
  { name: 'department', label: 'Department' },
  { name: 'min_salary', label: 'Min Salary', type: 'number', required: true },
  { name: 'midSalary', label: 'Mid Salary', type: 'number' },
  { name: 'max_salary', label: 'Max Salary', type: 'number', required: true },
  { name: 'currency', label: 'Currency', defaultValue: 'INR' },
  {
    name: 'currency_type',
    label: 'Currency Type',
    type: 'select',
    options: [
      { value: 'monthly', label: 'Monthly' },
      { value: 'annual', label: 'Annual' },
    ],
    defaultValue: 'annual',
  },
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
      'min_salary',
      'midSalary',
      'max_salary',
      'currency',
      'currency_type',
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
