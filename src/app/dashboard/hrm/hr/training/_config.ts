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
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'technical', label: 'Technical' },
      { value: 'soft-skills', label: 'Soft Skills' },
      { value: 'leadership', label: 'Leadership' },
      { value: 'compliance', label: 'Compliance' },
      { value: 'product', label: 'Product' },
      { value: 'onboarding', label: 'Onboarding' },
      { value: 'other', label: 'Other' },
    ],
    defaultValue: 'other',
  },
  { name: 'trainer', label: 'Trainer' },
  { name: 'trainerEmail', label: 'Trainer Email', type: 'email' },
  { name: 'duration', label: 'Duration' },
  { name: 'durationHours', label: 'Duration (hours)', type: 'number' },
  {
    name: 'format',
    label: 'Format',
    type: 'select',
    options: [
      { value: 'classroom', label: 'Classroom' },
      { value: 'virtual', label: 'Virtual' },
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'self-paced', label: 'Self-paced' },
    ],
    defaultValue: 'classroom',
  },
  { name: 'meetingLink', label: 'Meeting Link', type: 'url' },
  { name: 'venue', label: 'Venue' },
  { name: 'maxParticipants', label: 'Max Participants', type: 'number' },
  { name: 'startDate', label: 'Start Date', type: 'date' },
  { name: 'endDate', label: 'End Date', type: 'date' },
  {
    name: 'registrationDeadline',
    label: 'Registration Deadline',
    type: 'date',
  },
  { name: 'costPerParticipant', label: 'Cost / Participant', type: 'number' },
  { name: 'currency', label: 'Currency', defaultValue: 'INR' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'running', label: 'Running' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    defaultValue: 'draft',
  },
  { name: 'feedbackFormUrl', label: 'Feedback Form URL', type: 'url' },
  { name: 'materialsUrl', label: 'Materials URL', type: 'url' },
];

export const sections = [
  {
    title: 'Overview',
    fieldNames: ['name', 'description', 'category', 'status'],
  },
  {
    title: 'Trainer & Logistics',
    fieldNames: [
      'trainer',
      'trainerEmail',
      'format',
      'meetingLink',
      'venue',
      'maxParticipants',
    ],
  },
  {
    title: 'Schedule',
    fieldNames: [
      'startDate',
      'endDate',
      'registrationDeadline',
      'duration',
      'durationHours',
    ],
  },
  {
    title: 'Cost & Resources',
    fieldNames: [
      'costPerParticipant',
      'currency',
      'materialsUrl',
      'feedbackFormUrl',
    ],
  },
];
