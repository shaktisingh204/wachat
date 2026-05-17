/**
 * Recipe: After-meeting → create follow-up task in CRM.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'calendar-followup-tasks',
  name: 'Calendar: Auto follow-up task',
  category: 'sales',
  description:
    'When a meeting wraps, create a follow-up task in the CRM with a 48-hour due date.',
  tags: ['calendar', 'task', 'crm', 'followup', 'sales'],
  trigger: {
    id: 't_meeting_ended',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'calendar_meeting_ended',
    options: {
      path: '/webhooks/calendar/ended',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'attendee.email', defaultValue: '' },
    { id: 'v_title', name: 'event.title', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_task',
      groupId: 'g_task',
      type: 'webhook',
      options: {
        url: '/api/crm/tasks',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"title":"Follow up: {{event.title}}","contactEmail":"{{attendee.email}}","dueInHours":48}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
