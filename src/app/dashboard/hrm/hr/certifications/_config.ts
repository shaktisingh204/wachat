import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employeeId', label: 'Employee', required: true, placeholder: 'Employee ID or name' },
  { name: 'name', label: 'Certification Name', required: true, fullWidth: true, placeholder: 'e.g. AWS Solutions Architect' },
  { name: 'issuer', label: 'Issuing Organisation', placeholder: 'e.g. Amazon Web Services' },
  { name: 'issuingOrganization', label: 'Issuing Org (full name)' },
  { name: 'credentialId', label: 'Credential ID' },
  { name: 'credentialUrl', label: 'Certificate URL', type: 'url', fullWidth: true, placeholder: 'https://…' },
  { name: 'issuedAt', label: 'Issued Date', type: 'date', required: true },
  { name: 'expiresAt', label: 'Expiry Date', type: 'date' },
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
  { name: 'attachmentUrl', label: 'Attachment URL', type: 'url', fullWidth: true },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
];

export const sections = [
  {
    title: 'Certification',
    fieldNames: ['name', 'employeeId', 'category', 'skillLevel'],
  },
  {
    title: 'Issuer Details',
    fieldNames: ['issuer', 'issuingOrganization', 'credentialId', 'credentialUrl'],
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
