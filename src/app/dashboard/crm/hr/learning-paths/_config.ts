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
      { value: 'onboarding', label: 'Onboarding' },
      { value: 'leadership', label: 'Leadership' },
      { value: 'technical', label: 'Technical' },
      { value: 'compliance', label: 'Compliance' },
      { value: 'personal-development', label: 'Personal Development' },
      { value: 'other', label: 'Other' },
    ],
    defaultValue: 'other',
  },
  { name: 'estimatedDuration', label: 'Estimated Duration' },
  {
    name: 'difficulty',
    label: 'Difficulty',
    type: 'select',
    options: [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'advanced', label: 'Advanced' },
    ],
    defaultValue: 'beginner',
  },
  { name: 'targetRole', label: 'Target Role' },
  {
    name: 'prerequisites',
    label: 'Prerequisites',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'outcomes',
    label: 'Outcomes',
    type: 'textarea',
    fullWidth: true,
  },
  {
    name: 'isPublished',
    label: 'Published',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
  {
    name: 'steps',
    label: 'Steps',
    type: 'array',
    fullWidth: true,
    addLabel: 'Add Step',
    subFields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'link', label: 'Link', type: 'text', placeholder: 'https://...' },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'video', label: 'Video' },
          { value: 'article', label: 'Article' },
          { value: 'course', label: 'Course' },
          { value: 'book', label: 'Book' },
          { value: 'other', label: 'Other' },
        ],
      },
      { name: 'duration', label: 'Duration', type: 'text' },
      { name: 'description', label: 'Description', type: 'text' },
    ],
  },
];

export const sections = [
  {
    title: 'Overview',
    fieldNames: ['name', 'description', 'category', 'difficulty', 'isPublished'],
  },
  {
    title: 'Details',
    fieldNames: [
      'estimatedDuration',
      'targetRole',
      'prerequisites',
      'outcomes',
    ],
  },
  { title: 'Steps', fieldNames: ['steps'] },
];
