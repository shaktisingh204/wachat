/**
 * Appraisal review form config — `saveCrmAppraisalReview` action keys:
 *   employeeId, reviewerId, reviewDate, status, strengths,
 *   areasForImprovement, reviewerComments,
 *   rating_qualityOfWork, rating_communication, rating_teamwork,
 *   rating_problemSolving, rating_punctuality, id.
 *
 * Extra brief fields (cycle, normalizedRating, incrementPct) are
 * captured but not yet persisted — TODO 1D.3 extend the action.
 */

import type { HrField } from '../../hr/_components/hr-entity-page';

export const fields: HrField[] = [
  {
    name: 'employeeId',
    label: 'Employee',
    type: 'entity',
    entity: 'employee',
    required: true,
  },
  {
    name: 'reviewerId',
    label: 'Reviewer',
    type: 'entity',
    entity: 'user',
    required: true,
  },
  { name: 'cycle', label: 'Cycle', placeholder: 'Q1 2026 / Annual FY 25-26' },
  {
    name: 'reviewDate',
    label: 'Review date',
    type: 'date',
    required: true,
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'Scheduled', label: 'Scheduled' },
      { value: 'Completed', label: 'Completed' },
      { value: 'Cancelled', label: 'Cancelled' },
    ],
    defaultValue: 'Scheduled',
  },
  // Ratings 1–5
  {
    name: 'rating_qualityOfWork',
    label: 'Quality of work (1–5)',
    type: 'number',
    placeholder: '1–5',
  },
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
    name: 'rating_problemSolving',
    label: 'Problem solving (1–5)',
    type: 'number',
    placeholder: '1–5',
  },
  {
    name: 'rating_punctuality',
    label: 'Punctuality (1–5)',
    type: 'number',
    placeholder: '1–5',
  },
  {
    name: 'normalizedRating',
    label: 'Normalized rating',
    type: 'number',
    help: 'Overall normalized score (auto-computed if blank).',
  },
  {
    name: 'incrementPct',
    label: 'Suggested increment %',
    type: 'number',
    placeholder: '0–30',
  },
  {
    name: 'strengths',
    label: 'Strengths',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'areasForImprovement',
    label: 'Areas for improvement',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'reviewerComments',
    label: 'Reviewer comments / next-cycle goals',
    type: 'textarea',
    fullWidth: true,
  },
];

export const sections = [
  {
    title: 'Participants',
    fieldNames: ['employeeId', 'reviewerId', 'cycle', 'reviewDate', 'status'],
  },
  {
    title: 'Ratings',
    fieldNames: [
      'rating_qualityOfWork',
      'rating_communication',
      'rating_teamwork',
      'rating_problemSolving',
      'rating_punctuality',
      'normalizedRating',
      'incrementPct',
    ],
  },
  {
    title: 'Qualitative',
    fieldNames: ['strengths', 'areasForImprovement', 'reviewerComments'],
  },
];
