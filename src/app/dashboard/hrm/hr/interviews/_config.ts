import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'candidateId', label: 'Candidate ID', required: true },
  { name: 'roundNumber', label: 'Round Number', type: 'number', required: true },
  { name: 'roundName', label: 'Round Name' },
  { name: 'interviewerName', label: 'Interviewer Name' },
  { name: 'interviewerEmail', label: 'Interviewer Email', type: 'email' },
  { name: 'interviewerPhone', label: 'Interviewer Phone', type: 'tel' },
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
    defaultValue: '60',
  },
  {
    name: 'mode',
    label: 'Mode',
    type: 'select',
    required: true,
    options: [
      { value: 'in-person', label: 'In-person' },
      { value: 'phone', label: 'Phone' },
      { value: 'video', label: 'Video' },
    ],
    defaultValue: 'video',
  },
  { name: 'location', label: 'Location' },
  { name: 'meetingLink', label: 'Meeting Link', type: 'url' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'no-show', label: 'No-show' },
      { value: 'rescheduled', label: 'Rescheduled' },
    ],
    defaultValue: 'scheduled',
  },
  { name: 'rating', label: 'Rating (1-5)', type: 'number' },
  {
    name: 'recommendation',
    label: 'Recommendation',
    type: 'select',
    options: [
      { value: 'strong-hire', label: 'Strong hire' },
      { value: 'hire', label: 'Hire' },
      { value: 'no-hire', label: 'No hire' },
      { value: 'strong-no-hire', label: 'Strong no hire' },
    ],
  },
  { name: 'feedback', label: 'Feedback', type: 'textarea', fullWidth: true },
  { name: 'strengths', label: 'Strengths', type: 'textarea', fullWidth: true },
  {
    name: 'weaknesses',
    label: 'Weaknesses',
    type: 'textarea',
    fullWidth: true,
  },
];

export const sections = [
  {
    title: 'Interview',
    fieldNames: [
      'candidateId',
      'roundNumber',
      'roundName',
      'scheduledAt',
      'durationMinutes',
      'mode',
      'status',
    ],
  },
  {
    title: 'Interviewer',
    fieldNames: [
      'interviewerName',
      'interviewerEmail',
      'interviewerPhone',
      'location',
      'meetingLink',
    ],
  },
  {
    title: 'Outcome',
    fieldNames: [
      'rating',
      'recommendation',
      'feedback',
      'strengths',
      'weaknesses',
    ],
  },
];
