/**
 * Recipe: Contact form → routed support ticket.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'form-processing-contact',
  name: 'Form: Contact form → ticket',
  category: 'support',
  description:
    'Convert a "Contact us" form submission into a support ticket and confirm receipt.',
  tags: ['form', 'contact', 'support', 'ticket'],
  trigger: {
    id: 't_contact',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/contact-us',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'sender.email', defaultValue: '' },
    { id: 'v_subject', name: 'message.subject', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_ticket',
      groupId: 'g_ticket',
      type: 'webhook',
      options: {
        url: '/api/crm/tickets',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"from":"{{sender.email}}","subject":"{{message.subject}}","body":"{{ $json.body.message }}"}',
        },
      },
    },
    {
      id: 'b_ack',
      groupId: 'g_ack',
      type: 'send_email',
      options: {
        to: '{{sender.email}}',
        subject: 'We got your message',
        body: 'We received your note and a teammate will reply within one business day.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
