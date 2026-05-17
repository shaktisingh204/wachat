/**
 * Recipe: Typeform submission → tag in CRM + email notify.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'webhook-relay-typeform',
  name: 'Webhook relay: Typeform',
  category: 'marketing',
  description:
    'Receive Typeform submissions, tag the respondent in your CRM, and email the team.',
  tags: ['webhook', 'typeform', 'form', 'relay', 'marketing'],
  trigger: {
    id: 't_typeform',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'typeform_submission',
    options: {
      path: '/webhooks/typeform',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_notify_to', name: 'notify.email', defaultValue: 'team@example.com' },
  ],
  blocks: [
    {
      id: 'b_email',
      groupId: 'g_notify',
      type: 'send_email',
      options: {
        to: '{{notify.email}}',
        subject: 'New form submission',
        body: 'Form: {{ $json.body.form_response.form_id }} — submitted at {{ $json.body.form_response.submitted_at }}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
