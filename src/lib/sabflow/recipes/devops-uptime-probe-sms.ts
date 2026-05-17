/**
 * Recipe: Uptime probe failure → Twilio SMS to on-call.
 *
 * Hosted uptime monitor (e.g., UptimeRobot, Better Stack) POSTs here
 * on a probe failure; we SMS the on-call phone using Twilio with the
 * failing endpoint and HTTP status.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'devops-uptime-probe-sms',
  name: 'DevOps: Uptime probe failed → SMS',
  category: 'ops',
  description:
    'When the uptime monitor fires a probe-failure webhook, send a Twilio SMS to the on-call phone with the URL, region and HTTP status.',
  tags: ['uptime', 'twilio', 'sms', 'devops', 'alerting'],
  trigger: {
    id: 't_probe_failed',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/uptime/failed',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-Probe-Secret',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_url', name: 'probe.url', defaultValue: '' },
    { id: 'v_status', name: 'probe.status', defaultValue: '0' },
    { id: 'v_region', name: 'probe.region', defaultValue: '' },
    { id: 'v_oncall_phone', name: 'oncall.phone', defaultValue: '+15555550100' },
  ],
  blocks: [
    {
      id: 'b_sms',
      groupId: 'g_sms',
      type: 'forge_twilio',
      options: {
        action: 'sms_send',
        to: '{{oncall.phone}}',
        body:
          'UPTIME ALERT: {{probe.url}} returned {{probe.status}} from {{probe.region}}. Check the dashboard.',
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#alerts-uptime',
        text:
          ':red_circle: Probe failed — *{{probe.url}}* status {{probe.status}} from {{probe.region}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
