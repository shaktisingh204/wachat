/**
 * Recipe: Lost-deal feedback form → Segment track event.
 *
 * After an AE marks a deal as lost, the loss-reason form is submitted
 * here. We forward the reason + competitor + price-sensitivity flag as
 * a `Deal Lost` track event to Segment for downstream analytics.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'sales-lost-deal-segment-event',
  name: 'Sales: Lost-deal feedback → Segment event',
  category: 'sales',
  description:
    'When the lost-deal reason form is submitted, fire a `Deal Lost` track event to Segment with reason, competitor and contract value for win/loss analysis.',
  tags: ['sales', 'segment', 'analytics', 'lost', 'feedback'],
  trigger: {
    id: 't_lost_deal_form',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/sales/lost-deal-feedback',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_deal_id', name: 'deal.id', defaultValue: '' },
    { id: 'v_reason', name: 'loss.reason', defaultValue: '' },
    { id: 'v_competitor', name: 'loss.competitor', defaultValue: '' },
    { id: 'v_value', name: 'deal.value', defaultValue: '0' },
    { id: 'v_user_id', name: 'segment.userId', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_segment',
      groupId: 'g_segment',
      type: 'webhook',
      options: {
        url: 'https://api.segment.io/v1/track',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Basic {{SEGMENT_WRITE_KEY_BASIC}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"userId":"{{segment.userId}}","event":"Deal Lost","properties":{"deal_id":"{{deal.id}}","reason":"{{loss.reason}}","competitor":"{{loss.competitor}}","value":{{deal.value}}}}',
        },
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#sales-winloss',
        text:
          ':disappointed: Deal {{deal.id}} lost (${{deal.value}}) — *{{loss.reason}}*' +
          ', competitor: {{loss.competitor}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
