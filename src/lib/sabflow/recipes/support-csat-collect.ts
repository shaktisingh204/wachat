/**
 * Recipe: Ticket closed → ask for CSAT rating via email.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-csat-collect',
  name: 'Support: CSAT survey on close',
  category: 'support',
  description:
    'When a support ticket is closed, email the requester a one-click rating survey.',
  tags: ['support', 'csat', 'survey', 'feedback'],
  trigger: {
    id: 't_closed',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'support_ticket_closed',
    options: {
      path: '/webhooks/support/closed',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'requester.email', defaultValue: '' },
    { id: 'v_id', name: 'ticket.id', defaultValue: '' },
    { id: 'v_survey', name: 'survey.url', defaultValue: 'https://example.com/csat' },
  ],
  blocks: [
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{requester.email}}',
        subject: 'How did we do?',
        body: '30 seconds, one click — rate your support experience: {{survey.url}}?ticket={{ticket.id}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
