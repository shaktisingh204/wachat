/**
 * Recipe: Webinar registration → reminder cadence → post-event survey.
 *
 * After someone registers via the webinar platform's webhook, we send a
 * calendar-style confirmation, a 24h reminder, an "it's starting" SMS, then
 * a CSAT survey email two hours after the event finishes.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'marketing-webinar-reminder',
  name: 'Marketing: Webinar reminder cadence',
  category: 'marketing',
  description:
    'Confirm a webinar registrant, remind them 24h and 15min before, then email a survey two hours after the event.',
  tags: ['marketing', 'webinar', 'reminder', 'sms', 'survey'],
  trigger: {
    id: 't_registered',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/webinar/registered',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'attendee.email', defaultValue: '' },
    { id: 'v_first', name: 'attendee.firstName', defaultValue: '' },
    { id: 'v_phone', name: 'attendee.phone', defaultValue: '' },
    { id: 'v_title', name: 'webinar.title', defaultValue: 'Scaling SabFlow to 10M runs/mo' },
    { id: 'v_join_url', name: 'webinar.joinUrl', defaultValue: '' },
    { id: 'v_survey_url', name: 'survey.url', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_confirm_email',
      groupId: 'g_confirm',
      type: 'send_email',
      options: {
        to: '{{attendee.email}}',
        subject: 'You\'re in: {{webinar.title}}',
        body:
          'Thanks {{attendee.firstName}}! Add it to your calendar — we\'ll ' +
          'email you a reminder a day before, and an SMS just before we go live.\n\n' +
          'Join link: {{webinar.joinUrl}}',
      },
    },
    {
      id: 'b_wait_to_day_before',
      groupId: 'g_wait_day_before',
      type: 'wait',
      options: { secondsToWaitFor: 23 * 3600, seconds: 23 * 3600 },
    },
    {
      id: 'b_reminder_email',
      groupId: 'g_reminder_email',
      type: 'send_email',
      options: {
        to: '{{attendee.email}}',
        subject: 'Tomorrow: {{webinar.title}}',
        body: '24-hour heads-up — we go live tomorrow. Join link: {{webinar.joinUrl}}',
      },
    },
    {
      id: 'b_wait_to_start',
      groupId: 'g_wait_to_start',
      type: 'wait',
      options: { secondsToWaitFor: 23 * 3600 + 45 * 60, seconds: 23 * 3600 + 45 * 60 },
    },
    {
      id: 'b_sms_start',
      groupId: 'g_sms_start',
      type: 'forge_twilio',
      options: {
        action: 'sms_send',
        to: '{{attendee.phone}}',
        body: 'Starting in 15 min: {{webinar.title}} — {{webinar.joinUrl}}',
      },
    },
    {
      id: 'b_wait_to_survey',
      groupId: 'g_wait_survey',
      type: 'wait',
      options: { secondsToWaitFor: 3 * 3600 + 15 * 60, seconds: 3 * 3600 + 15 * 60 },
    },
    {
      id: 'b_survey_email',
      groupId: 'g_survey',
      type: 'send_email',
      options: {
        to: '{{attendee.email}}',
        subject: 'Quick feedback on {{webinar.title}}?',
        body:
          'Hi {{attendee.firstName}}, a 60-second survey makes our next webinar ' +
          'better. Here\'s the link: {{survey.url}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
