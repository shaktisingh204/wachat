import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'name', label: 'Name', required: true, fullWidth: true },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'items',
    label: 'Items',
    type: 'array',
    fullWidth: true,
    addLabel: 'Add Item',
    subFields: [
      { name: 'label', label: 'Label', type: 'text', required: true },
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
      { name: 'estimatedCost', label: 'Estimated Cost', type: 'number' },
    ],
  },
];

export const sections = [
  {
    title: 'Kit',
    fieldNames: ['name', 'description'],
  },
  {
    title: 'Items',
    fieldNames: ['items'],
  },
];
