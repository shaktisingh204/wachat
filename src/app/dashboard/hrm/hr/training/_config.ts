import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'name', label: 'Title', required: true, fullWidth: true, placeholder: 'e.g. React Fundamentals Workshop' },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
    placeholder: 'Describe the training content and objectives…',
  },
  {
    name: 'format',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'online', label: 'Online' },
      { value: 'classroom', label: 'Classroom' },
      { value: 'on-job', label: 'On the Job' },
      { value: 'virtual', label: 'Virtual' },
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'self-paced', label: 'Self-paced' },
    ],
    defaultValue: 'online',
  },
  { name: 'trainer', label: 'Trainer' },
  { name: 'trainerEmail', label: 'Trainer Email', type: 'email' },
  { name: 'startDate', label: 'Start Date', type: 'date' },
  { name: 'endDate', label: 'End Date', type: 'date' },
  { name: 'durationHours', label: 'Duration (hours)', type: 'number' },
  { name: 'maxParticipants', label: 'Max Participants', type: 'number' },
  { name: 'venue', label: 'Venue / Location' },
  { name: 'meetingLink', label: 'Meeting Link', type: 'url' },
  { name: 'registrationDeadline', label: 'Registration Deadline', type: 'date' },
  { name: 'costPerParticipant', label: 'Cost / Participant', type: 'number' },
  { name: 'currency', label: 'Currency', defaultValue: 'INR' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'upcoming', label: 'Upcoming' },
      { value: 'ongoing', label: 'Ongoing' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'draft', label: 'Draft' },
    ],
    defaultValue: 'upcoming',
  },
  { name: 'materialsUrl', label: 'Materials URL', type: 'url' },
  { name: 'feedbackFormUrl', label: 'Feedback Form URL', type: 'url' },
];

export const sections = [
  {
    title: 'Overview',
    fieldNames: ['name', 'description', 'format', 'status'],
  },
  {
    title: 'Trainer & Logistics',
    fieldNames: ['trainer', 'trainerEmail', 'venue', 'meetingLink', 'maxParticipants'],
  },
  {
    title: 'Schedule',
    fieldNames: ['startDate', 'endDate', 'durationHours', 'registrationDeadline'],
  },
  {
    title: 'Cost & Resources',
    fieldNames: ['costPerParticipant', 'currency', 'materialsUrl', 'feedbackFormUrl'],
  },
];
