import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'name', label: 'Name', required: true, fullWidth: true },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'laptop', label: 'Laptop' },
      { value: 'desktop', label: 'Desktop' },
      { value: 'phone', label: 'Phone' },
      { value: 'tablet', label: 'Tablet' },
      { value: 'monitor', label: 'Monitor' },
      { value: 'headset', label: 'Headset' },
      { value: 'furniture', label: 'Furniture' },
      { value: 'vehicle', label: 'Vehicle' },
      { value: 'other', label: 'Other' },
    ],
    defaultValue: 'laptop',
  },
  { name: 'brand', label: 'Brand' },
  { name: 'model', label: 'Model' },
  { name: 'serialNumber', label: 'Serial Number' },
  { name: 'assetTag', label: 'Asset Tag', required: true },
  {
    name: 'condition',
    label: 'Condition',
    type: 'select',
    options: [
      { value: 'new', label: 'New' },
      { value: 'good', label: 'Good' },
      { value: 'fair', label: 'Fair' },
      { value: 'poor', label: 'Poor' },
      { value: 'retired', label: 'Retired' },
    ],
    defaultValue: 'good',
  },
  { name: 'purchaseDate', label: 'Purchase Date', type: 'date' },
  { name: 'purchaseCost', label: 'Purchase Cost', type: 'number' },
  { name: 'vendor', label: 'Vendor' },
  { name: 'currency', label: 'Currency', defaultValue: 'INR' },
  {
    name: 'warrantyExpiresAt',
    label: 'Warranty Expires At',
    type: 'date',
  },
  { name: 'depreciationRate', label: 'Depreciation Rate (%)', type: 'number' },
  { name: 'currentValue', label: 'Current Value', type: 'number' },
  { name: 'location', label: 'Location' },
  { name: 'assignedDepartment', label: 'Assigned Department' },
  { name: 'insurancePolicyNumber', label: 'Insurance Policy Number' },
  {
    name: 'insuranceExpiresAt',
    label: 'Insurance Expires At',
    type: 'date',
  },
  { name: 'imageUrl', label: 'Image URL', type: 'url', fullWidth: true },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
];

export const sections = [
  {
    title: 'Asset',
    fieldNames: [
      'name',
      'category',
      'brand',
      'model',
      'serialNumber',
      'assetTag',
      'condition',
    ],
  },
  {
    title: 'Purchase',
    fieldNames: [
      'purchaseDate',
      'purchaseCost',
      'vendor',
      'currency',
      'warrantyExpiresAt',
    ],
  },
  {
    title: 'Valuation',
    fieldNames: ['depreciationRate', 'currentValue'],
  },
  {
    title: 'Location & Assignment',
    fieldNames: ['location', 'assignedDepartment'],
  },
  {
    title: 'Insurance',
    fieldNames: ['insurancePolicyNumber', 'insuranceExpiresAt'],
  },
  { title: 'Media & Notes', fieldNames: ['imageUrl', 'notes'] },
];
