import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'manager_id', label: 'Manager', required: true, placeholder: 'Manager ID or name' },
  { name: 'employee_id', label: 'Employee', required: true, placeholder: 'Employee ID or name' },
  { name: 'scheduled_date', label: 'Scheduled Date', type: 'date', required: true },
  { name: 'duration_minutes', label: 'Duration (minutes)', type: 'number', defaultValue: '30' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    defaultValue: 'scheduled',
  },
  { name: 'meetingLink', label: 'Meeting Link', type: 'url' },
  { name: 'location', label: 'Location' },
  { name: 'agenda', label: 'Agenda', type: 'textarea', fullWidth: true, placeholder: 'Topics to cover in this meeting…' },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true, placeholder: 'Discussion points, observations…' },
  { name: 'actionItems', label: 'Action Items', type: 'textarea', fullWidth: true, placeholder: 'Follow-up tasks agreed during the meeting…' },
  // Legacy fields
  { name: 'employeeId', label: 'Employee ID (legacy)' },
  { name: 'managerName', label: 'Manager Name (legacy)' },
  { name: 'managerEmail', label: 'Manager Email (legacy)', type: 'email' },
  { name: 'scheduledAt', label: 'Scheduled At (legacy)', type: 'date' },
  { name: 'durationMinutes', label: 'Duration Minutes (legacy)', type: 'number', defaultValue: '30' },
  { name: 'followUpDate', label: 'Follow-up Date', type: 'date' },
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
  { name: 'discussionPoints', label: 'Discussion Points', type: 'textarea', fullWidth: true },
];

export const sections = [
  {
    title: 'Meeting Details',
    fieldNames: [
      'manager_id',
      'employee_id',
      'scheduled_date',
      'duration_minutes',
      'status',
      'meetingLink',
      'location',
      'mood',
      'followUpDate',
    ],
  },
  {
    title: 'Discussion',
    fieldNames: ['agenda', 'notes', 'actionItems', 'discussionPoints'],
  },
];
