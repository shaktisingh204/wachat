/**
 * Recipe: Event RSVP form → log + confirmation email.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'form-processing-rsvp',
  name: 'Form: Event RSVP',
  category: 'marketing',
  description:
    'Process an RSVP form submission, log it, and email the attendee a confirmation.',
  tags: ['form', 'rsvp', 'event', 'confirmation', 'marketing'],
  trigger: {
    id: 't_rsvp',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/events/rsvp',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'attendee.email', defaultValue: '' },
    { id: 'v_event', name: 'event.name', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_log',
      groupId: 'g_log',
      type: 'webhook',
      options: {
        url: '/api/events/rsvp-log',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content: '{"email":"{{attendee.email}}","event":"{{event.name}}"}',
        },
      },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{attendee.email}}',
        subject: 'You\'re in — {{event.name}}',
        body: 'See you at {{event.name}}. We\'ll send a reminder closer to the date.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
