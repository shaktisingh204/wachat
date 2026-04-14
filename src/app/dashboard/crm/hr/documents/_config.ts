import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'name', label: 'Name', required: true, fullWidth: true },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'id-proof', label: 'ID Proof' },
      { value: 'address-proof', label: 'Address Proof' },
      { value: 'education', label: 'Education' },
      { value: 'experience', label: 'Experience' },
      { value: 'contract', label: 'Contract' },
      { value: 'nda', label: 'NDA' },
      { value: 'tax', label: 'Tax' },
      { value: 'medical', label: 'Medical' },
      { value: 'other', label: 'Other' },
    ],
    defaultValue: 'other',
  },
  { name: 'employeeId', label: 'Employee ID' },
  { name: 'url', label: 'File URL', type: 'url' },
  { name: 'fileSize', label: 'File Size (bytes)', type: 'number' },
  { name: 'issuedDate', label: 'Issued Date', type: 'date' },
  { name: 'expiresAt', label: 'Expires At', type: 'date' },
  { name: 'issuingAuthority', label: 'Issuing Authority' },
  { name: 'documentNumber', label: 'Document Number' },
  {
    name: 'isConfidential',
    label: 'Confidential',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
  {
    name: 'notifyBeforeExpiryDays',
    label: 'Notify Before Expiry (days)',
    type: 'number',
  },
  {
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    fullWidth: true,
  },
];

export const sections = [
  {
    title: 'Document',
    fieldNames: ['name', 'category', 'employeeId', 'url', 'fileSize'],
  },
  {
    title: 'Details',
    fieldNames: [
      'documentNumber',
      'issuingAuthority',
      'issuedDate',
      'expiresAt',
      'notifyBeforeExpiryDays',
      'isConfidential',
    ],
  },
  { title: 'Notes', fieldNames: ['notes'] },
];
