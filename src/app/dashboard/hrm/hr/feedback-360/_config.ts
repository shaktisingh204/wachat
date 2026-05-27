import type { HrField } from '../_components/hr-entity-page';
import type { Feedback360ReviewerRole, Feedback360Status } from '@/app/actions/crm-feedback-360.actions.types';
export const fields: HrField[] = [
  { name: 'reviewer_id', label: 'Reviewer', required: true, type: 'entity', entity: 'employee' },
  { name: 'reviewee_id', label: 'Reviewee (Subject)', required: true, type: 'entity', entity: 'employee' },
  {
    name: 'type',
    label: 'Review Type',
    type: 'select',
    required: true,
    options: [
      { value: 'self', label: 'Self' },
      { value: 'peer', label: 'Peer' },
      { value: 'manager', label: 'Manager' },
      { value: 'direct-report', label: 'Direct Report' },
    ],
    defaultValue: 'peer',
  },
  {
    name: 'period',
    label: 'Period',
    placeholder: 'Q1 2026',
    required: true,
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'submitted', label: 'Submitted' },
    ],
    defaultValue: 'pending',
  },
  { name: 'submitted_at', label: 'Submitted At', type: 'date' },
  {
    name: 'feedback',
    label: 'Feedback',
    type: 'textarea',
    fullWidth: true,
    placeholder: 'Provide detailed feedback…',
  },
  // Ratings (1–5)
  {
    name: 'rating_communication',
    label: 'Communication (1–5)',
    type: 'number',
    placeholder: '1–5',
  },
  {
    name: 'rating_teamwork',
    label: 'Teamwork (1–5)',
    type: 'number',
    placeholder: '1–5',
  },
  {
    name: 'rating_leadership',
    label: 'Leadership (1–5)',
    type: 'number',
    placeholder: '1–5',
  },
  {
    name: 'rating_technical',
    label: 'Technical Skills (1–5)',
    type: 'number',
    placeholder: '1–5',
  },
  // Legacy fields kept for backwards compat
  { name: 'reviewerName', label: 'Reviewer Name (legacy)' },
  { name: 'reviewCycle', label: 'Review Cycle (legacy)' },
  {
    name: 'strengths',
    label: 'Strengths',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'improvements',
    label: 'Areas for Improvement',
    type: 'textarea',
    fullWidth: true,
  },
];

export const sections = [
  {
    title: 'Participants',
    fieldNames: ['reviewer_id', 'reviewee_id', 'type', 'period', 'status', 'submitted_at'],
  },
  {
    title: 'Ratings',
    fieldNames: [
      'rating_communication',
      'rating_teamwork',
      'rating_leadership',
      'rating_technical',
    ],
  },
  {
    title: 'Qualitative Feedback',
    fieldNames: ['feedback', 'strengths', 'improvements'],
  },
];

// ---------------------------------------------------------------------------
// Exports consumed by <Feedback360Form /> (§1E — not using HrEntityPage)
// ---------------------------------------------------------------------------


export const STATUS_OPTIONS: Array<{ value: Feedback360Status; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const REVIEWER_ROLE_OPTIONS: Array<{ value: Feedback360ReviewerRole; label: string }> = [
  { value: 'self', label: 'Self' },
  { value: 'peer', label: 'Peer' },
  { value: 'manager', label: 'Manager' },
  { value: 'direct_report', label: 'Direct report' },
];

export const SCORE_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'communication', label: 'Communication' },
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'technical', label: 'Technical' },
  { key: 'initiative', label: 'Initiative' },
];
