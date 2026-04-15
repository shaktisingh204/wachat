import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'title', label: 'Title', required: true, fullWidth: true },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'hr', label: 'HR' },
      { value: 'it', label: 'IT' },
      { value: 'finance', label: 'Finance' },
      { value: 'legal', label: 'Legal' },
      { value: 'safety', label: 'Safety' },
      { value: 'conduct', label: 'Conduct' },
      { value: 'leave', label: 'Leave' },
      { value: 'other', label: 'Other' },
    ],
    defaultValue: 'hr',
  },
  { name: 'version', label: 'Version' },
  { name: 'effectiveDate', label: 'Effective Date', type: 'date' },
  { name: 'expiresAt', label: 'Expires At', type: 'date' },
  {
    name: 'body',
    label: 'Body',
    type: 'textarea',
    required: true,
    fullWidth: true,
  },
  {
    name: 'summary',
    label: 'Summary',
    type: 'textarea',
    fullWidth: true,
  },
  { name: 'reviewDate', label: 'Review Date', type: 'date' },
  { name: 'ownerName', label: 'Owner Name' },
  {
    name: 'appliesTo',
    label: 'Applies To',
    type: 'select',
    options: [
      { value: 'all', label: 'All' },
      { value: 'department', label: 'Department' },
      { value: 'role', label: 'Role' },
    ],
    defaultValue: 'all',
  },
  { name: 'departmentId', label: 'Department ID' },
  { name: 'roleId', label: 'Role ID' },
  {
    name: 'acknowledgmentRequired',
    label: 'Acknowledgment Required',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
  {
    name: 'attachmentUrl',
    label: 'Document URL',
    type: 'url',
    fullWidth: true,
    placeholder: 'https://… (link to PDF or document)',
    help: 'Paste a direct link to the policy document (PDF, Google Doc, etc.)',
  },
  {
    name: 'departments',
    label: 'Departments (comma-separated, or "all")',
    placeholder: 'e.g. Engineering, Finance — leave blank for all',
    fullWidth: true,
    help: 'Which departments this policy applies to. Leave blank for company-wide.',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'active', label: 'Active' },
      { value: 'archived', label: 'Archived' },
    ],
    defaultValue: 'draft',
  },
];

export const sections = [
  {
    title: 'Overview',
    fieldNames: ['title', 'category', 'version', 'status', 'ownerName'],
  },
  {
    title: 'Content',
    fieldNames: ['summary', 'body', 'attachmentUrl', 'departments'],
  },
  {
    title: 'Dates',
    fieldNames: ['effectiveDate', 'expiresAt', 'reviewDate'],
  },
  {
    title: 'Applicability',
    fieldNames: [
      'appliesTo',
      'departmentId',
      'roleId',
      'acknowledgmentRequired',
    ],
  },
];
