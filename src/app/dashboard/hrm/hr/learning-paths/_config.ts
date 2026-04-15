import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'name', label: 'Title', required: true, fullWidth: true, placeholder: 'e.g. Frontend Engineering Track' },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    fullWidth: true,
    placeholder: 'What will learners achieve by completing this path?',
  },
  {
    name: 'assigned_to',
    label: 'Assigned To',
    placeholder: 'Employee ID, role, or "all"',
    help: 'Enter an employee ID, a role name, or "all" to assign to everyone.',
  },
  { name: 'estimatedHours', label: 'Estimated Hours', type: 'number' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
    defaultValue: 'active',
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
    label: 'Learning Outcomes',
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
    label: 'Courses / Steps',
    type: 'array',
    fullWidth: true,
    addLabel: 'Add Course',
    help: 'Add training IDs or course names in order.',
    subFields: [
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Course title or training ID' },
      { name: 'link', label: 'Link', type: 'text', placeholder: 'https://…' },
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
      { name: 'duration', label: 'Duration', type: 'text', placeholder: '2h 30m' },
    ],
  },
];

export const sections = [
  {
    title: 'Overview',
    fieldNames: ['name', 'description', 'category', 'difficulty', 'status', 'isPublished'],
  },
  {
    title: 'Assignment & Details',
    fieldNames: ['assigned_to', 'estimatedHours', 'targetRole', 'prerequisites', 'outcomes'],
  },
  { title: 'Courses', fieldNames: ['steps'] },
];
