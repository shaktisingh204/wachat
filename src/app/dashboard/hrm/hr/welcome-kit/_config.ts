import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employee_id', label: 'Employee ID', required: true },
  { name: 'name', label: 'Kit Name', fullWidth: true },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'sent', label: 'Sent' },
    ],
    defaultValue: 'pending',
  },
  { name: 'sent_date', label: 'Sent Date', type: 'date' },
  {
    name: 'items',
    label: 'Kit Contents',
    type: 'array',
    fullWidth: true,
    addLabel: 'Add Item',
    help: 'List each item in the kit — laptop, badge, handbook, etc.',
    subFields: [
      { name: 'label', label: 'Item', type: 'text', required: true },
      { name: 'note', label: 'Note', type: 'text' },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'stationary', label: 'Stationary' },
          { value: 'apparel', label: 'Apparel' },
          { value: 'device', label: 'Device' },
          { value: 'document', label: 'Document' },
          { value: 'access', label: 'Access' },
          { value: 'other', label: 'Other' },
        ],
      },
      { name: 'estimatedCost', label: 'Est. Cost', type: 'number' },
    ],
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
  },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
];

export const sections = [
  {
    title: 'Kit',
    fieldNames: ['employee_id', 'name', 'status', 'sent_date'],
  },
  {
    title: 'Contents',
    fieldNames: ['items'],
  },
  {
    title: 'Additional',
    fieldNames: ['description', 'notes'],
  },
];
