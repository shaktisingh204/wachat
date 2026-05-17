/**
 * Recipe: Post-event follow-up email.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'email-sequence-event-followup',
  name: 'Email: Post-event follow-up',
  category: 'marketing',
  description:
    'After a webinar / meetup / demo, send attendees a thank-you note and a recording link.',
  tags: ['email', 'event', 'webinar', 'followup', 'marketing'],
  trigger: {
    id: 't_event_done',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'event_completed',
    options: {
      path: '/webhooks/events/completed',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'attendee.email', defaultValue: '' },
    { id: 'v_recording', name: 'event.recordingUrl', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_wait',
      groupId: 'g_wait',
      type: 'wait',
      options: { secondsToWaitFor: 3600, seconds: 3600 },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{attendee.email}}',
        subject: 'Thanks for joining — recording inside',
        body: 'Thanks for joining! Here is the recording: {{event.recordingUrl}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
