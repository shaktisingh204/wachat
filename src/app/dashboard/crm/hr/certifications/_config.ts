import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employeeId', label: 'Employee ID', required: true },
  { name: 'name', label: 'Name', required: true, fullWidth: true },
  { name: 'issuer', label: 'Issuer' },
  { name: 'issuingOrganization', label: 'Issuing Organization' },
  { name: 'credentialId', label: 'Credential ID' },
  { name: 'credentialUrl', label: 'Credential URL', type: 'url' },
  { name: 'issuedAt', label: 'Issued At', type: 'date' },
  { name: 'expiresAt', label: 'Expires At', type: 'date' },
  {
    name: 'doesNotExpire',
    label: 'Does Not Expire',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'technical', label: 'Technical' },
      { value: 'professional', label: 'Professional' },
      { value: 'language', label: 'Language' },
      { value: 'safety', label: 'Safety' },
      { value: 'compliance', label: 'Compliance' },
      { value: 'other', label: 'Other' },
    ],
    defaultValue: 'professional',
  },
  {
    name: 'skillLevel',
    label: 'Skill Level',
    type: 'select',
    options: [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'advanced', label: 'Advanced' },
      { value: 'expert', label: 'Expert' },
    ],
  },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
  { name: 'attachmentUrl', label: 'Attachment URL', type: 'url', fullWidth: true },
];

export const sections = [
  {
    title: 'Certification',
    fieldNames: ['name', 'employeeId', 'category', 'skillLevel'],
  },
  {
    title: 'Issuer Details',
    fieldNames: [
      'issuer',
      'issuingOrganization',
      'credentialId',
      'credentialUrl',
    ],
  },
  {
    title: 'Validity',
    fieldNames: ['issuedAt', 'expiresAt', 'doesNotExpire'],
  },
  {
    title: 'Attachments & Notes',
    fieldNames: ['attachmentUrl', 'notes'],
  },
];
