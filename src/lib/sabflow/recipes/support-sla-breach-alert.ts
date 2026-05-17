/**
 * Recipe: SLA breach → page on-call.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-sla-breach-alert',
  name: 'Support: SLA breach alert',
  category: 'support',
  description:
    'When the helpdesk fires an SLA-breach webhook, page the on-call manager via Twilio + Slack.',
  tags: ['support', 'sla', 'breach', 'alert', 'oncall'],
  trigger: {
    id: 't_sla_breach',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'support_sla_breach',
    options: {
      path: '/webhooks/support/sla-breach',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_oncall_phone', name: 'oncall.phone', defaultValue: '' },
    { id: 'v_id', name: 'ticket.id', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_call',
      groupId: 'g_call',
      type: 'forge_twilio',
      options: {
        action: 'sms_send',
        to: '{{oncall.phone}}',
        body: 'SLA BREACH on ticket #{{ticket.id}} — please respond.',
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#support-pager',
        text: ':rotating_light: SLA breach: #{{ticket.id}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
