/**
 * Recipe: New employee start date → auto-create onboarding tasks.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'onboarding-task-assign',
  name: 'Onboarding: New hire task assign',
  category: 'onboarding',
  description:
    'When HRIS fires "new hire", create a standard set of onboarding tasks and notify the buddy.',
  tags: ['onboarding', 'hr', 'tasks', 'employee'],
  trigger: {
    id: 't_hire',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'hr_new_hire',
    options: {
      path: '/webhooks/hr/new-hire',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_employee', name: 'employee.email', defaultValue: '' },
    { id: 'v_buddy', name: 'buddy.email', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_tasks',
      groupId: 'g_tasks',
      type: 'webhook',
      options: {
        url: '/api/hr/onboarding-tasks',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content: '{"employee":"{{employee.email}}","preset":"standard-week-1"}',
        },
      },
    },
    {
      id: 'b_buddy',
      groupId: 'g_buddy',
      type: 'send_email',
      options: {
        to: '{{buddy.email}}',
        subject: 'You\'ve got a new buddy!',
        body: '{{employee.email}} starts soon — say hi this week.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
