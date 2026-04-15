import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'title', label: 'Title', required: true, fullWidth: true },
  {
    name: 'body',
    label: 'Body',
    type: 'textarea',
    required: true,
    fullWidth: true,
  },
  {
    name: 'audience',
    label: 'Audience',
    type: 'select',
    options: [
      { value: 'all', label: 'All' },
      { value: 'department', label: 'Department' },
      { value: 'team', label: 'Team' },
    ],
    defaultValue: 'all',
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'general', label: 'General' },
      { value: 'policy', label: 'Policy' },
      { value: 'event', label: 'Event' },
      { value: 'celebration', label: 'Celebration' },
      { value: 'urgent', label: 'Urgent' },
    ],
    defaultValue: 'general',
  },
  {
    name: 'priority',
    label: 'Priority',
    type: 'select',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'important', label: 'Important' },
      { value: 'urgent', label: 'Urgent' },
    ],
    defaultValue: 'normal',
  },
  { name: 'departmentId', label: 'Department ID' },
  { name: 'teamId', label: 'Team ID' },
  {
    name: 'targetEmployeeIds',
    label: 'Target Employee IDs',
    placeholder: 'comma,separated',
  },
  {
    name: 'pinned',
    label: 'Pinned',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
  { name: 'publishAt', label: 'Publish At', type: 'date' },
  { name: 'expiresAt', label: 'Expires At', type: 'date' },
  {
    name: 'requiresAcknowledgment',
    label: 'Requires Acknowledgment',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
  { name: 'attachmentUrl', label: 'Attachment URL', type: 'url', fullWidth: true },
];

export const sections = [
  { title: 'Content', fieldNames: ['title', 'body', 'category', 'priority'] },
  {
    title: 'Audience',
    fieldNames: ['audience', 'departmentId', 'teamId', 'targetEmployeeIds'],
  },
  {
    title: 'Schedule & Settings',
    fieldNames: [
      'publishAt',
      'expiresAt',
      'pinned',
      'requiresAcknowledgment',
      'attachmentUrl',
    ],
  },
];
