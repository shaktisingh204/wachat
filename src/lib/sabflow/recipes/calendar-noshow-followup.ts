/**
 * Recipe: No-show meeting → automated follow-up email.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'calendar-noshow-followup',
  name: 'Calendar: No-show follow-up',
  category: 'sales',
  description:
    'When the calendar reports a no-show, send the invitee a friendly nudge to reschedule.',
  tags: ['calendar', 'no-show', 'sales', 'reschedule'],
  trigger: {
    id: 't_noshow',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'calendar_no_show',
    options: {
      path: '/webhooks/calendar/no-show',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'invitee.email', defaultValue: '' },
    { id: 'v_reschedule', name: 'rescheduleUrl', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{invitee.email}}',
        subject: 'Sorry we missed you',
        body: 'No worries — you can grab a new slot here any time: {{rescheduleUrl}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
