/**
 * Recipe: AWS Cost Explorer daily spike check → Finance email.
 *
 * Daily cron pulls yesterday's AWS spend from a wrapper API and emails
 * Finance + Slack when it exceeds the threshold (default $250 over the
 * 7-day rolling average).
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'devops-aws-cost-spike-email',
  name: 'DevOps: AWS cost spike → Finance email',
  category: 'finance',
  description:
    'Each morning, pull yesterday\'s AWS spend versus the 7-day average and email Finance + ping #cloud-cost when the delta exceeds the configured threshold.',
  tags: ['aws', 'cost', 'finance', 'email', 'devops'],
  trigger: {
    id: 't_cost_daily',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_daily',
    options: {
      cronExpression: '30 8 * * *',
      timezone: 'UTC',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_spend', name: 'aws.yesterdaySpend', defaultValue: '0' },
    { id: 'v_avg', name: 'aws.weeklyAvg', defaultValue: '0' },
    { id: 'v_delta', name: 'aws.deltaUsd', defaultValue: '0' },
    { id: 'v_threshold', name: 'aws.thresholdUsd', defaultValue: '250' },
    { id: 'v_finance_email', name: 'finance.email', defaultValue: 'finance@example.com' },
  ],
  blocks: [
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: 'https://internal.example.com/aws/cost-delta?days=1',
        method: 'GET',
        responseMappings: [
          { id: 'rm1', jsonPath: 'yesterday', variableId: 'v_spend' },
          { id: 'rm2', jsonPath: 'sevenDayAvg', variableId: 'v_avg' },
          { id: 'rm3', jsonPath: 'deltaUsd', variableId: 'v_delta' },
        ],
      },
    },
    {
      id: 'b_compare',
      groupId: 'g_compare',
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
                variableId: 'v_delta',
                operator: 'Greater than',
                value: '{{aws.thresholdUsd}}',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{finance.email}}',
        subject: 'AWS spend spike: +${{aws.deltaUsd}} vs weekly avg',
        bodyType: 'html',
        body:
          '<p>Yesterday AWS spend was <strong>${{aws.yesterdaySpend}}</strong> ' +
          '(7-day avg: ${{aws.weeklyAvg}}, delta +${{aws.deltaUsd}}).</p>' +
          '<p>Threshold was ${{aws.thresholdUsd}}. Please investigate.</p>',
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#cloud-cost',
        text:
          ':money_with_wings: AWS yesterday: ${{aws.yesterdaySpend}} (+${{aws.deltaUsd}} vs avg). Threshold ${{aws.thresholdUsd}}.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
