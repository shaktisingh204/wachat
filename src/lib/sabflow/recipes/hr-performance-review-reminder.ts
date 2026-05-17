/**
 * Recipe: Performance review reminder → email manager + employee.
 *
 * Weekly cron pulls reviews due in the next 14 days and emails both
 * the manager and the direct report with a link to the review form.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'hr-performance-review-reminder',
  name: 'HR: Performance review reminder',
  category: 'onboarding',
  description:
    'Every Monday at 10:00, list reviews due in the next 14 days and email both manager and direct report with a deep link to the review form.',
  tags: ['hr', 'reviews', 'performance', 'reminder', 'weekly'],
  trigger: {
    id: 't_review_weekly',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_weekly',
    options: {
      cronExpression: '0 10 * * 1',
      timezone: 'UTC',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_reviews', name: 'reviews', defaultValue: '[]' },
    { id: 'v_manager_email', name: 'review.managerEmail', defaultValue: '' },
    { id: 'v_employee_email', name: 'review.employeeEmail', defaultValue: '' },
    { id: 'v_due_date', name: 'review.dueDate', defaultValue: '' },
    { id: 'v_form_url', name: 'review.formUrl', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: '/api/hr/reviews/due?withinDays=14',
        method: 'GET',
        responseMappings: [
          { id: 'rm1', jsonPath: 'reviews', variableId: 'v_reviews' },
        ],
      },
    },
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: {
        sourceVariable: 'reviews',
        iteratorVariable: 'review',
      },
    },
    {
      id: 'b_email_manager',
      groupId: 'g_email_manager',
      type: 'send_email',
      options: {
        to: '{{review.managerEmail}}',
        subject: 'Performance review due {{review.dueDate}}',
        body:
          'Reminder: your review for {{review.employeeEmail}} is due {{review.dueDate}}.\nForm: {{review.formUrl}}',
      },
    },
    {
      id: 'b_email_employee',
      groupId: 'g_email_employee',
      type: 'send_email',
      options: {
        to: '{{review.employeeEmail}}',
        subject: 'Self-review due {{review.dueDate}}',
        body:
          'Your self-review is due {{review.dueDate}}.\nFill it in: {{review.formUrl}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
