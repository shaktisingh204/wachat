/**
 * Recipe: Twitter mention monitoring → Slack DM.
 *
 * Every 5 minutes we hit Twitter's recent-search endpoint for mentions of
 * the brand handle. New tweets (since the last cursor) are AI-classified for
 * sentiment + intent ("complaint", "praise", "question", "spam") and routed
 * as a Slack DM to whichever team handles that bucket.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'social-mention-monitor-slack',
  name: 'Social: Mention monitor → Slack DM',
  category: 'marketing',
  description:
    'Poll Twitter for mentions of your brand, classify each one with GPT, and DM the right Slack team based on sentiment + intent.',
  tags: ['social', 'twitter', 'mentions', 'slack', 'sentiment'],
  trigger: {
    id: 't_mentions',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '*/5 * * * *' },
  },
  variables: [
    { id: 'v_handle', name: 'brand.handle', defaultValue: 'sabnode' },
    { id: 'v_since_id', name: 'state.sinceId', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_search',
      groupId: 'g_search',
      type: 'webhook',
      options: {
        url: 'https://api.twitter.com/2/tweets/search/recent?query=%40{{brand.handle}}&since_id={{state.sinceId}}&tweet.fields=author_id,created_at',
        method: 'GET',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{TWITTER_BEARER}}' }],
      },
    },
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: { items: '{{ $json.data }}', itemVariable: 'tweet' },
    },
    {
      id: 'b_classify',
      groupId: 'g_classify',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt:
          'You triage tweets. Return JSON: { "intent": "complaint" | "praise" | "question" | "spam", "sentiment": "neg" | "neu" | "pos", "summary": "..." }',
        userMessage: 'Tweet: {{tweet.text}}',
        temperature: 0,
        maxTokens: 120,
        responseVariable: 'triage',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_route_complaint',
      groupId: 'g_route',
      type: 'condition',
      options: {
        logicalOperator: 'OR',
        conditionGroups: [
          {
            id: 'cg1',
            logicalOperator: 'AND',
            comparisons: [
              { id: 'c1', variableId: 'v_handle', operator: 'Equal to', value: 'complaint' },
            ],
          },
        ],
      },
    },
    {
      id: 'b_dm_support',
      groupId: 'g_dm_support',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '@support-lead',
        text:
          ':rotating_light: Complaint from @{{tweet.author_id}}: "{{ triage.summary }}"\n' +
          'Tweet: https://twitter.com/i/web/status/{{tweet.id}}',
      },
    },
    {
      id: 'b_dm_pmm',
      groupId: 'g_dm_pmm',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '@pmm-lead',
        text:
          ':sparkles: Praise from @{{tweet.author_id}}: "{{ triage.summary }}"\n' +
          'Tweet: https://twitter.com/i/web/status/{{tweet.id}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
