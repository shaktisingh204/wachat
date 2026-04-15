import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employeeId', label: 'Employee (Recipient)', required: true },
  { name: 'fromName', label: 'Recognized By', required: true },
  { name: 'fromEmail', label: 'Recognizer Email', type: 'email' },
  {
    name: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'kudos', label: 'Kudos' },
      { value: 'spot-award', label: 'Spot Award' },
      { value: 'performance', label: 'Performance' },
      { value: 'values', label: 'Values' },
      { value: 'monthly-star', label: 'Monthly Star' },
      { value: 'team-player', label: 'Team Player' },
      { value: 'innovation', label: 'Innovation' },
      { value: 'customer-focus', label: 'Customer Focus' },
      { value: 'leadership', label: 'Leadership' },
    ],
    defaultValue: 'kudos',
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'teamwork', label: 'Teamwork' },
      { value: 'leadership', label: 'Leadership' },
      { value: 'innovation', label: 'Innovation' },
      { value: 'customer-focus', label: 'Customer Focus' },
      { value: 'excellence', label: 'Excellence' },
      { value: 'integrity', label: 'Integrity' },
      { value: 'ownership', label: 'Ownership' },
    ],
  },
  {
    name: 'title',
    label: 'Award Title',
    placeholder: 'e.g. Employee of the Month — Q1',
    fullWidth: true,
  },
  {
    name: 'message',
    label: 'Description',
    type: 'textarea',
    required: true,
    fullWidth: true,
    placeholder: 'Describe why this person is being recognized…',
  },
  { name: 'points', label: 'Points', type: 'number' },
  { name: 'monetaryReward', label: 'Monetary Reward', type: 'number' },
  { name: 'currency', label: 'Currency', defaultValue: 'INR' },
  {
    name: 'visibility',
    label: 'Visibility',
    type: 'select',
    options: [
      { value: 'public', label: 'Public' },
      { value: 'team', label: 'Team' },
      { value: 'private', label: 'Private' },
    ],
    defaultValue: 'public',
  },
  { name: 'linkedValue', label: 'Linked Value' },
  { name: 'givenAt', label: 'Awarded Date', type: 'date', required: true },
  { name: 'approvedBy', label: 'Approved By' },
  {
    name: 'anonymous',
    label: 'Anonymous',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
];

export const sections = [
  {
    title: 'Recognition',
    fieldNames: [
      'employeeId',
      'type',
      'category',
      'title',
      'message',
      'givenAt',
      'visibility',
    ],
  },
  {
    title: 'From',
    fieldNames: ['fromName', 'fromEmail', 'anonymous', 'approvedBy'],
  },
  {
    title: 'Reward',
    fieldNames: ['points', 'monetaryReward', 'currency', 'linkedValue'],
  },
];
