/**
 * Recipe: Datadog anomaly webhook → Slack channel.
 *
 * Datadog monitors POST a payload here when an anomaly fires; we
 * forward a rich Slack message to the on-call channel with the
 * dashboard link and the offending metric.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'devops-datadog-anomaly-slack',
  name: 'DevOps: Datadog anomaly → Slack',
  category: 'ops',
  description:
    'Receive Datadog monitor anomalies over webhook and post a formatted alert (metric, value, dashboard URL) to the engineering Slack channel.',
  tags: ['datadog', 'slack', 'monitoring', 'devops', 'anomaly'],
  trigger: {
    id: 't_dd_anomaly',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/datadog/anomaly',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-Datadog-Webhook-Token',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_alert_type', name: 'dd.alertType', defaultValue: '' },
    { id: 'v_metric', name: 'dd.metric', defaultValue: '' },
    { id: 'v_value', name: 'dd.value', defaultValue: '' },
    { id: 'v_link', name: 'dd.link', defaultValue: '' },
    { id: 'v_channel', name: 'slack.channel', defaultValue: '#alerts-datadog' },
  ],
  blocks: [
    {
      id: 'b_extract',
      groupId: 'g_extract',
      type: 'set_variable',
      options: {
        variableName: 'dd.metric',
        value: '{{ $json.body.alert_metric }}',
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '{{slack.channel}}',
        text:
          ':bar_chart: *Datadog anomaly* — `{{dd.metric}}` = `{{dd.value}}` ({{dd.alertType}})\nDashboard: {{dd.link}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
