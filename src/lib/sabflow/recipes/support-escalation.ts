/**
 * Recipe: Support escalation.
 *
 * Triages an incoming support webhook by severity: a Condition block
 * routes "critical" tickets straight to Slack + on-call email, while
 * lower-severity tickets land in the CRM queue for normal SLA.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-escalation',
  name: 'Support escalation',
  category: 'support',
  description:
    'Triage inbound support tickets — page on-call for critical, queue everything else in the CRM.',
  tags: ['support', 'escalation', 'oncall', 'slack', 'crm'],
  trigger: {
    id: 't_ticket',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/support/inbound',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_severity', name: 'severity', defaultValue: '' },
    { id: 'v_subject', name: 'subject', defaultValue: '' },
    { id: 'v_email', name: 'reporterEmail', defaultValue: '' },
    { id: 'v_oncall', name: 'oncallEmail', defaultValue: 'oncall@example.com' },
    {
      id: 'v_slack_webhook',
      name: 'slackWebhook',
      defaultValue: 'https://hooks.slack.com/services/…',
    },
  ],
  blocks: [
    // Pull useful bits out of the payload.
    {
      id: 'b_extract',
      groupId: 'g_extract',
      type: 'set_variable',
      options: {
        variableName: 'severity',
        value: '{{ $json.body.severity }}',
      },
    },
    // Branch on severity.
    {
      id: 'b_branch',
      groupId: 'g_branch',
      type: 'condition',
      options: {
        logicalOperator: 'AND',
        conditionGroups: [
          {
            id: 'cg1',
            logicalOperator: 'AND',
            comparisons: [
              {
                id: 'c1',
                variableId: 'v_severity',
                operator: 'Equal to',
                value: 'critical',
              },
            ],
          },
        ],
      },
    },
    // Critical path → Slack
    {
      id: 'b_slack',
      groupId: 'g_critical',
      type: 'webhook',
      options: {
        url: '{{slackWebhook}}',
        method: 'POST',
        body: {
          type: 'json',
          content:
            '{"text":":rotating_light: Critical ticket from {{reporterEmail}} — {{subject}}"}',
        },
      },
    },
    // Critical path → on-call email
    {
      id: 'b_oncall_email',
      groupId: 'g_critical',
      type: 'send_email',
      options: {
        to: '{{oncallEmail}}',
        subject: '[CRITICAL] {{subject}}',
        body:
          'Critical ticket received from {{reporterEmail}}.\\n\\nSeverity: {{severity}}\\n\\nReply-to: {{reporterEmail}}',
      },
    },
    // Non-critical path: log + queue (placeholder — wire to your CRM webhook).
    {
      id: 'b_log_normal',
      groupId: 'g_normal',
      type: 'text',
      options: {
        content: 'Logged a {{severity}}-severity ticket from {{reporterEmail}}.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
