import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'name', label: 'Name', required: true, fullWidth: true },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'offer', label: 'Offer Letter' },
      { value: 'contract', label: 'Contract' },
      { value: 'nda', label: 'NDA' },
      { value: 'certificate', label: 'Certificate' },
      { value: 'relieving', label: 'Relieving Letter' },
      { value: 'experience', label: 'Experience Letter' },
      { value: 'warning', label: 'Warning Letter' },
      { value: 'appraisal', label: 'Appraisal' },
      { value: 'other', label: 'Other' },
    ],
    defaultValue: 'other',
  },
  {
    name: 'body',
    label: 'Body',
    type: 'textarea',
    required: true,
    fullWidth: true,
    help: 'Use {{employee_name}}, {{joining_date}} etc.',
  },
  {
    name: 'placeholders',
    label: 'Placeholders',
    type: 'textarea',
    fullWidth: true,
    placeholder: '["{{firstName}}", "{{startDate}}"]',
    help: 'JSON array of placeholder keys',
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'isDefault',
    label: 'Default Template',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
];

export const sections = [
  { title: 'Template', fieldNames: ['name', 'category', 'isDefault'] },
  { title: 'Content', fieldNames: ['body', 'placeholders', 'description'] },
];
