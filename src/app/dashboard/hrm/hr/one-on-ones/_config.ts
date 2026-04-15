import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employeeId', label: 'Employee ID', required: true },
  { name: 'managerName', label: 'Manager Name' },
  { name: 'managerEmail', label: 'Manager Email', type: 'email' },
  {
    name: 'scheduledAt',
    label: 'Scheduled At',
    type: 'date',
    required: true,
  },
  {
    name: 'durationMinutes',
    label: 'Duration (minutes)',
    type: 'number',
    defaultValue: '30',
  },
  { name: 'location', label: 'Location' },
  { name: 'meetingLink', label: 'Meeting Link', type: 'url' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'rescheduled', label: 'Rescheduled' },
    ],
    defaultValue: 'scheduled',
  },
  {
    name: 'mood',
    label: 'Mood',
    type: 'select',
    options: [
      { value: 'great', label: 'Great' },
      { value: 'good', label: 'Good' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'concerned', label: 'Concerned' },
      { value: 'stressed', label: 'Stressed' },
    ],
  },
  { name: 'followUpDate', label: 'Follow-up Date', type: 'date' },
  { name: 'agenda', label: 'Agenda', type: 'textarea', fullWidth: true },
  {
    name: 'discussionPoints',
    label: 'Discussion Points',
    type: 'textarea',
    fullWidth: true,
  },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
  {
    name: 'actionItems',
    label: 'Action Items',
    type: 'textarea',
    fullWidth: true,
  },
];

export const sections = [
  {
    title: 'Meeting',
    fieldNames: [
      'employeeId',
      'managerName',
      'managerEmail',
      'scheduledAt',
      'durationMinutes',
      'location',
      'meetingLink',
      'status',
      'mood',
      'followUpDate',
    ],
  },
  {
    title: 'Discussion',
    fieldNames: ['agenda', 'discussionPoints', 'notes', 'actionItems'],
  },
];
