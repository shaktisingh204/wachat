/**
 * Recipe: Meeting reminder — 15-minutes-before WhatsApp/SMS ping.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'calendar-meeting-reminder',
  name: 'Calendar: 15-min meeting reminder',
  category: 'ops',
  description:
    'When a meeting is 15 minutes out, send the attendee a WhatsApp/SMS reminder via Twilio.',
  tags: ['calendar', 'reminder', 'meeting', 'whatsapp', 'twilio'],
  trigger: {
    id: 't_15_before',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'calendar_15_min_before',
    options: {
      path: '/webhooks/calendar/upcoming',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_phone', name: 'attendee.phone', defaultValue: '' },
    { id: 'v_title', name: 'event.title', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_remind',
      groupId: 'g_remind',
      type: 'forge_twilio',
      options: {
        action: 'whatsapp_send',
        to: '{{attendee.phone}}',
        body: 'Heads up — your meeting "{{event.title}}" starts in 15 minutes.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
