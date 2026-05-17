/**
 * Recipe: SLA breach → PagerDuty incident + Slack escalation.
 *
 * When the helpdesk fires an SLA-breach webhook, opens a PagerDuty
 * incident through the Events API v2 and posts the on-call summary to
 * the escalation Slack channel.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-sla-breach-pagerduty',
  name: 'Support: SLA breach → PagerDuty',
  category: 'support',
  description:
    'On an SLA-breach webhook, open a PagerDuty incident via the Events API v2 and ping the on-call Slack channel with the ticket context.',
  tags: ['support', 'sla', 'pagerduty', 'escalation', 'oncall'],
  trigger: {
    id: 't_sla_breach_pd',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'support_sla_breach',
    options: {
      path: '/webhooks/support/sla-breach-pd',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-Webhook-Secret',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_ticket_id', name: 'ticket.id', defaultValue: '' },
    { id: 'v_subject', name: 'ticket.subject', defaultValue: '' },
    { id: 'v_severity', name: 'ticket.severity', defaultValue: 'critical' },
    { id: 'v_pd_key', name: 'pagerduty.routingKey', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_pd',
      groupId: 'g_pagerduty',
      type: 'webhook',
      options: {
        url: 'https://events.pagerduty.com/v2/enqueue',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"routing_key":"{{pagerduty.routingKey}}","event_action":"trigger","payload":{"summary":"SLA breach on ticket #{{ticket.id}}: {{ticket.subject}}","source":"sabflow-helpdesk","severity":"{{ticket.severity}}","custom_details":{"ticket_id":"{{ticket.id}}"}}}',
        },
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#oncall-support',
        text:
          ':fire: PagerDuty incident opened for ticket *#{{ticket.id}}* — "{{ticket.subject}}" (severity {{ticket.severity}}).',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
